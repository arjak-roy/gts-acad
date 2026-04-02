import { z } from "zod";

export const createProgramSchema = z.object({
  courseId: z.string().trim().min(1, "Course is required."),
  name: z.string().trim().min(2).max(255),
  type: z.enum(["LANGUAGE", "CLINICAL", "TECHNICAL"]),
  durationWeeks: z.coerce.number().int().min(1).max(260),
  category: z.string().trim().max(100).optional().default(""),
  description: z.string().trim().max(2000).optional().default(""),
  isActive: z.coerce.boolean().optional().default(true),
  trainerIds: z.array(z.string().trim().min(1)).optional().default([]),
  batchIds: z.array(z.string().trim().min(1)).optional().default([]),
});

export const programIdSchema = z.object({
  programId: z.string().trim().min(1),
});

export const updateProgramSchema = createProgramSchema.extend({
  programId: z.string().trim().min(1),
  trainerIds: z.array(z.string().trim().min(1)).optional(),
  batchIds: z.array(z.string().trim().min(1)).optional(),
});

export type CreateProgramInput = z.infer<typeof createProgramSchema>;
export type UpdateProgramInput = z.infer<typeof updateProgramSchema>;
