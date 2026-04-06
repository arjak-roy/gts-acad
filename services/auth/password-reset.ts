import { Prisma } from "@prisma/client";

import { buildCompletedPasswordResetMetadata, isInternalAccount } from "@/lib/auth/account-metadata";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { assertPasswordPolicy } from "@/lib/auth/password-policy";
import { prisma } from "@/lib/prisma-client";
import { createAuditLogEntry } from "@/services/logs-actions-service";
import {
  PasswordResetRequestMetadata,
  createPasswordResetToken,
  deliverInternalPasswordChangedEmail,
  deliverPasswordResetEmail,
  getPasswordResetTokenRecord,
  getPasswordResetUserByEmail,
  maskEmail,
  requireDatabase,
} from "@/services/auth/internal-helpers";

export async function requestPasswordReset(email: string, metadata: PasswordResetRequestMetadata = {}) {
  requireDatabase();

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error("Valid email is required.");
  }

  const user = await getPasswordResetUserByEmail(normalizedEmail);
  if (!user) {
    return;
  }

  const resetToken = await createPasswordResetToken(user.id, metadata);
  if (!resetToken) {
    return;
  }

  await deliverPasswordResetEmail(user, resetToken, isInternalAccount(user.metadata), metadata.appOrigin);
}

export async function resetPasswordWithToken(resetToken: string, nextPassword: string) {
  requireDatabase();

  const normalizedToken = resetToken.trim();
  const normalizedPassword = nextPassword.trim();

  if (!normalizedToken) {
    throw new Error("Password reset token is required.");
  }

  await assertPasswordPolicy(normalizedPassword);

  const tokenRecord = await getPasswordResetTokenRecord(normalizedToken);
  const passwordResetUser = await prisma.user.findUnique({
    where: { id: tokenRecord.userId },
    select: {
      metadata: true,
      email: true,
      name: true,
    },
  });

  if (!passwordResetUser) {
    throw new Error("User not found.");
  }

  const nextPasswordHash = await hashPassword(normalizedPassword);
  const completedAt = new Date().toISOString();
  const isInternalUser = isInternalAccount(passwordResetUser.metadata);
  const invalidatedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: tokenRecord.userId },
      data: {
        password: nextPasswordHash,
        metadata: buildCompletedPasswordResetMetadata(passwordResetUser.metadata, completedAt) as Prisma.InputJsonValue,
      },
    });

    await tx.userSecurity.upsert({
      where: { userId: tokenRecord.userId },
      update: {
        failedLoginAttempts: 0,
        loginLockedUntil: null,
        lastFailedLoginAt: null,
        passwordChangedAt: invalidatedAt,
        sessionInvalidatedAt: invalidatedAt,
      },
      create: {
        userId: tokenRecord.userId,
        recoveryCodes: [],
        failedLoginAttempts: 0,
        loginLockedUntil: null,
        lastFailedLoginAt: null,
        passwordChangedAt: invalidatedAt,
        sessionInvalidatedAt: invalidatedAt,
      },
    });

    await tx.userSession.updateMany({
      where: {
        userId: tokenRecord.userId,
        revokedAt: null,
      },
      data: {
        revokedAt: invalidatedAt,
        revokedReason: "password-reset",
      },
    });

    await tx.$executeRaw(
      Prisma.sql`
        UPDATE "password_reset_tokens"
        SET "consumed_at" = NOW()
        WHERE "user_id" = ${tokenRecord.userId}::uuid
          AND "consumed_at" IS NULL
      `,
    );

    await tx.$executeRaw(
      Prisma.sql`
        UPDATE "two_factor_challenges"
        SET "consumed_at" = NOW()
        WHERE "user_id" = ${tokenRecord.userId}::uuid
          AND "consumed_at" IS NULL
      `,
    );
  });

  if (isInternalUser) {
    try {
      await deliverInternalPasswordChangedEmail(
        {
          id: tokenRecord.userId,
          email: passwordResetUser.email,
          name: passwordResetUser.name,
        },
        completedAt,
      );
    } catch (error) {
      console.warn("Internal password-changed notification failed.", error);
    }
  }

  try {
    await createAuditLogEntry({
      entityType: "AUTH",
      entityId: tokenRecord.userId,
      action: "UPDATED",
      status: "PASSWORD_RESET",
      message: `Password reset completed for ${maskEmail(tokenRecord.userEmail)}.`,
      metadata: {
        reason: "password-reset-token",
      },
    });
  } catch (error) {
    console.warn("Password reset audit logging failed.", error);
  }
}

export async function changeAuthenticatedPassword(userId: string, currentPassword: string, nextPassword: string) {
  requireDatabase();

  const normalizedCurrentPassword = currentPassword.trim();
  const normalizedNextPassword = nextPassword.trim();

  if (!normalizedCurrentPassword) {
    throw new Error("Current password is required.");
  }

  await assertPasswordPolicy(normalizedNextPassword);

  if (normalizedCurrentPassword === normalizedNextPassword) {
    throw new Error("New password must be different from the current password.");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      password: true,
      metadata: true,
    },
  });

  if (!user) {
    throw new Error("User not found.");
  }

  const passwordCheck = await verifyPassword(normalizedCurrentPassword, user.password);
  if (!passwordCheck.isValid) {
    throw new Error("Current password is invalid.");
  }

  const nextPasswordHash = await hashPassword(normalizedNextPassword);
  const completedAt = new Date().toISOString();
  const invalidatedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        password: nextPasswordHash,
        metadata: buildCompletedPasswordResetMetadata(user.metadata, completedAt) as Prisma.InputJsonValue,
      },
    });

    await tx.userSecurity.upsert({
      where: { userId },
      update: {
        failedLoginAttempts: 0,
        loginLockedUntil: null,
        lastFailedLoginAt: null,
        passwordChangedAt: invalidatedAt,
        sessionInvalidatedAt: invalidatedAt,
      },
      create: {
        userId,
        recoveryCodes: [],
        failedLoginAttempts: 0,
        loginLockedUntil: null,
        lastFailedLoginAt: null,
        passwordChangedAt: invalidatedAt,
        sessionInvalidatedAt: invalidatedAt,
      },
    });

    await tx.userSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: invalidatedAt,
        revokedReason: "password-changed",
      },
    });
  });

  await createAuditLogEntry({
    entityType: "AUTH",
    entityId: userId,
    action: "UPDATED",
    status: "PASSWORD_CHANGED",
    message: `Authenticated password change completed for ${maskEmail(user.email)}.`,
    metadata: {
      reason: "authenticated-password-change",
    },
  });
}
