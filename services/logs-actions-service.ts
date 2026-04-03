import "server-only";

import { Prisma } from "@prisma/client";

import { sendMail } from "@/lib/mail-service";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

const EMAIL_LOG_STATUS = {
  PENDING: "PENDING",
  SENT: "SENT",
  FAILED: "FAILED",
  RETRYING: "RETRYING",
} as const;

const EMAIL_LOG_CATEGORY = {
  CANDIDATE_WELCOME: "CANDIDATE_WELCOME",
  TWO_FACTOR: "TWO_FACTOR",
  SYSTEM: "SYSTEM",
} as const;

const AUDIT_ENTITY_TYPE = {
  BATCH: "BATCH",
  CANDIDATE: "CANDIDATE",
  COURSE: "COURSE",
  EMAIL: "EMAIL",
  AUTH: "AUTH",
  SYSTEM: "SYSTEM",
} as const;

const AUDIT_ACTION_TYPE = {
  CREATED: "CREATED",
  UPDATED: "UPDATED",
  ENROLLED: "ENROLLED",
  MAIL_SENT: "MAIL_SENT",
  MAIL_FAILED: "MAIL_FAILED",
  MAIL_RETRIED: "MAIL_RETRIED",
  LOGIN: "LOGIN",
  TWO_FACTOR: "TWO_FACTOR",
  RETRY: "RETRY",
} as const;

const AUDIT_LOG_LEVEL = {
  INFO: "INFO",
  WARN: "WARN",
  ERROR: "ERROR",
} as const;

type EmailLogStatus = (typeof EMAIL_LOG_STATUS)[keyof typeof EMAIL_LOG_STATUS];
type EmailLogCategory = (typeof EMAIL_LOG_CATEGORY)[keyof typeof EMAIL_LOG_CATEGORY];
type AuditEntityType = (typeof AUDIT_ENTITY_TYPE)[keyof typeof AUDIT_ENTITY_TYPE];
type AuditActionType = (typeof AUDIT_ACTION_TYPE)[keyof typeof AUDIT_ACTION_TYPE];
type AuditLogLevel = (typeof AUDIT_LOG_LEVEL)[keyof typeof AUDIT_LOG_LEVEL];

const prismaWithLogs = prisma as unknown as {
  auditLog: {
    create: (args: unknown) => Promise<unknown>;
    count: (args: unknown) => Promise<number>;
    findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
  };
  emailLog: {
    create: (args: unknown) => Promise<{ id: string }>;
    count: (args: unknown) => Promise<number>;
    findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    findUnique: (args: unknown) => Promise<Record<string, unknown> | null>;
    update: (args: unknown) => Promise<Record<string, unknown>>;
  };
  $transaction: <T extends unknown[]>(operations: { [K in keyof T]: Promise<T[K]> }) => Promise<T>;
};

type DeliveryAuditContext = {
  entityType?: AuditEntityType;
  entityId?: string | null;
  actorUserId?: string | null;
};

export type DeliverLoggedEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
  category: EmailLogCategory;
  templateKey?: string | null;
  metadata?: Prisma.InputJsonValue;
  audit?: DeliveryAuditContext;
};

export type EmailLogListItem = {
  id: string;
  category: EmailLogCategory;
  templateKey: string | null;
  toEmail: string;
  subject: string;
  status: EmailLogStatus;
  attemptCount: number;
  errorMessage: string | null;
  providerMessageId: string | null;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  lastAttemptAt: string | null;
};

export type EmailLogListResponse = {
  items: EmailLogListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type AuditLogListItem = {
  id: string;
  entityType: AuditEntityType;
  entityId: string | null;
  action: AuditActionType;
  level: AuditLogLevel;
  status: string | null;
  message: string;
  createdAt: string;
};

export type AuditLogListResponse = {
  items: AuditLogListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type ListEmailLogsInput = {
  page?: number;
  pageSize?: number;
  status?: "ALL" | EmailLogStatus;
  category?: "ALL" | EmailLogCategory;
  search?: string;
};

export type ListAuditLogsInput = {
  page?: number;
  pageSize?: number;
  entityType?: "ALL" | AuditEntityType;
  level?: "ALL" | AuditLogLevel;
  search?: string;
};

export type RetryBulkInput = {
  mode: "selected" | "all-failed";
  ids: string[];
};

export type RetryBulkResult = {
  requested: number;
  retried: number;
  failed: number;
  results: Array<{
    id: string;
    status: "retried" | "failed";
    message: string;
  }>;
};

function resolvePagination(input: { page?: number; pageSize?: number }) {
  const page = Number.isFinite(input.page) && (input.page ?? 0) > 0 ? Number(input.page) : DEFAULT_PAGE;
  const requestedPageSize = Number.isFinite(input.pageSize) && (input.pageSize ?? 0) > 0 ? Number(input.pageSize) : DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE);

  return { page, pageSize };
}

function mapEmailLog(item: {
  id: string;
  category: EmailLogCategory;
  templateKey: string | null;
  toEmail: string;
  subject: string;
  status: EmailLogStatus;
  attemptCount: number;
  errorMessage: string | null;
  providerMessageId: string | null;
  createdAt: Date;
  updatedAt: Date;
  sentAt: Date | null;
  lastAttemptAt: Date | null;
}): EmailLogListItem {
  return {
    id: item.id,
    category: item.category,
    templateKey: item.templateKey,
    toEmail: item.toEmail,
    subject: item.subject,
    status: item.status,
    attemptCount: item.attemptCount,
    errorMessage: item.errorMessage,
    providerMessageId: item.providerMessageId,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    sentAt: item.sentAt?.toISOString() ?? null,
    lastAttemptAt: item.lastAttemptAt?.toISOString() ?? null,
  };
}

function mapAuditLog(item: {
  id: string;
  entityType: AuditEntityType;
  entityId: string | null;
  action: AuditActionType;
  level: AuditLogLevel;
  status: string | null;
  message: string;
  createdAt: Date;
}): AuditLogListItem {
  return {
    id: item.id,
    entityType: item.entityType,
    entityId: item.entityId,
    action: item.action,
    level: item.level,
    status: item.status,
    message: item.message,
    createdAt: item.createdAt.toISOString(),
  };
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 1000);
  }

  return "Unexpected email delivery failure.";
}

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

export async function deliverLoggedEmail(input: DeliverLoggedEmailInput) {
  if (!isDatabaseConfigured) {
    const result = await sendMail({
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });

    return {
      emailLogId: null as string | null,
      providerMessageId: result.messageId ?? null,
      status: EMAIL_LOG_STATUS.SENT,
    };
  }

  const emailLog = await prismaWithLogs.emailLog.create({
    data: {
      category: input.category,
      templateKey: input.templateKey ?? null,
      toEmail: input.to,
      subject: input.subject,
      textBody: input.text,
      htmlBody: input.html,
      status: EMAIL_LOG_STATUS.PENDING,
      metadata: input.metadata ?? {},
      triggeredById: input.audit?.actorUserId ?? null,
    },
    select: { id: true },
  });

  try {
    const mailResult = await sendMail({
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });

    await prismaWithLogs.emailLog.update({
      where: { id: emailLog.id },
      data: {
        status: EMAIL_LOG_STATUS.SENT,
        attemptCount: { increment: 1 },
        errorMessage: null,
        providerMessageId: mailResult.messageId ?? null,
        lastAttemptAt: new Date(),
        sentAt: new Date(),
      },
    });

    await createAuditLogEntry({
      entityType: input.audit?.entityType ?? AUDIT_ENTITY_TYPE.EMAIL,
      entityId: input.audit?.entityId ?? emailLog.id,
      action: AUDIT_ACTION_TYPE.MAIL_SENT,
      level: AUDIT_LOG_LEVEL.INFO,
      status: EMAIL_LOG_STATUS.SENT,
      message: `Email sent to ${input.to}`,
      metadata: {
        category: input.category,
        templateKey: input.templateKey ?? null,
      },
      actorUserId: input.audit?.actorUserId ?? null,
      emailLogId: emailLog.id,
    });

    return {
      emailLogId: emailLog.id,
      providerMessageId: mailResult.messageId ?? null,
      status: EMAIL_LOG_STATUS.SENT,
    };
  } catch (error) {
    const errorMessage = toErrorMessage(error);

    await prismaWithLogs.emailLog.update({
      where: { id: emailLog.id },
      data: {
        status: EMAIL_LOG_STATUS.FAILED,
        attemptCount: { increment: 1 },
        errorMessage,
        lastAttemptAt: new Date(),
      },
    });

    await createAuditLogEntry({
      entityType: input.audit?.entityType ?? AUDIT_ENTITY_TYPE.EMAIL,
      entityId: input.audit?.entityId ?? emailLog.id,
      action: AUDIT_ACTION_TYPE.MAIL_FAILED,
      level: AUDIT_LOG_LEVEL.ERROR,
      status: EMAIL_LOG_STATUS.FAILED,
      message: `Email failed for ${input.to}: ${errorMessage}`,
      metadata: {
        category: input.category,
        templateKey: input.templateKey ?? null,
      },
      actorUserId: input.audit?.actorUserId ?? null,
      emailLogId: emailLog.id,
    });

    throw error;
  }
}

export async function listEmailLogsService(input: ListEmailLogsInput): Promise<EmailLogListResponse> {
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
    ...(input.status && input.status !== "ALL" ? { status: input.status } : {}),
    ...(input.category && input.category !== "ALL" ? { category: input.category } : {}),
    ...(input.search?.trim()
      ? {
          OR: [
            { toEmail: { contains: input.search.trim(), mode: "insensitive" } },
            { subject: { contains: input.search.trim(), mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [totalCount, rows] = await prismaWithLogs.$transaction([
    prismaWithLogs.emailLog.count({ where }),
    prismaWithLogs.emailLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        category: true,
        templateKey: true,
        toEmail: true,
        subject: true,
        status: true,
        attemptCount: true,
        errorMessage: true,
        providerMessageId: true,
        createdAt: true,
        updatedAt: true,
        sentAt: true,
        lastAttemptAt: true,
      },
    }),
  ]);

  const typedRows = rows as Array<{
    id: string;
    category: EmailLogCategory;
    templateKey: string | null;
    toEmail: string;
    subject: string;
    status: EmailLogStatus;
    attemptCount: number;
    errorMessage: string | null;
    providerMessageId: string | null;
    createdAt: Date;
    updatedAt: Date;
    sentAt: Date | null;
    lastAttemptAt: Date | null;
  }>;

  return {
    items: typedRows.map(mapEmailLog),
    totalCount,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(totalCount / pageSize)),
  };
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

  const typedRows = rows as Array<{
    id: string;
    entityType: AuditEntityType;
    entityId: string | null;
    action: AuditActionType;
    level: AuditLogLevel;
    status: string | null;
    message: string;
    createdAt: Date;
  }>;

  return {
    items: typedRows.map(mapAuditLog),
    totalCount,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(totalCount / pageSize)),
  };
}

export async function retryEmailLogService(emailLogId: string) {
  if (!isDatabaseConfigured) {
    throw new Error("Email retry requires database configuration.");
  }

  const log = (await prismaWithLogs.emailLog.findUnique({
    where: { id: emailLogId },
    select: {
      id: true,
      category: true,
      templateKey: true,
      toEmail: true,
      subject: true,
      textBody: true,
      htmlBody: true,
      status: true,
      metadata: true,
    },
  })) as {
    id: string;
    category: EmailLogCategory;
    templateKey: string | null;
    toEmail: string;
    subject: string;
    textBody: string | null;
    htmlBody: string | null;
    status: EmailLogStatus;
    metadata: Prisma.JsonValue;
  } | null;

  if (!log) {
    throw new Error("Email log not found.");
  }

  if (log.status === EMAIL_LOG_STATUS.SENT) {
    throw new Error("This email is already marked as sent.");
  }

  await prismaWithLogs.emailLog.update({
    where: { id: log.id },
    data: {
      status: EMAIL_LOG_STATUS.RETRYING,
      errorMessage: null,
    },
  });

  try {
    const result = await sendMail({
      to: log.toEmail,
      subject: log.subject,
      text: log.textBody ?? "",
      html: log.htmlBody ?? "",
    });

    const updated = (await prismaWithLogs.emailLog.update({
      where: { id: log.id },
      data: {
        status: EMAIL_LOG_STATUS.SENT,
        attemptCount: { increment: 1 },
        providerMessageId: result.messageId ?? null,
        sentAt: new Date(),
        lastAttemptAt: new Date(),
      },
      select: {
        id: true,
        category: true,
        templateKey: true,
        toEmail: true,
        subject: true,
        status: true,
        attemptCount: true,
        errorMessage: true,
        providerMessageId: true,
        createdAt: true,
        updatedAt: true,
        sentAt: true,
        lastAttemptAt: true,
      },
    })) as {
      id: string;
      category: EmailLogCategory;
      templateKey: string | null;
      toEmail: string;
      subject: string;
      status: EmailLogStatus;
      attemptCount: number;
      errorMessage: string | null;
      providerMessageId: string | null;
      createdAt: Date;
      updatedAt: Date;
      sentAt: Date | null;
      lastAttemptAt: Date | null;
    };

    await createAuditLogEntry({
      entityType: AUDIT_ENTITY_TYPE.EMAIL,
      entityId: log.id,
      action: AUDIT_ACTION_TYPE.MAIL_RETRIED,
      level: AUDIT_LOG_LEVEL.INFO,
      status: EMAIL_LOG_STATUS.SENT,
      message: `Retry successful for email ${log.id}`,
      metadata: {
        category: log.category,
        templateKey: log.templateKey,
      },
      emailLogId: log.id,
    });

    return mapEmailLog(updated);
  } catch (error) {
    const errorMessage = toErrorMessage(error);

    await prismaWithLogs.emailLog.update({
      where: { id: log.id },
      data: {
        status: EMAIL_LOG_STATUS.FAILED,
        attemptCount: { increment: 1 },
        errorMessage,
        lastAttemptAt: new Date(),
      },
    });

    await createAuditLogEntry({
      entityType: AUDIT_ENTITY_TYPE.EMAIL,
      entityId: log.id,
      action: AUDIT_ACTION_TYPE.MAIL_FAILED,
      level: AUDIT_LOG_LEVEL.ERROR,
      status: EMAIL_LOG_STATUS.FAILED,
      message: `Retry failed for email ${log.id}: ${errorMessage}`,
      metadata: {
        category: log.category,
        templateKey: log.templateKey,
      },
      emailLogId: log.id,
    });

    throw error;
  }
}

export async function bulkRetryEmailLogsService(input: RetryBulkInput): Promise<RetryBulkResult> {
  if (!isDatabaseConfigured) {
    throw new Error("Bulk retry requires database configuration.");
  }

  const targetIds =
    input.mode === "selected"
      ? Array.from(new Set(input.ids))
      : (
          await prismaWithLogs.emailLog.findMany({
            where: { status: EMAIL_LOG_STATUS.FAILED },
            select: { id: true },
            orderBy: { createdAt: "desc" },
            take: MAX_PAGE_SIZE,
          })
        ).map((row) => (row as { id: string }).id);

  if (targetIds.length === 0) {
    return {
      requested: 0,
      retried: 0,
      failed: 0,
      results: [],
    };
  }

  const results: RetryBulkResult["results"] = [];
  let retried = 0;
  let failed = 0;

  for (const id of targetIds) {
    try {
      await retryEmailLogService(id);
      retried += 1;
      results.push({
        id,
        status: "retried",
        message: "Email retried successfully.",
      });
    } catch (error) {
      failed += 1;
      results.push({
        id,
        status: "failed",
        message: toErrorMessage(error),
      });
    }
  }

  return {
    requested: targetIds.length,
    retried,
    failed,
    results,
  };
}
