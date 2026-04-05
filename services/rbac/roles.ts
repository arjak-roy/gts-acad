import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma-client";
import { invalidateAllPermissionCaches } from "@/services/rbac/permissions";

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

export async function createRole(input: { name: string; code: string; description?: string; permissionIds?: string[] }) {
  const existingRole = await prisma.role.findUnique({ where: { code: input.code } });
  if (existingRole) {
    throw new Error("A role with this code already exists.");
  }

  return prisma.$transaction(async (tx) => {
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
}

export async function updateRole(roleId: string, input: { name?: string; code?: string; description?: string; isActive?: boolean }) {
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
  return updated;
}

export async function deleteRole(roleId: string) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) {
    throw new Error("Role not found.");
  }

  if (role.isSystemRole) {
    throw new Error("Cannot delete a system role.");
  }

  await prisma.role.delete({ where: { id: roleId } });
  invalidateAllPermissionCaches();
}

export async function setRolePermissions(roleId: string, permissionIds: string[]) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) {
    throw new Error("Role not found.");
  }

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
}
