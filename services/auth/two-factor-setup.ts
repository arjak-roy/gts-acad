import { Prisma } from "@prisma/client";

import { generateRecoveryCodes, hashSensitiveToken, maskEmail } from "@/lib/auth/two-factor";
import { prisma } from "@/lib/prisma-client";
import {
  ENABLE_2FA_CHALLENGE_PURPOSE,
  createChallenge,
  deliverTwoFactorEmail,
  markInvalidAttempt,
  requireDatabase,
} from "@/services/auth/internal-helpers";

export async function startTwoFactorSetup(userId: string) {
  requireDatabase();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  if (!user) {
    throw new Error("User not found.");
  }

  const challenge = await createChallenge(user.id, ENABLE_2FA_CHALLENGE_PURPOSE);
  await deliverTwoFactorEmail(user, challenge.code, "enable two-factor authentication");

  return {
    maskedEmail: maskEmail(user.email),
    expiresAt: challenge.expiresAt.toISOString(),
  };
}

export async function verifyTwoFactorSetup(userId: string, code: string) {
  requireDatabase();

  const challengeRows = await prisma.$queryRaw<Array<{
    id: string;
    codeHash: string;
    attempts: number;
    maxAttempts: number;
    expiresAt: Date;
  }>>(
    Prisma.sql`
      SELECT
        "challenge_id" AS "id",
        "code_hash" AS "codeHash",
        "attempts" AS "attempts",
        "max_attempts" AS "maxAttempts",
        "expires_at" AS "expiresAt"
      FROM "two_factor_challenges"
      WHERE "user_id" = ${userId}::uuid
        AND "purpose" = ${ENABLE_2FA_CHALLENGE_PURPOSE}
        AND "consumed_at" IS NULL
      ORDER BY "created_at" DESC
      LIMIT 1
    `,
  );

  const [challenge] = challengeRows;

  if (!challenge) {
    throw new Error("Two-factor setup challenge not found.");
  }

  if (challenge.expiresAt.getTime() < Date.now()) {
    throw new Error("Two-factor setup code expired.");
  }

  if (challenge.attempts >= challenge.maxAttempts) {
    throw new Error("Too many invalid verification attempts.");
  }

  if (challenge.codeHash !== hashSensitiveToken(code)) {
    await markInvalidAttempt(challenge.id, challenge.attempts);
    throw new Error("Invalid verification code.");
  }

  const recoveryCodes = generateRecoveryCodes();
  const hashedRecoveryCodes = recoveryCodes.map((recoveryCode) => hashSensitiveToken(recoveryCode));

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "two_factor_challenges"
      SET "consumed_at" = NOW()
      WHERE "challenge_id" = ${challenge.id}::uuid
    `;

    await tx.userSecurity.upsert({
      where: { userId },
      update: {
        twoFactorEnabled: true,
        recoveryCodes: hashedRecoveryCodes,
      },
      create: {
        userId,
        twoFactorEnabled: true,
        recoveryCodes: hashedRecoveryCodes,
      },
    });
  });

  return { recoveryCodes };
}
