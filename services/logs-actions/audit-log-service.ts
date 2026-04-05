import { Prisma } from "@prisma/client";

import { isDatabaseConfigured } from "@/lib/prisma-client";
import { AUDIT_LOG_LEVEL } from "@/services/logs-actions/constants";
import { prismaWithLogs } from "@/services/logs-actions/prisma";
import {
  AuditLogListResponse,
  AuditLogRow,
  ListAuditLogsInput,
} from "@/services/logs-actions/types";
import { mapAuditLog, resolvePagination } from "@/services/logs-actions/utils";
import type { AuditActionType, AuditEntityType, AuditLogLevel } from "@/services/logs-actions/constants";

export async function createAuditLogEntry(input: {
  entityType: AuditEntityType;
  entityId?: string | null;
  action: AuditActionType;
  level?: AuditLogLevel;
  status?: string | null;
  message: string;
  metadata?: Prisma.InputJsonValue;
  actorUserId?: string | null;
  emailLogId?: string | null;
}) {
  if (!isDatabaseConfigured) {
    return;
  }

  try {
    await prismaWithLogs.auditLog.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        action: input.action,
        level: input.level ?? AUDIT_LOG_LEVEL.INFO,
        status: input.status ?? null,
        message: input.message,
        metadata: input.metadata ?? {},
        actorUserId: input.actorUserId ?? null,
        emailLogId: input.emailLogId ?? null,
      },
    });
  } catch (error) {
    console.error("Failed to create audit log entry", error);
  }
}

export async function listAuditLogsService(input: ListAuditLogsInput): Promise<AuditLogListResponse> {
  const { page, pageSize } = resolvePagination(input);

  if (!isDatabaseConfigured) {
    return {
      items: [],
      totalCount: 0,
      page,
      pageSize,
      pageCount: 1,
    };
  }

  const where = {
    ...(input.entityType && input.entityType !== "ALL" ? { entityType: input.entityType } : {}),
    ...(input.level && input.level !== "ALL" ? { level: input.level } : {}),
    ...(input.search?.trim() ? { message: { contains: input.search.trim(), mode: "insensitive" } } : {}),
  };

  const [totalCount, rows] = await prismaWithLogs.$transaction([
    prismaWithLogs.auditLog.count({ where }),
    prismaWithLogs.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        entityType: true,
        entityId: true,
        action: true,
        level: true,
        status: true,
        message: true,
        createdAt: true,
      },
    }),
  ]);

  const typedRows = rows as AuditLogRow[];

  return {
    items: typedRows.map(mapAuditLog),
    totalCount,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(totalCount / pageSize)),
  };
}
