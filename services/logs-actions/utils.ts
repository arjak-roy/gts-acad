import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/services/logs-actions/constants";
import { AuditLogListItem, AuditLogRow, EmailLogListItem, EmailLogRow } from "@/services/logs-actions/types";

export function resolvePagination(input: { page?: number; pageSize?: number }) {
  const page = Number.isFinite(input.page) && (input.page ?? 0) > 0 ? Number(input.page) : DEFAULT_PAGE;
  const requestedPageSize = Number.isFinite(input.pageSize) && (input.pageSize ?? 0) > 0 ? Number(input.pageSize) : DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE);

  return { page, pageSize };
}

export function mapEmailLog(item: EmailLogRow): EmailLogListItem {
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

export function mapAuditLog(item: AuditLogRow): AuditLogListItem {
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

export function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 1000);
  }

  return "Unexpected email delivery failure.";
}
