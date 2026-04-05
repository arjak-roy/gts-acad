import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  LOGIN_CHALLENGE_PURPOSE,
  LoginResult,
  createChallenge,
  consumeChallenge,
  deliverTwoFactorEmail,
  finalizeLogin,
  getTwoFactorResendCooldownSeconds,
  getUserByEmail,
  hashSensitiveToken,
  markInvalidAttempt,
  maskEmail,
  requireDatabase,
  validateChallenge,
} from "@/services/auth/internal-helpers";
import { prisma } from "@/lib/prisma-client";

export async function loginWithPassword(email: string, password: string): Promise<LoginResult> {
  requireDatabase();

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();

  if (!normalizedEmail || !normalizedPassword) {
    throw new Error("Email and password are required.");
  }

  const user = await getUserByEmail(normalizedEmail);
  if (!user) {
    throw new Error("Invalid email or password.");
  }

  const passwordCheck = await verifyPassword(normalizedPassword, user.password);
  if (!passwordCheck.isValid) {
    throw new Error("Invalid email or password.");
  }

  if (passwordCheck.needsUpgrade) {
    await prisma.user.update({
      where: { id: user.id },
      data: { password: await hashPassword(normalizedPassword) },
    });
  }

  // Require a second factor for interactive logins by default.
  const requiresTwoFactor = true;

  const userRole = (await finalizeLogin(user.id)).role;

  if (!requiresTwoFactor) {
    return {
      status: "authenticated",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: userRole,
        security: user.security,
      },
    };
  }

  const challenge = await createChallenge(user.id, LOGIN_CHALLENGE_PURPOSE);
  await deliverTwoFactorEmail(user, challenge.code, "complete your sign in");

  return {
    status: "two-factor-required",
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: userRole,
      security: user.security,
    },
    challengeId: challenge.id,
    maskedEmail: maskEmail(user.email),
  };
}

export async function verifyLoginTwoFactor(userId: string, challengeId: string, code: string) {
  requireDatabase();

  const challenge = await validateChallenge(userId, challengeId, LOGIN_CHALLENGE_PURPOSE);
  if (challenge.codeHash !== hashSensitiveToken(code)) {
    await markInvalidAttempt(challenge.id, challenge.attempts);
    throw new Error("Invalid verification code.");
  }

  await consumeChallenge(challenge.id);
  return finalizeLogin(userId);
}

export async function verifyRecoveryCode(userId: string, challengeId: string, recoveryCode: string) {
  requireDatabase();

  const challenge = await validateChallenge(userId, challengeId, LOGIN_CHALLENGE_PURPOSE);
  const userSecurity = challenge.user.security;

  if (!userSecurity || userSecurity.recoveryCodes.length === 0) {
    throw new Error("Recovery codes are not configured for this account.");
  }

  const normalizedRecoveryCode = recoveryCode.trim().toUpperCase();
  const hashedRecoveryCode = hashSensitiveToken(normalizedRecoveryCode);
  const recoveryCodeIndex = userSecurity.recoveryCodes.findIndex((storedCode: string) => storedCode === hashedRecoveryCode);

  if (recoveryCodeIndex === -1) {
    await markInvalidAttempt(challenge.id, challenge.attempts);
    throw new Error("Invalid recovery code.");
  }

  const remainingRecoveryCodes = userSecurity.recoveryCodes.filter((_: string, index: number) => index !== recoveryCodeIndex);

  await prisma.$transaction(async (tx) => {
    await tx.userSecurity.update({
      where: { id: userSecurity.id },
      data: { recoveryCodes: remainingRecoveryCodes },
    });

    await tx.$executeRaw`
      UPDATE "two_factor_challenges"
      SET "consumed_at" = NOW()
      WHERE "challenge_id" = ${challenge.id}::uuid
    `;
  });

  return finalizeLogin(userId);
}

export async function resendLoginTwoFactor(userId: string, challengeId: string) {
  requireDatabase();

  const challenge = await validateChallenge(userId, challengeId, LOGIN_CHALLENGE_PURPOSE);
  const waitUntil = challenge.sentAt.getTime() + getTwoFactorResendCooldownSeconds() * 1_000;

  if (waitUntil > Date.now()) {
    throw new Error("Please wait before requesting a new verification code.");
  }

  const nextChallenge = await createChallenge(userId, LOGIN_CHALLENGE_PURPOSE);
  await deliverTwoFactorEmail(challenge.user, nextChallenge.code, "complete your sign in");

  return {
    challengeId: nextChallenge.id,
    maskedEmail: maskEmail(challenge.user.email),
  };
}
