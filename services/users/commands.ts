import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import { buildPendingAccountActivationMetadata } from "@/lib/auth/account-metadata";
import { hashPassword } from "@/lib/auth/password";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import type { CreateUserInput, UpdateUserInput } from "@/lib/validation-schemas/users";
import { requestPasswordReset } from "@/services/auth";
import { sendAccountActivationEmail } from "@/services/auth/account-activation";
import { createAuditLogEntry } from "@/services/logs-actions-service";
import { assignRolesToUser, invalidateUserPermissionCache } from "@/services/rbac-service";
import {
  getInternalUserRecord,
  mapRoleRecord,
  mergeMetadata,
  requireDatabase,
  sendInternalUserWelcomeEmail,
  sortRoles,
  updateInternalUserMetadata,
  validateAssignableInternalRoles,
} from "@/services/users/internal-helpers";
import { getUserByIdService } from "@/services/users/queries";
import type { InternalUserDetail } from "@/types";

export async function createInternalUserService(
  input: CreateUserInput,
  actor: { actorUserId?: string; actorRoleCode: string },
): Promise<InternalUserDetail> {
  requireDatabase();

  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedName = input.name.trim();
  const normalizedPhone = input.phone.trim() || null;

  const [existingUser, roles] = await Promise.all([
    prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } }),
    validateAssignableInternalRoles(input.roleIds, actor.actorRoleCode),
  ]);

  if (existingUser) {
    throw new Error("A user account already exists with this email.");
  }

  const temporaryPassword = randomUUID();
  const hashedTemporaryPassword = await hashPassword(temporaryPassword);
  const issuedAt = new Date().toISOString();

  const createdUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: normalizedEmail,
        name: normalizedName,
        phone: normalizedPhone,
        password: hashedTemporaryPassword,
        isActive: true,
        metadata: buildPendingAccountActivationMetadata({
          accountType: "INTERNAL",
          createdFrom: "internal-user-management",
          requiresPasswordReset: true,
          welcomeCredentialsEmailStatus: "pending",
          welcomeCredentialsLastIssuedAt: issuedAt,
        }, issuedAt) as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        email: true,
        name: true,
        metadata: true,
      },
    });

    await tx.userSecurity.create({
      data: {
        userId: user.id,
        twoFactorEnabled: true,
        recoveryCodes: [],
      },
    });

    await tx.userRoleAssignment.createMany({
      data: roles.map((role) => ({ userId: user.id, roleId: role.id })),
      skipDuplicates: true,
    });

    return user;
  });

  try {
    const delivery = await sendInternalUserWelcomeEmail({
      userId: createdUser.id,
      recipientEmail: createdUser.email,
      recipientName: createdUser.name,
      temporaryPassword,
      roles,
      actorUserId: actor.actorUserId,
    });

    await updateInternalUserMetadata(createdUser.id, createdUser.metadata, {
      welcomeCredentialsEmailStatus: delivery.status === "SENT" ? "sent" : "pending",
      ...(delivery.status === "SENT" ? { welcomeCredentialsLastSentAt: new Date().toISOString() } : {}),
      welcomeCredentialsFailureReason: null,
    });
  } catch (error) {
    await updateInternalUserMetadata(createdUser.id, createdUser.metadata, {
      welcomeCredentialsEmailStatus: "failed",
      welcomeCredentialsFailureReason: error instanceof Error ? error.message : "Unknown delivery failure.",
    });
  }

  try {
    await sendAccountActivationEmail(createdUser.id, {
      actorUserId: actor.actorUserId ?? null,
    });
  } catch (error) {
    console.warn("Internal user activation email dispatch failed.", error);
  }

  await createAuditLogEntry({
    entityType: "AUTH",
    entityId: createdUser.id,
    action: "CREATED",
    message: `Internal user ${normalizedEmail} created from user management.`,
    metadata: {
      email: normalizedEmail,
      roles: roles.map((role) => role.code),
    },
    actorUserId: actor.actorUserId ?? null,
  });

  const detail = await getUserByIdService(createdUser.id);
  if (!detail) {
    throw new Error("User not found after creation.");
  }

  return detail;
}

export async function updateInternalUserService(
  userId: string,
  input: UpdateUserInput,
  actorUserId?: string,
): Promise<InternalUserDetail> {
  requireDatabase();

  const user = await getInternalUserRecord(userId);
  if (!user) {
    throw new Error("User not found.");
  }

  const normalizedEmail = input.email?.trim().toLowerCase();

  if (normalizedEmail && normalizedEmail !== user.email.toLowerCase()) {
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser && existingUser.id !== userId) {
      throw new Error("A user account already exists with this email.");
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name?.trim(),
      email: normalizedEmail,
      phone: input.phone !== undefined ? input.phone.trim() || null : undefined,
      isActive: input.isActive,
    },
  });

  if (input.isActive !== undefined) {
    invalidateUserPermissionCache(userId);
  }

  await createAuditLogEntry({
    entityType: "AUTH",
    entityId: userId,
    action: "UPDATED",
    message: `Internal user ${user.email} updated from user management.`,
    metadata: {
      name: input.name?.trim(),
      email: normalizedEmail,
      phone: input.phone?.trim() || null,
      isActive: input.isActive,
    },
    actorUserId: actorUserId ?? null,
  });

  const detail = await getUserByIdService(userId);
  if (!detail) {
    throw new Error("User not found.");
  }

  return detail;
}

export async function assignInternalUserRolesService(
  userId: string,
  roleIds: string[],
  actor: { actorUserId?: string; actorRoleCode: string },
) {
  requireDatabase();

  const user = await getInternalUserRecord(userId);
  if (!user) {
    throw new Error("User not found.");
  }

  const roles = await validateAssignableInternalRoles(roleIds, actor.actorRoleCode);
  await assignRolesToUser(userId, roles.map((role) => role.id));

  await createAuditLogEntry({
    entityType: "AUTH",
    entityId: userId,
    action: "UPDATED",
    message: `Internal user ${user.email} roles updated.`,
    metadata: {
      roles: roles.map((role) => role.code),
    },
    actorUserId: actor.actorUserId ?? null,
  });

  const detail = await getUserByIdService(userId);
  if (!detail) {
    throw new Error("User not found.");
  }

  return detail;
}

export async function resendInternalUserWelcomeService(userId: string, actorUserId?: string) {
  requireDatabase();

  const user = await getInternalUserRecord(userId);
  if (!user) {
    throw new Error("User not found.");
  }

  const roles = sortRoles(user.roleAssignments.map((assignment) => mapRoleRecord(assignment.role)));
  const temporaryPassword = randomUUID();
  const hashedTemporaryPassword = await hashPassword(temporaryPassword);
  const nextMetadata = mergeMetadata(user.metadata, {
    accountType: "INTERNAL",
    requiresPasswordReset: true,
    welcomeCredentialsEmailStatus: "pending",
    welcomeCredentialsLastIssuedAt: new Date().toISOString(),
    welcomeCredentialsFailureReason: null,
  });

  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedTemporaryPassword,
      metadata: nextMetadata as Prisma.InputJsonValue,
    },
  });

  try {
    const delivery = await sendInternalUserWelcomeEmail({
      userId,
      recipientEmail: user.email,
      recipientName: user.name,
      temporaryPassword,
      roles,
      actorUserId,
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        metadata: {
          ...nextMetadata,
          welcomeCredentialsEmailStatus: delivery.status === "SENT" ? "sent" : "pending",
          ...(delivery.status === "SENT" ? { welcomeCredentialsLastSentAt: new Date().toISOString() } : {}),
          welcomeCredentialsFailureReason: null,
        } as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        metadata: {
          ...nextMetadata,
          welcomeCredentialsEmailStatus: "failed",
          welcomeCredentialsFailureReason: error instanceof Error ? error.message : "Unknown delivery failure.",
        } as Prisma.InputJsonValue,
      },
    });
  }

  try {
    await sendAccountActivationEmail(userId, {
      actorUserId: actorUserId ?? null,
    });
  } catch (error) {
    console.warn("Internal user activation email re-issue failed.", error);
  }

  await createAuditLogEntry({
    entityType: "AUTH",
    entityId: userId,
    action: "UPDATED",
    message: `Welcome credentials re-issued for ${user.email}.`,
    actorUserId: actorUserId ?? null,
  });

  const detail = await getUserByIdService(userId);
  if (!detail) {
    throw new Error("User not found.");
  }

  return detail;
}

export async function sendInternalUserPasswordResetService(userId: string, actorUserId?: string) {
  requireDatabase();

  const user = await getInternalUserRecord(userId);
  if (!user) {
    throw new Error("User not found.");
  }

  await requestPasswordReset(user.email, {});

  await createAuditLogEntry({
    entityType: "AUTH",
    entityId: userId,
    action: "UPDATED",
    message: `Admin password reset requested for ${user.email}.`,
    actorUserId: actorUserId ?? null,
  });

  return {
    ok: true,
  };
}