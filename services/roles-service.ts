import "server-only";

import { UserRole } from "@prisma/client";

import { sendWelcomeEmail } from "@/lib/email/send-welcome";
import { prisma } from "@/lib/prisma";
import type { StaffRoleAssignmentUser, StaffRoleOption } from "@/types";

export async function getAllRolesService() {
  return prisma.role.findMany({
    include: {
      _count: {
        select: {
          permissions: true,
          users: true,
        },
      },
    },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });
}

export async function getRoleEditorDataService(roleId: string) {
  const [permissions, role] = await Promise.all([
    prisma.permission.findMany({ orderBy: [{ module: "asc" }, { action: "asc" }, { label: "asc" }] }),
    roleId === "new"
      ? Promise.resolve(null)
      : prisma.role.findUnique({
          where: { id: roleId },
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        }),
  ]);

  return { permissions, role };
}

export async function upsertRoleService(roleId: string, name: string, description: string | undefined, permissionKeys: string[]) {
  const normalizedName = name.trim().toLowerCase();
  const normalizedDescription = description?.trim() || null;
  const normalizedPermissionKeys = Array.from(new Set(permissionKeys.map((key) => key.trim()).filter(Boolean)));
  const permissions = await prisma.permission.findMany({ where: { key: { in: normalizedPermissionKeys } }, select: { id: true, key: true } });

  if (permissions.length !== normalizedPermissionKeys.length) {
    throw new Error("One or more permissions are invalid.");
  }

  return prisma.$transaction(async (tx) => {
    const persistedRole =
      roleId === "new"
        ? await tx.role.create({
            data: {
              name: normalizedName,
              description: normalizedDescription,
              isSystem: false,
            },
          })
        : await tx.role.update({
            where: { id: roleId },
            data: {
              name: normalizedName,
              description: normalizedDescription,
            },
          });

    await tx.rolePermission.deleteMany({ where: { roleId: persistedRole.id } });

    if (permissions.length > 0) {
      await tx.rolePermission.createMany({
        data: permissions.map((permission) => ({ roleId: persistedRole.id, permissionId: permission.id })),
      });
    }

    return persistedRole;
  });
}

export async function deleteRoleService(roleId: string) {
  const role = await prisma.role.findUnique({ where: { id: roleId }, select: { id: true, isSystem: true } });

  if (!role) {
    throw new Error("Role not found.");
  }

  if (role.isSystem) {
    throw new Error("System roles cannot be deleted.");
  }

  await prisma.role.delete({ where: { id: roleId } });
}

export async function assignRoleToUserService(userId: string, roleId: string) {
  const [role, user] = await Promise.all([
    prisma.role.findUnique({ where: { id: roleId }, select: { id: true, name: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, role: true } }),
  ]);

  if (!role || !user) {
    throw new Error("User or role not found.");
  }

  if (user.role === UserRole.CANDIDATE) {
    throw new Error("Learner accounts cannot receive staff roles.");
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { roleId: role.id },
    select: { id: true, email: true, name: true, roleId: true },
  });

  await sendWelcomeEmail({ email: user.email, name: user.name });

  return updatedUser;
}

export async function getSuperAdminDashboardStatsService() {
  const [totalStaffUsers, totalRoles, totalPermissionsConfigured] = await Promise.all([
    prisma.user.count({
      where: {
        role: {
          in: [UserRole.ADMIN, UserRole.TRAINER],
        },
      },
    }),
    prisma.role.count(),
    prisma.permission.count(),
  ]);

  return { totalStaffUsers, totalRoles, totalPermissionsConfigured };
}

export async function getStaffRoleAssignmentDataService(): Promise<{
  users: StaffRoleAssignmentUser[];
  roles: StaffRoleOption[];
}> {
  const [users, roles] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: {
          in: [UserRole.ADMIN, UserRole.TRAINER],
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        trainerProfile: {
          select: {
            specialization: true,
          },
        },
        staffRole: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
    prisma.role.findMany({
      select: {
        id: true,
        name: true,
        isSystem: true,
        _count: {
          select: {
            permissions: true,
          },
        },
      },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    }),
  ]);

  return {
    users: users
      .filter((user) => user.staffRole?.name !== "superadmin")
      .map((user) => ({
        userId: user.id,
        fullName: user.name,
        email: user.email,
        accountType: user.role === UserRole.ADMIN ? "ADMIN" : "TRAINER",
        isActive: user.isActive,
        specialization: user.trainerProfile?.specialization ?? null,
        currentRoleId: user.staffRole?.id ?? null,
        currentRoleName: user.staffRole?.name ?? null,
      })),
    roles: roles.map((role) => ({
      id: role.id,
      name: role.name,
      isSystem: role.isSystem,
      permissionsCount: role._count.permissions,
    })),
  };
}