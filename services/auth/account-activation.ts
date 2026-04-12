import "server-only";

import { randomBytes } from "node:crypto";

import { Prisma } from "@prisma/client";

import {
  buildActivationEmailFailedMetadata,
  buildActivationEmailQueuedMetadata,
  buildActivationEmailSentMetadata,
  buildCompletedAccountActivationMetadata,
  isAccountActivationRequired,
  isInternalAccount,
} from "@/lib/auth/account-metadata";
import { hashSensitiveToken } from "@/lib/auth/two-factor";
import { ACCOUNT_ACTIVATION_EMAIL_TEMPLATE_KEY } from "@/lib/mail-templates/email-template-defaults";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { clearUserLoginLockoutWithClient } from "@/services/auth/login-lockout";
import { renderEmailTemplateByKeyService } from "@/services/email-templates";
import { createAuditLogEntry, deliverLoggedEmail } from "@/services/logs-actions-service";
import { getGeneralRuntimeSettings } from "@/services/settings/runtime";

const DEFAULT_ACTIVATION_TOKEN_TTL_HOURS = 72;
const DEFAULT_ACTIVATION_RESEND_COOLDOWN_SECONDS = 60;
export const ACCOUNT_ACTIVATION_REQUIRED_ERROR_MESSAGE = "Account activation required. Check your email for the activation link.";

type ActivationEmailOptions = {
  actorUserId?: string | null;
  appOrigin?: string | null;
};

export class AccountActivationRequiredError extends Error {
  constructor() {
    super(ACCOUNT_ACTIVATION_REQUIRED_ERROR_MESSAGE);
    this.name = "AccountActivationRequiredError";
  }
}

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

function getActivationTokenTtlHours() {
  return parsePositiveInteger(process.env.AUTH_ACTIVATION_TOKEN_TTL_HOURS, DEFAULT_ACTIVATION_TOKEN_TTL_HOURS, 1, 168);
}

function getActivationResendCooldownSeconds() {
  return parsePositiveInteger(
    process.env.AUTH_ACTIVATION_RESEND_COOLDOWN_SECONDS,
    DEFAULT_ACTIVATION_RESEND_COOLDOWN_SECONDS,
    15,
    3600,
  );
}

function normalizeOrigin(origin: string | undefined | null) {
  const normalized = origin?.trim();
  if (!normalized) {
    return null;
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized.replace(/\/$/, "");
  }

  return `https://${normalized}`.replace(/\/$/, "");
}

function getActivationAppBaseUrl(appOrigin?: string | null, fallbackApplicationUrl?: string | null) {
  return (
    normalizeOrigin(appOrigin) ??
    normalizeOrigin(process.env.INTERNAL_APP_ORIGIN) ??
    normalizeOrigin(process.env.NEXT_PUBLIC_INTERNAL_APP_ORIGIN) ??
    normalizeOrigin(fallbackApplicationUrl ?? undefined) ??
    normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL) ??
    normalizeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
    normalizeOrigin(process.env.VERCEL_URL)
  );
}

function getLoginUrlForUser(metadataValue: Prisma.JsonValue | null | undefined, fallbackApplicationUrl?: string | null) {
  const internalLoginBase =
    normalizeOrigin(process.env.INTERNAL_APP_ORIGIN) ??
    normalizeOrigin(process.env.NEXT_PUBLIC_INTERNAL_APP_ORIGIN) ??
    normalizeOrigin(fallbackApplicationUrl ?? undefined) ??
    normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL);

  const candidateLoginBase =
    normalizeOrigin(process.env.CANDIDATE_APP_ORIGIN) ??
    normalizeOrigin(process.env.NEXT_PUBLIC_CANDIDATE_APP_ORIGIN) ??
    internalLoginBase;

  const loginBase = isInternalAccount(metadataValue) ? internalLoginBase : candidateLoginBase;

  return loginBase ? `${loginBase}/login` : "/login";
}

function buildActivationUrl(token: string, appOrigin?: string | null, fallbackApplicationUrl?: string | null) {
  const activationBase = getActivationAppBaseUrl(appOrigin, fallbackApplicationUrl);
  if (!activationBase) {
    return null;
  }

  try {
    const url = new URL(activationBase);
    url.pathname = "/activate-account";
    url.search = "";
    url.searchParams.set("token", token);
    return url.toString();
  } catch {
    return null;
  }
}

function generateActivationToken() {
  return randomBytes(32).toString("hex").toUpperCase();
}

async function createActivationToken(userId: string) {
  const existingToken = await prisma.accountActivationToken.findFirst({
    where: {
      userId,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: { sentAt: true },
  });

  if (existingToken) {
    const cooldownUntil = existingToken.sentAt.getTime() + getActivationResendCooldownSeconds() * 1_000;
    if (cooldownUntil > Date.now()) {
      return null;
    }
  }

  await prisma.accountActivationToken.updateMany({
    where: {
      userId,
      consumedAt: null,
    },
    data: {
      consumedAt: new Date(),
    },
  });

  const activationToken = generateActivationToken();
  const expiresAt = new Date(Date.now() + getActivationTokenTtlHours() * 60 * 60 * 1_000);

  await prisma.accountActivationToken.create({
    data: {
      userId,
      tokenHash: hashSensitiveToken(activationToken),
      expiresAt,
      sentAt: new Date(),
    },
  });

  return activationToken;
}

export async function sendAccountActivationEmail(userId: string, options: ActivationEmailOptions = {}) {
  requireDatabase();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      emailVerifiedAt: true,
      metadata: true,
    },
  });

  if (!user || !user.isActive) {
    throw new Error("User not found.");
  }

  if (!isAccountActivationRequired(user.metadata, user.emailVerifiedAt)) {
    return { ok: true, status: "already-activated" as const };
  }

  const activationToken = await createActivationToken(user.id);
  if (!activationToken) {
    throw new Error("Please wait before requesting another activation email.");
  }

  const generalSettings = await getGeneralRuntimeSettings();
  const activationUrl = buildActivationUrl(activationToken, options.appOrigin, generalSettings.applicationUrl);
  if (!activationUrl) {
    throw new Error("Account activation URL is not configured.");
  }

  const loginUrl = getLoginUrlForUser(user.metadata, generalSettings.applicationUrl);
  const template = await renderEmailTemplateByKeyService(ACCOUNT_ACTIVATION_EMAIL_TEMPLATE_KEY, {
    appName: generalSettings.applicationName,
    recipientName: user.name,
    activationUrl,
    activationToken,
    expiresInHours: getActivationTokenTtlHours(),
    loginUrl,
    supportEmail: generalSettings.supportEmail,
  });

  let deliveryStatus: "SENT" | "PENDING" = "PENDING";

  try {
    const delivery = await deliverLoggedEmail({
      to: user.email,
      subject: template.subject,
      text: template.text,
      html: template.html,
      category: "SYSTEM",
      templateKey: ACCOUNT_ACTIVATION_EMAIL_TEMPLATE_KEY,
      metadata: {
        purpose: "account-activation",
      },
      audit: {
        entityType: "AUTH",
        entityId: user.id,
        actorUserId: options.actorUserId ?? null,
      },
    });

    deliveryStatus = delivery.status === "SENT" ? "SENT" : "PENDING";

    await prisma.user.update({
      where: { id: user.id },
      data: {
        metadata:
          delivery.status === "SENT"
            ? (buildActivationEmailSentMetadata(user.metadata, new Date().toISOString()) as Prisma.InputJsonValue)
            : (buildActivationEmailQueuedMetadata(user.metadata) as Prisma.InputJsonValue),
      },
    });
  } catch (error) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        metadata: buildActivationEmailFailedMetadata(
          user.metadata,
          error instanceof Error ? error.message : "Unknown activation delivery failure.",
        ) as Prisma.InputJsonValue,
      },
    });

    throw error;
  }

  await createAuditLogEntry({
    entityType: "AUTH",
    entityId: user.id,
    action: "UPDATED",
    status: deliveryStatus === "SENT" ? "ACTIVATION_SENT" : "ACTIVATION_QUEUED",
    message: `Account activation email ${deliveryStatus === "SENT" ? "sent" : "queued"} for ${user.email}.`,
    actorUserId: options.actorUserId ?? null,
  });

  return { ok: true, status: deliveryStatus === "SENT" ? ("sent" as const) : ("queued" as const) };
}

export async function activateAccountWithToken(activationToken: string) {
  requireDatabase();

  const normalizedToken = activationToken.trim();
  if (!normalizedToken) {
    throw new Error("Activation token is required.");
  }

  const tokenRecord = await prisma.accountActivationToken.findFirst({
    where: {
      tokenHash: hashSensitiveToken(normalizedToken),
      user: {
        isActive: true,
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      consumedAt: true,
      user: {
        select: {
          email: true,
          name: true,
          metadata: true,
          emailVerifiedAt: true,
        },
      },
    },
  });

  if (!tokenRecord || tokenRecord.consumedAt || tokenRecord.expiresAt.getTime() < Date.now()) {
    throw new Error("Invalid or expired activation token.");
  }

  const completedAt = new Date();
  const completedAtIso = completedAt.toISOString();

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: tokenRecord.userId },
      data: {
        emailVerifiedAt: tokenRecord.user.emailVerifiedAt ?? completedAt,
        metadata: buildCompletedAccountActivationMetadata(tokenRecord.user.metadata, completedAtIso) as Prisma.InputJsonValue,
      },
    });

    await tx.accountActivationToken.updateMany({
      where: {
        userId: tokenRecord.userId,
        consumedAt: null,
      },
      data: {
        consumedAt: completedAt,
      },
    });

    await clearUserLoginLockoutWithClient(tx, tokenRecord.userId);
  });

  await createAuditLogEntry({
    entityType: "AUTH",
    entityId: tokenRecord.userId,
    action: "UPDATED",
    status: "ACCOUNT_ACTIVATED",
    message: `Account activated for ${tokenRecord.user.email}.`,
  });

  const generalSettings = await getGeneralRuntimeSettings();

  return {
    email: tokenRecord.user.email,
    name: tokenRecord.user.name,
    loginUrl: getLoginUrlForUser(tokenRecord.user.metadata, generalSettings.applicationUrl),
  };
}