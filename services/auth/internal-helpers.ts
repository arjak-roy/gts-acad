import { randomBytes } from "node:crypto";

import { Prisma } from "@prisma/client";

import { requiresPasswordResetFromMetadata } from "@/lib/auth/account-metadata";
import { prisma, isDatabaseConfigured } from "@/lib/prisma-client";
import {
  generateEmailOtpCode,
  getTwoFactorCodeTtlMinutes,
  getTwoFactorResendCooldownSeconds,
  hashSensitiveToken,
  maskEmail,
} from "@/lib/auth/two-factor";
import {
  INTERNAL_USER_PASSWORD_CHANGED_EMAIL_TEMPLATE_KEY,
  PASSWORD_RESET_EMAIL_TEMPLATE_KEY,
  TWO_FACTOR_EMAIL_TEMPLATE_KEY,
} from "@/lib/mail-templates/email-template-defaults";
import { renderEmailTemplateByKeyService } from "@/services/email-templates";
import { deliverLoggedEmail } from "@/services/logs-actions-service";
import { getUserPrimaryRoleCode } from "@/services/rbac-service";
import { getGeneralRuntimeSettings } from "@/services/settings/runtime";

export const LOGIN_CHALLENGE_PURPOSE = "LOGIN";
export const ENABLE_2FA_CHALLENGE_PURPOSE = "ENABLE_2FA";
const DEFAULT_PASSWORD_RESET_TOKEN_TTL_MINUTES = 30;
const DEFAULT_PASSWORD_RESET_RESEND_COOLDOWN_SECONDS = 60;
export const PASSWORD_RESET_TOKEN_MIN_PASSWORD_LENGTH = 8;

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  requiresPasswordReset: boolean;
  security: {
    id: string;
    twoFactorEnabled: boolean;
    recoveryCodes: string[];
  } | null;
};

export type LoginResult =
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

export type ChallengeRecord = {
  id: string;
  codeHash: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  sentAt: Date;
  consumedAt: Date | null;
  user: AuthUser;
};

export type PasswordResetTokenRecord = {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  tokenHash: string;
  expiresAt: Date;
  sentAt: Date;
  consumedAt: Date | null;
};

export type PasswordResetRequestMetadata = {
  requestIp?: string | null;
  userAgent?: string | null;
  appOrigin?: string | null;
};

export function requireDatabase() {
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

export function getPasswordResetTokenTtlMinutes() {
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

function normalizeOrigin(origin: string | undefined) {
  const normalized = origin?.trim();
  if (!normalized) {
    return null;
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized.replace(/\/$/, "");
  }

  return `https://${normalized}`.replace(/\/$/, "");
}

function getInternalAppBaseUrl(fallbackApplicationUrl?: string | null) {
  return (
    normalizeOrigin(process.env.INTERNAL_APP_ORIGIN) ??
    normalizeOrigin(process.env.NEXT_PUBLIC_INTERNAL_APP_ORIGIN) ??
    normalizeOrigin(process.env.AUTH_PASSWORD_RESET_URL_BASE) ??
    normalizeOrigin(fallbackApplicationUrl ?? undefined) ??
    normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL)
  );
}

function getPasswordResetUrlBase(isInternalUser: boolean, appOrigin?: string | null, fallbackApplicationUrl?: string | null) {
  const normalizedAppOrigin = normalizeOrigin(appOrigin ?? undefined);

  if (isInternalUser) {
    return normalizedAppOrigin ?? getInternalAppBaseUrl(fallbackApplicationUrl);
  }

  return (
    normalizedAppOrigin ??
    normalizeOrigin(process.env.AUTH_PASSWORD_RESET_URL_BASE) ??
    normalizeOrigin(process.env.CANDIDATE_APP_ORIGIN) ??
    normalizeOrigin(process.env.NEXT_PUBLIC_CANDIDATE_APP_ORIGIN) ??
    normalizeOrigin(fallbackApplicationUrl ?? undefined) ??
    normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL)
  );
}

function buildPasswordResetUrl(
  resetToken: string,
  isInternalUser: boolean,
  appOrigin?: string | null,
  fallbackApplicationUrl?: string | null,
) {
  const urlBase = getPasswordResetUrlBase(isInternalUser, appOrigin, fallbackApplicationUrl);

  if (!urlBase) {
    return null;
  }

  try {
    const url = new URL(urlBase);
    url.pathname = "/reset-password";
    url.search = "";
    url.searchParams.set("token", resetToken);
    return url.toString();
  } catch {
    return null;
  }
}

function buildInternalLoginUrl(fallbackApplicationUrl?: string | null) {
  const baseUrl = getInternalAppBaseUrl(fallbackApplicationUrl);
  if (!baseUrl) {
    return null;
  }

  return `${baseUrl}/login`;
}

function generatePasswordResetToken() {
  return randomBytes(32).toString("hex").toUpperCase();
}

export async function getUserByEmail(email: string) {
  return prisma.user.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      emailVerifiedAt: true,
      password: true,
      metadata: true,
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

export async function getPasswordResetUserByEmail(email: string) {
  return prisma.user.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      metadata: true,
    },
  });
}

export async function deliverTwoFactorEmail(user: Pick<AuthUser, "email" | "name">, code: string, purposeLabel: string) {
  const generalSettings = await getGeneralRuntimeSettings();

  const template = await renderEmailTemplateByKeyService(TWO_FACTOR_EMAIL_TEMPLATE_KEY, {
    appName: generalSettings.applicationName,
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

export async function deliverPasswordResetEmail(
  user: Pick<AuthUser, "id" | "email" | "name">,
  resetToken: string,
  isInternalUser: boolean,
  appOrigin?: string | null,
) {
  const generalSettings = await getGeneralRuntimeSettings();
  const resetUrl = buildPasswordResetUrl(resetToken, isInternalUser, appOrigin, generalSettings.applicationUrl);

  if (!resetUrl) {
    throw new Error("Password reset URL is not configured.");
  }

  const template = await renderEmailTemplateByKeyService(PASSWORD_RESET_EMAIL_TEMPLATE_KEY, {
    appName: generalSettings.applicationName,
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

export async function deliverInternalPasswordChangedEmail(user: Pick<AuthUser, "id" | "email" | "name">, changedAt: string) {
  const generalSettings = await getGeneralRuntimeSettings();
  const loginUrl = buildInternalLoginUrl(generalSettings.applicationUrl);

  const template = await renderEmailTemplateByKeyService(INTERNAL_USER_PASSWORD_CHANGED_EMAIL_TEMPLATE_KEY, {
    appName: generalSettings.applicationName,
    recipientName: user.name,
    loginUrl: loginUrl ?? "",
    supportEmail: generalSettings.supportEmail,
    changedAt,
  });

  await deliverLoggedEmail({
    to: user.email,
    subject: template.subject,
    text: template.text,
    html: template.html,
    category: "SYSTEM",
    templateKey: INTERNAL_USER_PASSWORD_CHANGED_EMAIL_TEMPLATE_KEY,
    metadata: {
      purpose: "internal-password-changed",
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

export async function createPasswordResetToken(userId: string, metadata: PasswordResetRequestMetadata = {}) {
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

export async function getPasswordResetTokenRecord(resetToken: string) {
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
  userMetadata: Prisma.JsonValue | null;
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
      role: "",
      requiresPasswordReset: requiresPasswordResetFromMetadata(row.userMetadata),
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

export async function createChallenge(userId: string, purpose: string) {
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

export async function consumeChallenge(challengeId: string) {
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE "two_factor_challenges"
      SET "consumed_at" = NOW()
      WHERE "challenge_id" = ${challengeId}::uuid
    `,
  );
}

export async function validateChallenge(userId: string, challengeId: string, purpose: string) {
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
    userMetadata: Prisma.JsonValue | null;
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
        u."metadata" AS "userMetadata",
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

export async function markInvalidAttempt(challengeId: string, attempts: number) {
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE "two_factor_challenges"
      SET "attempts" = ${attempts + 1}
      WHERE "challenge_id" = ${challengeId}::uuid
    `,
  );
}

export async function finalizeLogin(userId: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
    select: {
      id: true,
      email: true,
      name: true,
      metadata: true,
      security: {
        select: {
          id: true,
          twoFactorEnabled: true,
          recoveryCodes: true,
        },
      },
    },
  });

  const role = await getUserPrimaryRoleCode(userId);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role,
    requiresPasswordReset: requiresPasswordResetFromMetadata(user.metadata),
    security: user.security,
  };
}

export { getTwoFactorResendCooldownSeconds, hashSensitiveToken, maskEmail };
