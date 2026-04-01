import { z } from "zod";

export const createBatchSchema = z.object({
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
  campus: z.string().trim().max(120).optional().default(""),
  startDate: z.string().trim().min(1),
  endDate: z.string().trim().optional().default(""),
  capacity: z.coerce.number().int().min(1).max(500).optional().default(25),
  mode: z.enum(["ONLINE", "OFFLINE"]).optional().default("OFFLINE"),
  status: z.enum(["DRAFT", "PLANNED", "IN_SESSION", "COMPLETED", "ARCHIVED", "CANCELLED"]).optional().default("PLANNED"),
  schedule: z.array(z.string().trim().min(1).max(100)).optional().default([]),
});

export const updateBatchSchema = createBatchSchema.extend({
  batchId: z.string().trim().min(1),
});

export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type UpdateBatchInput = z.infer<typeof updateBatchSchema>;
