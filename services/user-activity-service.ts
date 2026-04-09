import "server-only";

import type { UserActivityType } from "@prisma/client";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";

function requireDatabase() {
  if (!isDatabaseConfigured) {
    throw new Error("User activity tracking requires database configuration.");
  }
}

function getBrowserLabel(userAgent: string | null): string {
  if (!userAgent) return "Unknown";

  if (/edg\//i.test(userAgent)) return "Edge";
  if (/chrome\//i.test(userAgent) && !/edg\//i.test(userAgent)) return "Chrome";
  if (/firefox\//i.test(userAgent)) return "Firefox";
  if (/safari\//i.test(userAgent) && !/chrome\//i.test(userAgent)) return "Safari";
  return "Unknown";
}

function getDeviceLabel(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";

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

  const formFactor = /ipad|tablet/i.test(userAgent)
    ? "Tablet"
    : /mobile|iphone|android/i.test(userAgent)
      ? "Mobile"
      : "Desktop";

  return `${platform} ${formFactor}`.trim();
}

type LogActivityInput = {
  userId: string;
  activityType: UserActivityType;
  ipAddress?: string | null;
  userAgent?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logUserActivity(input: LogActivityInput): Promise<void> {
  if (!isDatabaseConfigured) return;

  try {
    await prisma.userActivityLog.create({
      data: {
        userId: input.userId,
        activityType: input.activityType,
        ipAddress: input.ipAddress?.slice(0, 64) ?? null,
        userAgent: input.userAgent?.slice(0, 255) ?? null,
        device: getDeviceLabel(input.userAgent ?? null),
        browser: getBrowserLabel(input.userAgent ?? null),
        sessionId: input.sessionId ?? null,
        metadata: (input.metadata ?? {}) as object,
      },
    });
  } catch (error) {
    // Activity logging is non-critical — suppress failures.
    console.warn("Failed to log user activity:", error instanceof Error ? error.message : error);
  }
}

type GetUserActivityInput = {
  userId: string;
  page: number;
  pageSize: number;
  activityType?: UserActivityType;
};

export type UserActivityLogItem = {
  id: string;
  activityType: string;
  ipAddress: string | null;
  device: string | null;
  browser: string | null;
  sessionId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type UserActivityResponse = {
  items: UserActivityLogItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export async function getUserActivityService(input: GetUserActivityInput): Promise<UserActivityResponse> {
  requireDatabase();

  const where = {
    userId: input.userId,
    ...(input.activityType ? { activityType: input.activityType } : {}),
  };

  const [totalCount, records] = await prisma.$transaction([
    prisma.userActivityLog.count({ where }),
    prisma.userActivityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: {
        id: true,
        activityType: true,
        ipAddress: true,
        device: true,
        browser: true,
        sessionId: true,
        metadata: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    items: records.map((record) => ({
      id: record.id,
      activityType: record.activityType,
      ipAddress: record.ipAddress,
      device: record.device,
      browser: record.browser,
      sessionId: record.sessionId,
      metadata: (record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
        ? record.metadata
        : {}) as Record<string, unknown>,
      createdAt: record.createdAt.toISOString(),
    })),
    totalCount,
    page: input.page,
    pageSize: input.pageSize,
    pageCount: Math.max(1, Math.ceil(totalCount / input.pageSize)),
  };
}

export type UserSessionHistoryItem = {
  id: string;
  device: string | null;
  browser: string | null;
  ipAddress: string | null;
  loginAt: string;
  lastActivityAt: string;
  expiresAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
  isActive: boolean;
};

export type UserSessionHistoryResponse = {
  items: UserSessionHistoryItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export async function getUserSessionHistoryService(
  userId: string,
  page: number,
  pageSize: number,
): Promise<UserSessionHistoryResponse> {
  requireDatabase();

  const where = { userId };
  const now = new Date();

  const [totalCount, records] = await prisma.$transaction([
    prisma.userSession.count({ where }),
    prisma.userSession.findMany({
      where,
      orderBy: { loginAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        device: true,
        browser: true,
        ipAddress: true,
        loginAt: true,
        lastActivityAt: true,
        expiresAt: true,
        revokedAt: true,
        revokedReason: true,
      },
    }),
  ]);

  return {
    items: records.map((record) => ({
      id: record.id,
      device: record.device,
      browser: record.browser,
      ipAddress: record.ipAddress,
      loginAt: record.loginAt.toISOString(),
      lastActivityAt: record.lastActivityAt.toISOString(),
      expiresAt: record.expiresAt.toISOString(),
      revokedAt: record.revokedAt?.toISOString() ?? null,
      revokedReason: record.revokedReason,
      isActive: !record.revokedAt && record.expiresAt > now,
    })),
    totalCount,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(totalCount / pageSize)),
  };
}
