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

export const createLearnerEnrollmentSchema = z.object({
  batchCode: z.string().trim().min(2).max(50),
});

export const updateLearnerSchema = z
  .object({
    fullName: z.string().trim().min(2).max(255).optional(),
    email: z.string().trim().email().max(255).optional(),
    phone: z.string().trim().max(20).optional(),
    country: z.string().trim().max(100).optional(),
    dob: z.string().trim().optional(),
    gender: z.string().trim().max(20).optional(),
    targetCountry: z.string().trim().max(100).optional(),
    targetLanguage: z.string().trim().max(100).optional(),
    targetExam: z.enum(["IELTS", "OET", "NCLEX", "GOETHE_A1", "GOETHE_A2", "GOETHE_B1", "GOETHE_B2", "PROMETRIC"]).nullable().optional(),
  })
  .refine(
    (value) =>
      value.fullName !== undefined ||
      value.email !== undefined ||
      value.phone !== undefined ||
      value.country !== undefined ||
      value.dob !== undefined ||
      value.gender !== undefined ||
      value.targetCountry !== undefined ||
      value.targetLanguage !== undefined ||
      value.targetExam !== undefined,
    {
      message: "At least one field is required.",
    },
  );

export type GetLearnersInput = z.infer<typeof getLearnersSchema>;
export type CreateLearnerInput = z.infer<typeof createLearnerSchema>;
export type CreateLearnerEnrollmentInput = z.infer<typeof createLearnerEnrollmentSchema>;
export type UpdateLearnerInput = z.infer<typeof updateLearnerSchema>;