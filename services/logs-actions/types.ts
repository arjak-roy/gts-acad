import { Prisma } from "@prisma/client";

import { AuditActionType, AuditEntityType, AuditLogLevel, EmailLogCategory, EmailLogStatus } from "@/services/logs-actions/constants";

export type DeliveryAuditContext = {
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

export type EmailLogRow = {
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

export type AuditLogRow = {
  id: string;
  entityType: AuditEntityType;
  entityId: string | null;
  action: AuditActionType;
  level: AuditLogLevel;
  status: string | null;
  message: string;
  createdAt: Date;
};
