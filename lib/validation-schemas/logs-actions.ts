import { z } from "zod";

const positiveInt = z.coerce.number().int().min(1);

export const listEmailLogsSchema = z.object({
  page: positiveInt.default(1),
  pageSize: positiveInt.max(100).default(10),
  status: z.enum(["ALL", "PENDING", "SENT", "FAILED", "RETRYING"]).default("ALL"),
  category: z.enum(["ALL", "CANDIDATE_WELCOME", "TWO_FACTOR", "SYSTEM"]).default("ALL"),
  search: z.string().trim().max(120).optional().default(""),
});

export const listAuditLogsSchema = z.object({
  page: positiveInt.default(1),
  pageSize: positiveInt.max(100).default(10),
  entityType: z.enum(["ALL", "BATCH", "CANDIDATE", "COURSE", "EMAIL", "AUTH", "SYSTEM"]).default("ALL"),
  level: z.enum(["ALL", "INFO", "WARN", "ERROR"]).default("ALL"),
  action: z.enum(["ALL", "CREATED", "UPDATED", "ENROLLED", "MAIL_SENT", "MAIL_FAILED", "MAIL_RETRIED", "LOGIN", "TWO_FACTOR", "RETRY"]).default("ALL"),
  status: z.string().trim().max(50).optional().default(""),
  entityId: z.string().trim().max(120).optional().default(""),
  search: z.string().trim().max(120).optional().default(""),
});

export const bulkRetryEmailLogsSchema = z
  .object({
    mode: z.enum(["selected", "all-failed"]),
    ids: z.array(z.string().uuid()).default([]),
  })
  .superRefine((value, ctx) => {
    if (value.mode === "selected" && value.ids.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ids"],
        message: "At least one email log ID is required when mode is selected.",
      });
    }
  });

export const processEmailLogsSchema = z
  .object({
    mode: z.enum(["selected", "all-queued"]).default("all-queued"),
    ids: z.array(z.string().uuid()).default([]),
    limit: positiveInt.max(50).default(25),
  })
  .superRefine((value, ctx) => {
    if (value.mode === "selected" && value.ids.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ids"],
        message: "At least one email log ID is required when mode is selected.",
      });
    }
  });

export const emailLogIdSchema = z.object({
  emailLogId: z.string().uuid(),
});

export type ListEmailLogsInput = z.infer<typeof listEmailLogsSchema>;
export type ListAuditLogsInput = z.infer<typeof listAuditLogsSchema>;
export type BulkRetryEmailLogsInput = z.infer<typeof bulkRetryEmailLogsSchema>;
export type ProcessEmailLogsInput = z.infer<typeof processEmailLogsSchema>;
