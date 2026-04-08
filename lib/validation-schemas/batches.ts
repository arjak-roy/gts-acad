import { z } from "zod";

const batchSchemaObject = z.object({
  code: z
    .string()
    .trim()
    .max(50)
    .refine((val) => val === "" || val.length >= 2, "Code must be empty or at least 2 characters")
    .optional()
    .default(""),
  name: z.string().trim().min(2).max(100),
  programName: z.string().trim().min(2).max(255),
  trainerIds: z.array(z.string().trim().min(1).max(100)).optional().default([]),
  centreId: z.string().trim().max(120).optional().default(""),
  startDate: z.string().trim().min(1),
  endDate: z.string().trim().optional().default(""),
  capacity: z.coerce.number().int().min(1).max(500).optional().default(25),
  mode: z.enum(["ONLINE", "OFFLINE"]).optional().default("OFFLINE"),
  status: z.enum(["DRAFT", "PLANNED", "IN_SESSION", "COMPLETED", "ARCHIVED", "CANCELLED"]).optional().default("PLANNED"),
  schedule: z.array(z.string().trim().min(1).max(100)).optional().default([]),
});

function withCenterRequirement<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((input: z.infer<typeof batchSchemaObject>, context) => {
    if (input.mode === "OFFLINE" && input.centreId.trim().length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["centreId"],
        message: "A physical center is required for offline batches.",
      });
    }
  });
}

export const createBatchSchema = withCenterRequirement(batchSchemaObject);

export const updateBatchSchema = withCenterRequirement(
  batchSchemaObject.extend({
    batchId: z.string().trim().min(1),
  }),
);

export const batchIdSchema = z.object({
  batchId: z.string().trim().min(1).max(120),
});

export const batchEnrollmentSchema = z.object({
  learnerCode: z.string().trim().min(3).max(50),
});

export const batchBulkEnrollmentSchema = z.object({
  learnerCodes: z
    .array(z.string().trim().min(3).max(50))
    .min(1)
    .max(200)
    .transform((codes) => Array.from(new Set(codes.map((code) => code.trim())))),
});

export const getBatchEnrollmentCandidatesSchema = z.object({
  search: z.string().trim().max(100).optional().default(""),
  courseId: z.string().trim().max(120).optional().default(""),
  programId: z.string().trim().max(120).optional().default(""),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export const getBatchEnrolledLearnersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(100),
});

export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type UpdateBatchInput = z.infer<typeof updateBatchSchema>;
export type BatchEnrollmentInput = z.infer<typeof batchEnrollmentSchema>;
export type BatchBulkEnrollmentInput = z.infer<typeof batchBulkEnrollmentSchema>;
export type GetBatchEnrollmentCandidatesInput = z.infer<typeof getBatchEnrollmentCandidatesSchema>;
export type GetBatchEnrolledLearnersInput = z.infer<typeof getBatchEnrolledLearnersSchema>;
