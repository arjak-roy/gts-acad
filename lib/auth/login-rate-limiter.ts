import "server-only";

import type { NextRequest } from "next/server";

const DEFAULT_MAX_FAILED_ATTEMPTS = 5;
const DEFAULT_LOCKOUT_SECONDS = 15 * 60;
const MAX_TRACKED_RECORDS = 10_000;

type LoginAttemptRecord = {
  failedAttempts: number;
  lockoutUntil: number | null;
  updatedAt: number;
};

type LoginRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  remainingAttempts: number;
};

const loginAttemptStore = new Map<string, LoginAttemptRecord>();

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

function maybeCleanupStore(now: number) {
  if (loginAttemptStore.size <= MAX_TRACKED_RECORDS) {
    return;
  }

  for (const [key, record] of loginAttemptStore.entries()) {
    const lockoutExpired = !record.lockoutUntil || record.lockoutUntil <= now;
    const staleRecord = now - record.updatedAt > getLockoutSeconds() * 2_000;

    if (lockoutExpired && staleRecord) {
      loginAttemptStore.delete(key);
    }

    if (loginAttemptStore.size <= MAX_TRACKED_RECORDS) {
      return;
    }
  }
}

export function getClientIpAddress(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstAddress = forwardedFor.split(",")[0]?.trim();
    if (firstAddress) {
      return firstAddress;
    }
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}

export function buildLoginRateLimitKey(request: NextRequest, normalizedEmail: string) {
  return `${getClientIpAddress(request)}:${normalizedEmail}`;
}

export function getLoginRateLimitStatus(key: string): LoginRateLimitResult {
  const now = Date.now();
  maybeCleanupStore(now);

  const record = loginAttemptStore.get(key);
  if (!record) {
    return {
      allowed: true,
      retryAfterSeconds: 0,
      remainingAttempts: getMaxFailedAttempts(),
    };
  }

  if (record.lockoutUntil && record.lockoutUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((record.lockoutUntil - now) / 1_000),
      remainingAttempts: 0,
    };
  }

  if (record.lockoutUntil && record.lockoutUntil <= now) {
    loginAttemptStore.delete(key);
    return {
      allowed: true,
      retryAfterSeconds: 0,
      remainingAttempts: getMaxFailedAttempts(),
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remainingAttempts: Math.max(0, getMaxFailedAttempts() - record.failedAttempts),
  };
}

export function registerFailedLoginAttempt(key: string): LoginRateLimitResult {
  const now = Date.now();
  maybeCleanupStore(now);

  const existingRecord = loginAttemptStore.get(key);
  if (existingRecord?.lockoutUntil && existingRecord.lockoutUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((existingRecord.lockoutUntil - now) / 1_000),
      remainingAttempts: 0,
    };
  }

  const nextFailedAttempts = (existingRecord?.failedAttempts ?? 0) + 1;
  const maxFailedAttempts = getMaxFailedAttempts();

  if (nextFailedAttempts >= maxFailedAttempts) {
    const lockoutUntil = now + getLockoutSeconds() * 1_000;
    loginAttemptStore.set(key, {
      failedAttempts: nextFailedAttempts,
      lockoutUntil,
      updatedAt: now,
    });

    return {
      allowed: false,
      retryAfterSeconds: getLockoutSeconds(),
      remainingAttempts: 0,
    };
  }

  loginAttemptStore.set(key, {
    failedAttempts: nextFailedAttempts,
    lockoutUntil: null,
    updatedAt: now,
  });

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remainingAttempts: maxFailedAttempts - nextFailedAttempts,
  };
}

export function clearLoginRateLimit(key: string) {
  loginAttemptStore.delete(key);
}