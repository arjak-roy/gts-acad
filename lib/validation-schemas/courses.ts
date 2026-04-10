import { z } from "zod";

import { CourseStatus } from "@/types";

const courseStatusSchema = z.enum([
  CourseStatus.DRAFT,
  CourseStatus.IN_REVIEW,
  CourseStatus.PUBLISHED,
  CourseStatus.ARCHIVED,
]);

export const createCourseSchema = z.object({
  code: z.string().trim().max(50).optional().default(""),
  name: z.string().trim().min(2).max(255),
  description: z.string().trim().max(2000).optional().default(""),
  status: courseStatusSchema.optional().default(CourseStatus.DRAFT),
  isActive: z.coerce.boolean().optional().default(true),
  programIds: z.array(z.string().trim().min(1)).optional().default([]),
  trainerIds: z.array(z.string().trim().min(1)).optional().default([]),
});

export const courseIdSchema = z.object({
  courseId: z.string().trim().min(1),
});

export const updateCourseSchema = z.object({
  courseId: z.string().trim().min(1),
  name: z.string().trim().min(2).max(255),
  description: z.string().trim().max(2000).optional().default(""),
  status: courseStatusSchema,
  isActive: z.coerce.boolean().optional().default(true),
  trainerIds: z.array(z.string().trim().min(1)).optional().default([]),
});

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;