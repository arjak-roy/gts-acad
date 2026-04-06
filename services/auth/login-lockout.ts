import "server-only";

import type { Prisma } from "@prisma/client";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { getAuthenticationSecurityRuntimeSettings } from "@/services/settings/runtime";

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

async function getLoginLockoutConfiguration() {
  const settings = await getAuthenticationSecurityRuntimeSettings();

  return {
    maxFailedAttempts: Number.isFinite(settings.maximumFailedLoginAttempts) && settings.maximumFailedLoginAttempts > 0
      ? settings.maximumFailedLoginAttempts
      : DEFAULT_MAX_FAILED_ATTEMPTS,
    lockoutSeconds: Number.isFinite(settings.accountLockDurationSeconds) && settings.accountLockDurationSeconds >= 30
      ? settings.accountLockDurationSeconds
      : DEFAULT_LOCKOUT_SECONDS,
  };
}

function isAttemptWindowExpired(lastFailedLoginAt: Date | null, now: Date, lockoutSeconds: number) {
  if (!lastFailedLoginAt) {
    return true;
  }

  return now.getTime() - lastFailedLoginAt.getTime() > lockoutSeconds * 1_000;
}

function buildClearedLoginLockoutState() {
  return {
    failedLoginAttempts: 0,
    loginLockedUntil: null,
    lastFailedLoginAt: null,
  };
}

type UserSecurityClient = Pick<Prisma.TransactionClient, "userSecurity">;

export async function clearUserLoginLockoutWithClient(client: UserSecurityClient, userId: string) {
  const clearedLoginLockoutState = buildClearedLoginLockoutState();

  await client.userSecurity.upsert({
    where: { userId },
    update: clearedLoginLockoutState,
    create: {
      userId,
      recoveryCodes: [],
      ...clearedLoginLockoutState,
    },
  });
}

export async function clearUserLoginLockout(userId: string) {
  if (!isDatabaseConfigured) {
    return;
  }

  await clearUserLoginLockoutWithClient(prisma, userId);
}

export async function assertUserLoginNotLocked(userId: string) {
  if (!isDatabaseConfigured) {
    return;
  }

  const { lockoutSeconds } = await getLoginLockoutConfiguration();

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

  if ((security.loginLockedUntil && security.loginLockedUntil <= now) || (security.failedLoginAttempts > 0 && isAttemptWindowExpired(security.lastFailedLoginAt, now, lockoutSeconds))) {
    await clearUserLoginLockout(userId);
  }
}

export async function registerFailedUserLoginAttempt(userId: string): Promise<LoginLockoutResult> {
  const { maxFailedAttempts, lockoutSeconds } = await getLoginLockoutConfiguration();

  if (!isDatabaseConfigured) {
    return {
      allowed: true,
      retryAfterSeconds: 0,
      remainingAttempts: maxFailedAttempts,
    };
  }

  const now = new Date();

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

  const existingAttempts = security && !isAttemptWindowExpired(security.lastFailedLoginAt, now, lockoutSeconds) ? security.failedLoginAttempts : 0;
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