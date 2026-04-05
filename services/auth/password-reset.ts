import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma-client";
import { createAuditLogEntry } from "@/services/logs-actions-service";
import {
  PASSWORD_RESET_TOKEN_MIN_PASSWORD_LENGTH,
  PasswordResetRequestMetadata,
  createPasswordResetToken,
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

  await deliverPasswordResetEmail(user, resetToken);
}

export async function resetPasswordWithToken(resetToken: string, nextPassword: string) {
  requireDatabase();

  const normalizedToken = resetToken.trim();
  const normalizedPassword = nextPassword.trim();

  if (!normalizedToken) {
    throw new Error("Password reset token is required.");
  }

  if (normalizedPassword.length < PASSWORD_RESET_TOKEN_MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${PASSWORD_RESET_TOKEN_MIN_PASSWORD_LENGTH} characters long.`);
  }

  const tokenRecord = await getPasswordResetTokenRecord(normalizedToken);
  const nextPasswordHash = await hashPassword(normalizedPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: tokenRecord.userId },
      data: {
        password: nextPasswordHash,
      },
    });

    await tx.userSecurity.upsert({
      where: { userId: tokenRecord.userId },
      update: {
        passwordChangedAt: new Date(),
      },
      create: {
        userId: tokenRecord.userId,
        recoveryCodes: [],
        passwordChangedAt: new Date(),
      },
    });

    await tx.$executeRaw`
      UPDATE "password_reset_tokens"
      SET "consumed_at" = NOW()
      WHERE "user_id" = ${tokenRecord.userId}::uuid
        AND "consumed_at" IS NULL
    `;

    await tx.$executeRaw`
      UPDATE "two_factor_challenges"
      SET "consumed_at" = NOW()
      WHERE "user_id" = ${tokenRecord.userId}::uuid
        AND "consumed_at" IS NULL
    `;
  });

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
