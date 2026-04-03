import "server-only";

import { Prisma } from "@prisma/client";
import { AuditActionType, AuditEntityType, AuditLogLevel, EmailLogCategory, EmailLogStatus } from "@prisma/client";

import { sendMail } from "@/lib/mail-service";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

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
    await prisma.auditLog.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        action: input.action,
        level: input.level ?? AuditLogLevel.INFO,
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
      status: EmailLogStatus.SENT,
    };
  }

  const emailLog = await prisma.emailLog.create({
    data: {
      category: input.category,
      templateKey: input.templateKey ?? null,
      toEmail: input.to,
      subject: input.subject,
      textBody: input.text,
      htmlBody: input.html,
      status: EmailLogStatus.PENDING,
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

    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: {
        status: EmailLogStatus.SENT,
        attemptCount: { increment: 1 },
        errorMessage: null,
        providerMessageId: mailResult.messageId ?? null,
        lastAttemptAt: new Date(),
        sentAt: new Date(),
      },
    });

    await createAuditLogEntry({
      entityType: input.audit?.entityType ?? AuditEntityType.EMAIL,
      entityId: input.audit?.entityId ?? emailLog.id,
      action: AuditActionType.MAIL_SENT,
      level: AuditLogLevel.INFO,
      status: EmailLogStatus.SENT,
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
      status: EmailLogStatus.SENT,
    };
  } catch (error) {
    const errorMessage = toErrorMessage(error);

    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: {
        status: EmailLogStatus.FAILED,
        attemptCount: { increment: 1 },
        errorMessage,
        lastAttemptAt: new Date(),
      },
    });

    await createAuditLogEntry({
      entityType: input.audit?.entityType ?? AuditEntityType.EMAIL,
      entityId: input.audit?.entityId ?? emailLog.id,
      action: AuditActionType.MAIL_FAILED,
      level: AuditLogLevel.ERROR,
      status: EmailLogStatus.FAILED,
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

  const where: Prisma.EmailLogWhereInput = {
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

  const [totalCount, rows] = await prisma.$transaction([
    prisma.emailLog.count({ where }),
    prisma.emailLog.findMany({
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

  return {
    items: rows.map(mapEmailLog),
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

  const where: Prisma.AuditLogWhereInput = {
    ...(input.entityType && input.entityType !== "ALL" ? { entityType: input.entityType } : {}),
    ...(input.level && input.level !== "ALL" ? { level: input.level } : {}),
    ...(input.search?.trim() ? { message: { contains: input.search.trim(), mode: "insensitive" } } : {}),
  };

  const [totalCount, rows] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
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

  return {
    items: rows.map(mapAuditLog),
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

  const log = await prisma.emailLog.findUnique({
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
  });

  if (!log) {
    throw new Error("Email log not found.");
  }

  if (log.status === EmailLogStatus.SENT) {
    throw new Error("This email is already marked as sent.");
  }

  await prisma.emailLog.update({
    where: { id: log.id },
    data: {
      status: EmailLogStatus.RETRYING,
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

    const updated = await prisma.emailLog.update({
      where: { id: log.id },
      data: {
        status: EmailLogStatus.SENT,
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
    });

    await createAuditLogEntry({
      entityType: AuditEntityType.EMAIL,
      entityId: log.id,
      action: AuditActionType.MAIL_RETRIED,
      level: AuditLogLevel.INFO,
      status: EmailLogStatus.SENT,
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

    await prisma.emailLog.update({
      where: { id: log.id },
      data: {
        status: EmailLogStatus.FAILED,
        attemptCount: { increment: 1 },
        errorMessage,
        lastAttemptAt: new Date(),
      },
    });

    await createAuditLogEntry({
      entityType: AuditEntityType.EMAIL,
      entityId: log.id,
      action: AuditActionType.MAIL_FAILED,
      level: AuditLogLevel.ERROR,
      status: EmailLogStatus.FAILED,
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
          await prisma.emailLog.findMany({
            where: { status: EmailLogStatus.FAILED },
            select: { id: true },
            orderBy: { createdAt: "desc" },
            take: MAX_PAGE_SIZE,
          })
        ).map((row) => row.id);

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
