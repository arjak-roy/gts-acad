import { AuditActionType, AuditEntityType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma-client";
import { createAuditLogEntry } from "@/services/logs-actions-service";
import { invalidateAllPermissionCaches } from "@/services/rbac/permissions";

type RoleMutationInput = {
  actorUserId?: string | null;
};

async function getPermissionKeysByIds(permissionIds: string[]) {
  if (permissionIds.length === 0) {
    return [];
  }

  const permissions = await prisma.permission.findMany({
    where: {
      id: {
        in: permissionIds,
      },
    },
    select: {
      id: true,
      key: true,
    },
  });

  const permissionKeyMap = new Map(permissions.map((permission) => [permission.id, permission.key]));
  return permissionIds.map((permissionId) => permissionKeyMap.get(permissionId)).filter((value): value is string => Boolean(value));
}

export async function getUserRoles(userId: string) {
  return prisma.$queryRaw<Array<{ id: string; name: string; code: string; isSystemRole: boolean }>>(
    Prisma.sql`
      SELECT r."role_id" AS "id", r."name", r."code", r."is_system_role" AS "isSystemRole"
      FROM "user_roles" ur
      INNER JOIN "roles" r ON r."role_id" = ur."role_id"
      WHERE ur."user_id" = ${userId}::uuid
      ORDER BY r."name"
    `,
  );
}

export async function getUserPrimaryRoleCode(userId: string): Promise<string> {
  const roles = await getUserRoles(userId);

  if (roles.length === 0) {
    return "";
  }

  const systemRole = roles.find((role) => role.isSystemRole);
  return systemRole?.code ?? roles[0].code;
}

export async function getRoles() {
  return prisma.$queryRaw<
    Array<{
      id: string;
      name: string;
      code: string;
      description: string | null;
      isSystemRole: boolean;
      isActive: boolean;
      permissionCount: number;
      userCount: number;
      createdAt: Date;
      updatedAt: Date;
    }>
  >(
    Prisma.sql`
      SELECT
        r."role_id" AS "id",
        r."name",
        r."code",
        r."description",
        r."is_system_role" AS "isSystemRole",
        r."is_active" AS "isActive",
        (SELECT COUNT(*)::int FROM "role_permissions" rp WHERE rp."role_id" = r."role_id") AS "permissionCount",
        (SELECT COUNT(*)::int FROM "user_roles" ur WHERE ur."role_id" = r."role_id") AS "userCount",
        r."created_at" AS "createdAt",
        r."updated_at" AS "updatedAt"
      FROM "roles" r
      ORDER BY r."is_system_role" DESC, r."name" ASC
    `,
  );
}

export async function getRoleById(roleId: string) {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    include: {
      permissions: {
        include: {
          permission: true,
        },
      },
    },
  });

  if (!role) {
    throw new Error("Role not found.");
  }

  return {
    id: role.id,
    name: role.name,
    code: role.code,
    description: role.description,
    isSystemRole: role.isSystemRole,
    isActive: role.isActive,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
    permissions: role.permissions.map((rp) => ({
      id: rp.permission.id,
      module: rp.permission.module,
      action: rp.permission.action,
      key: rp.permission.key,
      description: rp.permission.description,
    })),
  };
}

export async function createRole(input: { name: string; code: string; description?: string; permissionIds?: string[] }, options: RoleMutationInput = {}) {
  const existingRole = await prisma.role.findUnique({ where: { code: input.code } });
  if (existingRole) {
    throw new Error("A role with this code already exists.");
  }

  const normalizedPermissionIds = input.permissionIds ?? [];

  const role = await prisma.$transaction(async (tx) => {
    const role = await tx.role.create({
      data: {
        name: input.name,
        code: input.code,
        description: input.description ?? null,
        isSystemRole: false,
        isActive: true,
      },
    });

    if (input.permissionIds && input.permissionIds.length > 0) {
      await tx.rolePermission.createMany({
        data: input.permissionIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
        skipDuplicates: true,
      });
    }

    return role;
  });

  const permissionKeys = await getPermissionKeysByIds(normalizedPermissionIds);

  await createAuditLogEntry({
    entityType: AuditEntityType.SYSTEM,
    entityId: role.id,
    action: AuditActionType.CREATED,
    actorUserId: options.actorUserId ?? null,
    message: `Role ${role.code} created.`,
    metadata: {
      roleName: role.name,
      roleCode: role.code,
      isActive: role.isActive,
      permissionKeys,
    },
  });

  return role;
}

export async function updateRole(roleId: string, input: { name?: string; code?: string; description?: string; isActive?: boolean }, options: RoleMutationInput = {}) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) {
    throw new Error("Role not found.");
  }

  if (input.code && input.code !== role.code && role.isSystemRole) {
    throw new Error("Cannot change the code of a system role.");
  }

  if (input.code && input.code !== role.code) {
    const existingRole = await prisma.role.findUnique({ where: { code: input.code } });
    if (existingRole) {
      throw new Error("A role with this code already exists.");
    }
  }

  const updated = await prisma.role.update({
    where: { id: roleId },
    data: {
      name: input.name,
      code: role.isSystemRole ? undefined : input.code,
      description: input.description,
      isActive: input.isActive,
    },
  });

  invalidateAllPermissionCaches();

  await createAuditLogEntry({
    entityType: AuditEntityType.SYSTEM,
    entityId: updated.id,
    action: AuditActionType.UPDATED,
    actorUserId: options.actorUserId ?? null,
    message: `Role ${updated.code} updated.`,
    metadata: {
      before: {
        name: role.name,
        code: role.code,
        description: role.description,
        isActive: role.isActive,
      },
      after: {
        name: updated.name,
        code: updated.code,
        description: updated.description,
        isActive: updated.isActive,
      },
    },
  });

  return updated;
}

export async function deleteRole(roleId: string, options: RoleMutationInput = {}) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) {
    throw new Error("Role not found.");
  }

  if (role.isSystemRole) {
    throw new Error("Cannot delete a system role.");
  }

  await prisma.role.delete({ where: { id: roleId } });
  invalidateAllPermissionCaches();

  await createAuditLogEntry({
    entityType: AuditEntityType.SYSTEM,
    entityId: role.id,
    action: AuditActionType.UPDATED,
    actorUserId: options.actorUserId ?? null,
    message: `Role ${role.code} deleted.`,
    metadata: {
      roleName: role.name,
      roleCode: role.code,
      isActive: role.isActive,
      deleted: true,
    },
  });
}

export async function setRolePermissions(roleId: string, permissionIds: string[], options: RoleMutationInput = {}) {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    include: {
      permissions: {
        include: {
          permission: {
            select: {
              key: true,
            },
          },
        },
      },
    },
  });
  if (!role) {
    throw new Error("Role not found.");
  }

  const previousPermissionKeys = role.permissions.map((record) => record.permission.key).sort();

  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId } });

    if (permissionIds.length > 0) {
      await tx.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId,
          permissionId,
        })),
        skipDuplicates: true,
      });
    }
  });

  invalidateAllPermissionCaches();

  const nextPermissionKeys = (await getPermissionKeysByIds(permissionIds)).sort();

  await createAuditLogEntry({
    entityType: AuditEntityType.SYSTEM,
    entityId: role.id,
    action: AuditActionType.UPDATED,
    actorUserId: options.actorUserId ?? null,
    message: `Permissions updated for role ${role.code}.`,
    metadata: {
      roleName: role.name,
      roleCode: role.code,
      previousPermissionKeys,
      nextPermissionKeys,
      addedPermissionKeys: nextPermissionKeys.filter((key) => !previousPermissionKeys.includes(key)),
      removedPermissionKeys: previousPermissionKeys.filter((key) => !nextPermissionKeys.includes(key)),
    },
  });
}
