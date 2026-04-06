import "server-only";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";

const DEFAULT_MAX_FAILED_ATTEMPTS = 5;
const DEFAULT_LOCKOUT_SECONDS = 15 * 60;
export const LOGIN_LOCKED_ERROR_MESSAGE = "Too many login attempts. Please try again later.";

type LoginLockoutResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  remainingAttempts: number;
};

export class LoginLockedError extends Error {
  retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(LOGIN_LOCKED_ERROR_MESSAGE);
    this.name = "LoginLockedError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function getMaxFailedAttempts() {
  const rawValue = Number.parseInt(process.env.AUTH_LOGIN_MAX_FAILED_ATTEMPTS ?? "", 10);
  if (!Number.isFinite(rawValue) || rawValue < 1) {
    return DEFAULT_MAX_FAILED_ATTEMPTS;
  }

  return rawValue;
}

function getLockoutSeconds() {
  const rawValue = Number.parseInt(process.env.AUTH_LOGIN_LOCKOUT_SECONDS ?? "", 10);
  if (!Number.isFinite(rawValue) || rawValue < 30) {
    return DEFAULT_LOCKOUT_SECONDS;
  }

  return rawValue;
}

function isAttemptWindowExpired(lastFailedLoginAt: Date | null, now: Date) {
  if (!lastFailedLoginAt) {
    return true;
  }

  return now.getTime() - lastFailedLoginAt.getTime() > getLockoutSeconds() * 1_000;
}

export async function clearUserLoginLockout(userId: string) {
  if (!isDatabaseConfigured) {
    return;
  }

  await prisma.userSecurity.upsert({
    where: { userId },
    update: {
      failedLoginAttempts: 0,
      loginLockedUntil: null,
      lastFailedLoginAt: null,
    },
    create: {
      userId,
      recoveryCodes: [],
      failedLoginAttempts: 0,
      loginLockedUntil: null,
      lastFailedLoginAt: null,
    },
  });
}

export async function assertUserLoginNotLocked(userId: string) {
  if (!isDatabaseConfigured) {
    return;
  }

  const security = await prisma.userSecurity.findUnique({
    where: { userId },
    select: {
      failedLoginAttempts: true,
      loginLockedUntil: true,
      lastFailedLoginAt: true,
    },
  });

  if (!security) {
    return;
  }

  const now = new Date();

  if (security.loginLockedUntil && security.loginLockedUntil > now) {
    throw new LoginLockedError(Math.ceil((security.loginLockedUntil.getTime() - now.getTime()) / 1_000));
  }

  if ((security.loginLockedUntil && security.loginLockedUntil <= now) || (security.failedLoginAttempts > 0 && isAttemptWindowExpired(security.lastFailedLoginAt, now))) {
    await clearUserLoginLockout(userId);
  }
}

export async function registerFailedUserLoginAttempt(userId: string): Promise<LoginLockoutResult> {
  if (!isDatabaseConfigured) {
    return {
      allowed: true,
      retryAfterSeconds: 0,
      remainingAttempts: getMaxFailedAttempts(),
    };
  }

  const now = new Date();
  const maxFailedAttempts = getMaxFailedAttempts();
  const lockoutSeconds = getLockoutSeconds();

  const security = await prisma.userSecurity.findUnique({
    where: { userId },
    select: {
      failedLoginAttempts: true,
      loginLockedUntil: true,
      lastFailedLoginAt: true,
    },
  });

  if (security?.loginLockedUntil && security.loginLockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((security.loginLockedUntil.getTime() - now.getTime()) / 1_000),
      remainingAttempts: 0,
    };
  }

  const existingAttempts = security && !isAttemptWindowExpired(security.lastFailedLoginAt, now) ? security.failedLoginAttempts : 0;
  const nextFailedAttempts = existingAttempts + 1;

  if (nextFailedAttempts >= maxFailedAttempts) {
    const loginLockedUntil = new Date(now.getTime() + lockoutSeconds * 1_000);

    await prisma.userSecurity.upsert({
      where: { userId },
      update: {
        failedLoginAttempts: nextFailedAttempts,
        loginLockedUntil,
        lastFailedLoginAt: now,
      },
      create: {
        userId,
        recoveryCodes: [],
        failedLoginAttempts: nextFailedAttempts,
        loginLockedUntil,
        lastFailedLoginAt: now,
      },
    });

    return {
      allowed: false,
      retryAfterSeconds: lockoutSeconds,
      remainingAttempts: 0,
    };
  }

  await prisma.userSecurity.upsert({
    where: { userId },
    update: {
      failedLoginAttempts: nextFailedAttempts,
      loginLockedUntil: null,
      lastFailedLoginAt: now,
    },
    create: {
      userId,
      recoveryCodes: [],
      failedLoginAttempts: nextFailedAttempts,
      loginLockedUntil: null,
      lastFailedLoginAt: now,
    },
  });

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remainingAttempts: Math.max(0, maxFailedAttempts - nextFailedAttempts),
  };
}