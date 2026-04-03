import "server-only";

import { UserRole } from "@prisma/client";

import { ASSIGNABLE_STAFF_MODULES, getModulePermissionName, type AssignableStaffModuleKey } from "@/lib/auth/module-access";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import type { ManagedAccessUser } from "@/types";

function requireDatabase() {
  if (!isDatabaseConfigured) {
    throw new Error("Access control requires database configuration.");
  }
}

export async function listManagedAccessUsers(): Promise<ManagedAccessUser[]> {
  requireDatabase();

  const users = await prisma.user.findMany({
    where: {
      role: {
        in: [UserRole.ADMIN, UserRole.TRAINER],
      },
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
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
          name: true,
        },
      },
      directPermissions: {
        select: {
          permission: {
            select: {
              key: true,
            },
          },
        },
      },
    },
  });

  return users
    .filter((user) => user.staffRole?.name !== "superadmin")
    .map((user) => {
      const role: ManagedAccessUser["role"] = user.role === UserRole.ADMIN ? "ADMIN" : "TRAINER";

      return {
        userId: user.id,
        fullName: user.name,
        email: user.email,
        role,
        isActive: user.isActive,
        specialization: user.trainerProfile?.specialization ?? null,
        modules: ASSIGNABLE_STAFF_MODULES.filter((module) =>
          user.directPermissions.some((assignment) => assignment.permission.key === module.permissionName),
        ).map((module) => module.key),
      } satisfies ManagedAccessUser;
    });
}

export async function assignUserModulePermissions(userId: string, modules: AssignableStaffModuleKey[]) {
  requireDatabase();

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      staffRole: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!targetUser) {
    throw new Error("User not found.");
  }

  if (targetUser.staffRole?.name === "superadmin") {
    throw new Error("Super Admin access cannot be scoped here.");
  }

  if (targetUser.role !== UserRole.ADMIN && targetUser.role !== UserRole.TRAINER) {
    throw new Error("Only admin and trainer users can receive module access.");
  }

  const permissionNames = modules.map((moduleKey) => getModulePermissionName(moduleKey)).filter(Boolean);
  const permissions = await prisma.permission.findMany({
    where: {
      key: {
        in: permissionNames,
      },
    },
    select: {
      id: true,
      key: true,
      module: true,
    },
  });

  if (permissions.length !== permissionNames.length) {
    throw new Error("Module permissions are not seeded correctly.");
  }

  const permissionIds = permissions.map((permission) => permission.id);

  await prisma.$transaction(async (tx) => {
    await tx.userPermission.deleteMany({
      where: {
        userId,
        permission: {
          module: {
            in: ASSIGNABLE_STAFF_MODULES.map((module) => module.permissionName.split(":")[0]),
          },
        },
      },
    });

    if (permissionIds.length === 0) {
      return;
    }

    await tx.userPermission.createMany({
      data: permissionIds.map((permissionId) => ({
        userId,
        permissionId,
      })),
      skipDuplicates: true,
    });
  });

  return listManagedAccessUsers().then((users) => users.find((user) => user.userId === userId) ?? null);
}