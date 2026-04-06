import "server-only";

import type { NextRequest } from "next/server";

import { getClientIpAddress } from "@/lib/auth/login-rate-limiter";
import {
  buildAuthSessionCookie,
  createAuthSessionToken,
  getAuthenticatedSessionMaxAgeSeconds,
  type AuthSessionClaims,
} from "@/lib/auth/session";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";

const SESSION_ACTIVITY_TOUCH_INTERVAL_MS = 60_000;

type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  requiresPasswordReset: boolean;
};

function requireDatabase() {
  if (!isDatabaseConfigured) {
    throw new Error("Authentication requires database configuration.");
  }
}

function getBrowserLabel(userAgent: string | null) {
  if (!userAgent) {
    return "Unknown";
  }

  const matchers = [
    { label: "Edge", pattern: /edg\//i },
    { label: "Chrome", pattern: /chrome\//i },
    { label: "Firefox", pattern: /firefox\//i },
    { label: "Safari", pattern: /safari\//i },
  ];

  for (const matcher of matchers) {
    if (matcher.label === "Safari" && /chrome\//i.test(userAgent)) {
      continue;
    }

    if (matcher.pattern.test(userAgent)) {
      return matcher.label;
    }
  }

  return "Unknown";
}

function getDeviceLabel(userAgent: string | null) {
  if (!userAgent) {
    return "Unknown device";
  }

  const platform = /windows/i.test(userAgent)
    ? "Windows"
    : /mac os x/i.test(userAgent)
      ? "macOS"
      : /iphone|ipad|ios/i.test(userAgent)
        ? "iOS"
        : /android/i.test(userAgent)
          ? "Android"
          : /linux/i.test(userAgent)
            ? "Linux"
            : "Unknown";

  const formFactor = /ipad|tablet/i.test(userAgent) ? "Tablet" : /mobile|iphone|android/i.test(userAgent) ? "Mobile" : "Desktop";
  return `${platform} ${formFactor}`.trim();
}

export async function createAuthenticatedUserSession(request: NextRequest, user: SessionUser, rememberMe: boolean) {
  requireDatabase();

  const now = new Date();
  const maxAgeSeconds = getAuthenticatedSessionMaxAgeSeconds(rememberMe);
  const expiresAt = new Date(now.getTime() + maxAgeSeconds * 1_000);
  const userAgent = request.headers.get("user-agent");

  const session = await prisma.userSession.create({
    data: {
      userId: user.id,
      device: getDeviceLabel(userAgent),
      browser: getBrowserLabel(userAgent),
      ipAddress: getClientIpAddress(request),
      userAgent: userAgent?.slice(0, 255) ?? null,
      rememberMe,
      loginAt: now,
      lastActivityAt: now,
      expiresAt,
    },
  });

  const token = await createAuthSessionToken(
    {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      state: "authenticated",
      sessionId: session.id,
      rememberMe,
      requiresPasswordReset: user.requiresPasswordReset,
    },
    maxAgeSeconds,
  );

  return {
    sessionId: session.id,
    token,
    maxAgeSeconds,
    expiresAt,
    cookie: buildAuthSessionCookie(request, token, maxAgeSeconds),
  };
}

export async function validateAuthenticatedUserSession(session: AuthSessionClaims) {
  if (!isDatabaseConfigured) {
    return true;
  }

  const issuedAtMs = typeof session.issuedAt === "number" ? session.issuedAt * 1_000 : 0;

  const [security, storedSession] = await Promise.all([
    prisma.userSecurity.findUnique({
      where: { userId: session.userId },
      select: { passwordChangedAt: true, sessionInvalidatedAt: true },
    }),
    session.sessionId
      ? prisma.userSession.findFirst({
          where: { id: session.sessionId, userId: session.userId },
          select: { id: true, revokedAt: true, expiresAt: true },
        })
      : Promise.resolve(null),
  ]);

  if (issuedAtMs && security?.passwordChangedAt && issuedAtMs < security.passwordChangedAt.getTime()) {
    return false;
  }

  if (issuedAtMs && security?.sessionInvalidatedAt && issuedAtMs < security.sessionInvalidatedAt.getTime()) {
    return false;
  }

  if (!session.sessionId) {
    return true;
  }

  if (!storedSession) {
    return false;
  }

  return !storedSession.revokedAt && storedSession.expiresAt.getTime() > Date.now();
}

export async function touchUserSessionActivity(userId: string, sessionId: string) {
  if (!isDatabaseConfigured || !sessionId) {
    return;
  }

  const now = new Date();
  const threshold = new Date(now.getTime() - SESSION_ACTIVITY_TOUCH_INTERVAL_MS);

  await prisma.userSession.updateMany({
    where: {
      id: sessionId,
      userId,
      revokedAt: null,
      expiresAt: { gt: now },
      lastActivityAt: { lt: threshold },
    },
    data: {
      lastActivityAt: now,
    },
  });
}

export async function revokeUserSession(userId: string, sessionId: string, reason: string) {
  if (!isDatabaseConfigured || !sessionId) {
    return;
  }

  await prisma.userSession.updateMany({
    where: {
      id: sessionId,
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
      revokedReason: reason.slice(0, 80),
    },
  });
}

export async function invalidateAllUserSessions(userId: string, reason: string, exceptSessionId?: string) {
  requireDatabase();

  const invalidatedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.userSecurity.upsert({
      where: { userId },
      update: {
        sessionInvalidatedAt: invalidatedAt,
      },
      create: {
        userId,
        recoveryCodes: [],
        sessionInvalidatedAt: invalidatedAt,
      },
    });

    await tx.userSession.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: {
        revokedAt: invalidatedAt,
        revokedReason: reason.slice(0, 80),
      },
    });
  });

  return invalidatedAt;
}

export async function listUserSessions(userId: string, currentSessionId?: string) {
  if (!isDatabaseConfigured) {
    return [];
  }

  const now = new Date();
  const sessions = await prisma.userSession.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: [{ loginAt: "desc" }],
    select: {
      id: true,
      device: true,
      browser: true,
      ipAddress: true,
      rememberMe: true,
      loginAt: true,
      lastActivityAt: true,
      expiresAt: true,
    },
  });

  return sessions.map((session) => ({
    id: session.id,
    device: session.device,
    browser: session.browser,
    ipAddress: session.ipAddress,
    rememberMe: session.rememberMe,
    loginTime: session.loginAt.toISOString(),
    lastActivityAt: session.lastActivityAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    isCurrent: session.id === currentSessionId,
    status: session.id === currentSessionId ? "CURRENT" : "ACTIVE",
  }));
}