import { Prisma } from "@prisma/client";

import { sendMail } from "@/lib/mail-service";
import { isDatabaseConfigured } from "@/lib/prisma-client";
import {
  AUDIT_ACTION_TYPE,
  AUDIT_ENTITY_TYPE,
  AUDIT_LOG_LEVEL,
  EMAIL_LOG_STATUS,
  MAX_PAGE_SIZE,
} from "@/services/logs-actions/constants";
import { prismaWithLogs } from "@/services/logs-actions/prisma";
import {
  DeliverLoggedEmailInput,
  EmailLogListResponse,
  EmailLogRow,
  ListEmailLogsInput,
  RetryBulkInput,
  RetryBulkResult,
} from "@/services/logs-actions/types";
import { mapEmailLog, resolvePagination, toErrorMessage } from "@/services/logs-actions/utils";
import type { EmailLogCategory, EmailLogStatus } from "@/services/logs-actions/constants";
import { createAuditLogEntry } from "@/services/logs-actions/audit-log-service";

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

  const typedRows = rows as EmailLogRow[];

  return {
    items: typedRows.map(mapEmailLog),
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
    })) as EmailLogRow;

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
