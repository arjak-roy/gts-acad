import { z } from "zod";

export const getLearnersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().max(100).optional().default(""),
  batchCode: z.string().trim().max(50).optional().default(""),
  placementStatus: z.enum(["NOT_READY", "IN_REVIEW", "PLACEMENT_READY"]).optional(),
  sortBy: z.enum(["fullName", "attendancePercentage", "averageScore", "readinessPercentage"]).default("fullName"),
  sortDirection: z.enum(["asc", "desc"]).default("asc"),
});

export const learnerIdSchema = z.object({
  learnerCode: z.string().trim().min(3).max(50),
});

export const createLearnerSchema = z.object({
  fullName: z.string().trim().min(2).max(255),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(20).optional().default(""),
  programName: z.string().trim().min(2).max(255),
  batchCode: z.string().trim().max(50).optional().default(""),
  campus: z.string().trim().max(120).optional().default(""),
});

export type GetLearnersInput = z.infer<typeof getLearnersSchema>;
export type CreateLearnerInput = z.infer<typeof createLearnerSchema>;