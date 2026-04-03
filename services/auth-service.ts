import "server-only";

import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";

import { prisma, isDatabaseConfigured } from "@/lib/prisma-client";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  generateEmailOtpCode,
  generateRecoveryCodes,
  getTwoFactorCodeTtlMinutes,
  getTwoFactorResendCooldownSeconds,
  hashSensitiveToken,
  maskEmail,
} from "@/lib/auth/two-factor";
import { PASSWORD_RESET_EMAIL_TEMPLATE_KEY, TWO_FACTOR_EMAIL_TEMPLATE_KEY } from "@/lib/mail-templates/email-template-defaults";
import { renderEmailTemplateByKeyService } from "@/services/email-templates-service";
import { createAuditLogEntry, deliverLoggedEmail } from "@/services/logs-actions-service";

const LOGIN_CHALLENGE_PURPOSE = "LOGIN";
const ENABLE_2FA_CHALLENGE_PURPOSE = "ENABLE_2FA";
const DEFAULT_PASSWORD_RESET_TOKEN_TTL_MINUTES = 30;
const DEFAULT_PASSWORD_RESET_RESEND_COOLDOWN_SECONDS = 60;
const PASSWORD_RESET_TOKEN_MIN_PASSWORD_LENGTH = 8;

type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  security: {
    id: string;
    twoFactorEnabled: boolean;
    recoveryCodes: string[];
  } | null;
};

type LoginResult =
  | {
      status: "authenticated";
      user: AuthUser;
    }
  | {
      status: "two-factor-required";
      user: AuthUser;
      challengeId: string;
      maskedEmail: string;
    };

type ChallengeRecord = {
  id: string;
  codeHash: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  sentAt: Date;
  consumedAt: Date | null;
  user: AuthUser;
};

type PasswordResetTokenRecord = {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  tokenHash: string;
  expiresAt: Date;
  sentAt: Date;
  consumedAt: Date | null;
};

type PasswordResetRequestMetadata = {
  requestIp?: string | null;
  userAgent?: string | null;
};

function requireDatabase() {
  if (!isDatabaseConfigured) {
    throw new Error("Authentication requires database configuration.");
  }
}

function parsePositiveInteger(rawValue: string | undefined, fallbackValue: number, minimumValue: number, maximumValue: number) {
  if (!rawValue) {
    return fallbackValue;
  }

  const parsedValue = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsedValue)) {
    return fallbackValue;
  }

  return Math.min(Math.max(parsedValue, minimumValue), maximumValue);
}

function getPasswordResetTokenTtlMinutes() {
  return parsePositiveInteger(process.env.AUTH_PASSWORD_RESET_TOKEN_TTL_MINUTES, DEFAULT_PASSWORD_RESET_TOKEN_TTL_MINUTES, 5, 240);
}

function getPasswordResetResendCooldownSeconds() {
  return parsePositiveInteger(
    process.env.AUTH_PASSWORD_RESET_RESEND_COOLDOWN_SECONDS,
    DEFAULT_PASSWORD_RESET_RESEND_COOLDOWN_SECONDS,
    15,
    3600,
  );
}

function getPasswordResetUrlBase() {
  const candidateOrigin = process.env.AUTH_PASSWORD_RESET_URL_BASE?.trim();
  if (candidateOrigin) {
    return candidateOrigin.replace(/\/$/, "");
  }

  const fallbackOrigin =
    process.env.CANDIDATE_APP_ORIGIN?.trim() ?? process.env.NEXT_PUBLIC_CANDIDATE_APP_ORIGIN?.trim() ?? process.env.NEXT_PUBLIC_APP_URL?.trim();

  return fallbackOrigin ? fallbackOrigin.replace(/\/$/, "") : null;
}

function buildPasswordResetUrl(resetToken: string) {
  const urlBase = getPasswordResetUrlBase();

  if (!urlBase) {
    return null;
  }

  return `${urlBase}/reset-password?token=${encodeURIComponent(resetToken)}`;
}

function generatePasswordResetToken() {
  return randomBytes(32).toString("hex").toUpperCase();
}

async function getUserByEmail(email: string) {
  return prisma.user.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      password: true,
      security: {
        select: {
          id: true,
          twoFactorEnabled: true,
          recoveryCodes: true,
        },
      },
    },
  });
}

async function getPasswordResetUserByEmail(email: string) {
  return prisma.user.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });
}

async function deliverTwoFactorEmail(user: Pick<AuthUser, "email" | "name">, code: string, purposeLabel: string) {
  const template = await renderEmailTemplateByKeyService(TWO_FACTOR_EMAIL_TEMPLATE_KEY, {
    appName: process.env.APP_NAME ?? "GTS Academy App",
    recipientName: user.name,
    code,
    expiresInMinutes: getTwoFactorCodeTtlMinutes(),
    purposeLabel,
  });

  await deliverLoggedEmail({
    to: user.email,
    subject: template.subject,
    text: template.text,
    html: template.html,
    category: "TWO_FACTOR",
    templateKey: TWO_FACTOR_EMAIL_TEMPLATE_KEY,
    audit: {
      entityType: "AUTH",
      entityId: user.email,
    },
  });
}

async function deliverPasswordResetEmail(user: Pick<AuthUser, "id" | "email" | "name">, resetToken: string) {
  const resetUrl = buildPasswordResetUrl(resetToken) ?? "Open the GTS Academy app to continue password reset.";

  const template = await renderEmailTemplateByKeyService(PASSWORD_RESET_EMAIL_TEMPLATE_KEY, {
    appName: process.env.APP_NAME ?? "GTS Academy App",
    recipientName: user.name,
    resetUrl,
    resetToken,
    expiresInMinutes: getPasswordResetTokenTtlMinutes(),
  });

  await deliverLoggedEmail({
    to: user.email,
    subject: template.subject,
    text: template.text,
    html: template.html,
    category: "SYSTEM",
    templateKey: PASSWORD_RESET_EMAIL_TEMPLATE_KEY,
    metadata: {
      purpose: "password-reset",
    },
    audit: {
      entityType: "AUTH",
      entityId: user.id,
    },
  });
}

function mapPasswordResetTokenRows(
  rows: Array<{
    id: string;
    userId: string;
    userEmail: string;
    userName: string;
    tokenHash: string;
    expiresAt: Date;
    sentAt: Date;
    consumedAt: Date | null;
  }>,
) {
  return rows.map(
    (row) =>
      ({
        id: row.id,
        userId: row.userId,
        userEmail: row.userEmail,
        userName: row.userName,
        tokenHash: row.tokenHash,
        expiresAt: row.expiresAt,
        sentAt: row.sentAt,
        consumedAt: row.consumedAt,
      }) satisfies PasswordResetTokenRecord,
  );
}

async function createPasswordResetToken(userId: string, metadata: PasswordResetRequestMetadata = {}) {
  const existingRows = await prisma.$queryRaw<Array<{ sentAt: Date }>>(
    Prisma.sql`
      SELECT "sent_at" AS "sentAt"
      FROM "password_reset_tokens"
      WHERE "user_id" = ${userId}::uuid
        AND "consumed_at" IS NULL
        AND "expires_at" > NOW()
      ORDER BY "created_at" DESC
      LIMIT 1
    `,
  );

  const [existingToken] = existingRows;
  if (existingToken) {
    const cooldownUntil = existingToken.sentAt.getTime() + getPasswordResetResendCooldownSeconds() * 1_000;
    if (cooldownUntil > Date.now()) {
      return null;
    }
  }

  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE "password_reset_tokens"
      SET "consumed_at" = NOW()
      WHERE "user_id" = ${userId}::uuid
        AND "consumed_at" IS NULL
    `,
  );

  const resetToken = generatePasswordResetToken();
  const expiresAt = new Date(Date.now() + getPasswordResetTokenTtlMinutes() * 60_000);

  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO "password_reset_tokens" (
        "user_id",
        "token_hash",
        "expires_at",
        "request_ip",
        "user_agent"
      )
      VALUES (
        ${userId}::uuid,
        ${hashSensitiveToken(resetToken)},
        ${expiresAt},
        ${metadata.requestIp?.slice(0, 64) ?? null},
        ${metadata.userAgent?.slice(0, 255) ?? null}
      )
    `,
  );

  return resetToken;
}

async function getPasswordResetTokenRecord(resetToken: string) {
  const rows = await prisma.$queryRaw<Array<{
    id: string;
    userId: string;
    userEmail: string;
    userName: string;
    tokenHash: string;
    expiresAt: Date;
    sentAt: Date;
    consumedAt: Date | null;
  }>>(
    Prisma.sql`
      SELECT
        t."reset_token_id" AS "id",
        t."user_id" AS "userId",
        u."email" AS "userEmail",
        u."full_name" AS "userName",
        t."token_hash" AS "tokenHash",
        t."expires_at" AS "expiresAt",
        t."sent_at" AS "sentAt",
        t."consumed_at" AS "consumedAt"
      FROM "password_reset_tokens" t
      INNER JOIN "users" u ON u."user_id" = t."user_id"
      WHERE t."token_hash" = ${hashSensitiveToken(resetToken)}
        AND u."is_active" = true
      ORDER BY t."created_at" DESC
      LIMIT 1
    `,
  );

  const [tokenRecord] = mapPasswordResetTokenRows(rows);

  if (!tokenRecord || tokenRecord.consumedAt || tokenRecord.expiresAt.getTime() < Date.now()) {
    throw new Error("Invalid or expired password reset token.");
  }

  return tokenRecord;
}

function mapChallengeRows(rows: Array<{
  id: string;
  codeHash: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  sentAt: Date;
  consumedAt: Date | null;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: string;
  securityId: string | null;
  twoFactorEnabled: boolean | null;
  recoveryCodes: string[] | null;
}>): ChallengeRecord[] {
  return rows.map((row) => ({
    id: row.id,
    codeHash: row.codeHash,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    expiresAt: row.expiresAt,
    sentAt: row.sentAt,
    consumedAt: row.consumedAt,
    user: {
      id: row.userId,
      email: row.userEmail,
      name: row.userName,
      role: row.userRole,
      security: row.securityId
        ? {
            id: row.securityId,
            twoFactorEnabled: row.twoFactorEnabled ?? false,
            recoveryCodes: row.recoveryCodes ?? [],
          }
        : null,
    },
  }));
}

async function createChallenge(userId: string, purpose: string) {
  const code = generateEmailOtpCode();
  const expiresAt = new Date(Date.now() + getTwoFactorCodeTtlMinutes() * 60_000);

  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE "two_factor_challenges"
      SET "consumed_at" = NOW()
      WHERE "user_id" = ${userId}::uuid
        AND "purpose" = ${purpose}
        AND "consumed_at" IS NULL
    `,
  );

  const challengeRows = await prisma.$queryRaw<Array<{ id: string; expiresAt: Date }>>(
    Prisma.sql`
      INSERT INTO "two_factor_challenges" (
        "user_id",
        "purpose",
        "code_hash",
        "expires_at"
      )
      VALUES (
        ${userId}::uuid,
        ${purpose},
        ${hashSensitiveToken(code)},
        ${expiresAt}
      )
      RETURNING
        "challenge_id" AS "id",
        "expires_at" AS "expiresAt"
    `,
  );

  const [challenge] = challengeRows;

  return { id: challenge.id, expiresAt: challenge.expiresAt, code };
}

async function consumeChallenge(challengeId: string) {
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE "two_factor_challenges"
      SET "consumed_at" = NOW()
      WHERE "challenge_id" = ${challengeId}::uuid
    `,
  );
}

async function validateChallenge(userId: string, challengeId: string, purpose: string) {
  const rows = await prisma.$queryRaw<Array<{
    id: string;
    codeHash: string;
    attempts: number;
    maxAttempts: number;
    expiresAt: Date;
    sentAt: Date;
    consumedAt: Date | null;
    userId: string;
    userEmail: string;
    userName: string;
    userRole: string;
    securityId: string | null;
    twoFactorEnabled: boolean | null;
    recoveryCodes: string[] | null;
  }>>(
    Prisma.sql`
      SELECT
        c."challenge_id" AS "id",
        c."code_hash" AS "codeHash",
        c."attempts" AS "attempts",
        c."max_attempts" AS "maxAttempts",
        c."expires_at" AS "expiresAt",
        c."sent_at" AS "sentAt",
        c."consumed_at" AS "consumedAt",
        u."user_id" AS "userId",
        u."email" AS "userEmail",
        u."full_name" AS "userName",
        u."role"::text AS "userRole",
        s."id" AS "securityId",
        s."two_factor_enabled" AS "twoFactorEnabled",
        s."recovery_codes" AS "recoveryCodes"
      FROM "two_factor_challenges" c
      INNER JOIN "users" u ON u."user_id" = c."user_id"
      LEFT JOIN "user_security" s ON s."user_id" = u."user_id"
      WHERE c."challenge_id" = ${challengeId}::uuid
        AND c."user_id" = ${userId}::uuid
        AND c."purpose" = ${purpose}
      LIMIT 1
    `,
  );

  const [challenge] = mapChallengeRows(rows);

  if (!challenge || challenge.consumedAt) {
    throw new Error("Two-factor challenge is no longer valid.");
  }

  if (challenge.expiresAt.getTime() < Date.now()) {
    throw new Error("Two-factor code expired.");
  }

  if (challenge.attempts >= challenge.maxAttempts) {
    throw new Error("Too many invalid verification attempts.");
  }

  return challenge;
}

async function markInvalidAttempt(challengeId: string, attempts: number) {
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE "two_factor_challenges"
      SET "attempts" = ${attempts + 1}
      WHERE "challenge_id" = ${challengeId}::uuid
    `,
  );
}

async function finalizeLogin(userId: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      security: {
        select: {
          id: true,
          twoFactorEnabled: true,
          recoveryCodes: true,
        },
      },
    },
  });

  return user;
}

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

  const requiresTwoFactor = user.security?.twoFactorEnabled ?? true;

  if (!requiresTwoFactor) {
    return {
      status: "authenticated",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
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
      role: user.role,
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

    await tx.$executeRaw(
      Prisma.sql`
        UPDATE "two_factor_challenges"
        SET "consumed_at" = NOW()
        WHERE "challenge_id" = ${challenge.id}::uuid
      `,
    );
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
    await tx.$executeRaw(
      Prisma.sql`
        UPDATE "two_factor_challenges"
        SET "consumed_at" = NOW()
        WHERE "challenge_id" = ${challenge.id}::uuid
      `,
    );

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

export async function sendDemoTwoFactorMail(recipient: string) {
  const to = recipient.trim() || process.env.ADMIN_MAIL;
  if (!to) {
    throw new Error("Demo recipient email is not configured.");
  }

  const template = await renderEmailTemplateByKeyService(TWO_FACTOR_EMAIL_TEMPLATE_KEY, {
    appName: process.env.APP_NAME ?? "GTS Academy App",
    recipientName: "Demo Recipient",
    code: generateEmailOtpCode(),
    expiresInMinutes: getTwoFactorCodeTtlMinutes(),
    purposeLabel: "preview the email template",
  });

  await deliverLoggedEmail({
    to,
    subject: template.subject,
    text: template.text,
    html: template.html,
    category: "TWO_FACTOR",
    templateKey: TWO_FACTOR_EMAIL_TEMPLATE_KEY,
    audit: {
      entityType: "SYSTEM",
      entityId: "demo-two-factor-mail",
    },
  });
}
