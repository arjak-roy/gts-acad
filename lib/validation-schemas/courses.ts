import { z } from "zod";

export const createCourseSchema = z.object({
  code: z.string().trim().max(50).optional().default(""),
  name: z.string().trim().min(2).max(255),
  description: z.string().trim().max(2000).optional().default(""),
  isActive: z.coerce.boolean().optional().default(true),
  programIds: z.array(z.string().trim().min(1)).optional().default([]),
});

export const courseIdSchema = z.object({
  courseId: z.string().trim().min(1),
});

export const updateCourseSchema = z.object({
  courseId: z.string().trim().min(1),
  name: z.string().trim().min(2).max(255),
  description: z.string().trim().max(2000).optional().default(""),
  isActive: z.coerce.boolean().optional().default(true),
});

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;