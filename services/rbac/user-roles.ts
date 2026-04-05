import { prisma } from "@/lib/prisma-client";
import { invalidateUserPermissionCache } from "@/services/rbac/permissions";

export async function assignRolesToUser(userId: string, roleIds: string[]) {
  await prisma.$transaction(async (tx) => {
    await tx.userRoleAssignment.deleteMany({ where: { userId } });

    if (roleIds.length > 0) {
      await tx.userRoleAssignment.createMany({
        data: roleIds.map((roleId) => ({
          userId,
          roleId,
        })),
        skipDuplicates: true,
      });
    }
  });

  invalidateUserPermissionCache(userId);
}

export async function addRoleToUser(userId: string, roleId: string) {
  await prisma.userRoleAssignment.upsert({
    where: { userId_roleId: { userId, roleId } },
    update: {},
    create: { userId, roleId },
  });

  invalidateUserPermissionCache(userId);
}

export async function removeRoleFromUser(userId: string, roleId: string) {
  await prisma.userRoleAssignment.deleteMany({
    where: { userId, roleId },
  });

  invalidateUserPermissionCache(userId);
}
