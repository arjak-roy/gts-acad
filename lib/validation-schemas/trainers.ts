import { z } from "zod";

const trainerStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);
const trainerAvailabilitySchema = z.enum(["AVAILABLE", "LIMITED", "UNAVAILABLE", "ON_LEAVE"]);
const trainerRegistryStatusSchema = z.enum(["ALL", "ACTIVE", "INACTIVE"]);
const trainerRegistryAvailabilitySchema = z.enum(["ALL", "AVAILABLE", "LIMITED", "UNAVAILABLE", "ON_LEAVE"]);
const trainerRegistrySortSchema = z.enum([
  "fullName",
  "employeeCode",
  "email",
  "specialization",
  "status",
  "availabilityStatus",
  "lastActiveAt",
]);

export const createTrainerSchema = z.object({
  fullName: z.string().trim().min(2).max(255),
  employeeCode: z.string().trim().min(2).max(50),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(20).optional().default(""),
  specialization: z.string().trim().min(2).max(255),
  capacity: z.coerce.number().int().min(0).max(100).optional().default(0),
  status: trainerStatusSchema.default("ACTIVE"),
  availabilityStatus: trainerAvailabilitySchema.default("AVAILABLE"),
  courses: z.array(z.string().trim().min(2).max(255)).min(1, "Select at least one course."),
  bio: z.string().trim().max(2000).optional().default(""),
});

export const getTrainerRegistrySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().max(100).optional().default(""),
  status: trainerRegistryStatusSchema.default("ALL"),
  availability: trainerRegistryAvailabilitySchema.default("ALL"),
  specialization: z.string().trim().max(255).optional().default(""),
  courseId: z.union([z.string().trim().uuid(), z.literal("")]).optional().default(""),
  sortBy: trainerRegistrySortSchema.default("fullName"),
  sortDirection: z.enum(["asc", "desc"]).default("asc"),
});

export const trainerIdSchema = z.object({
  trainerId: z.string().trim().min(1),
});

export const updateTrainerSchema = createTrainerSchema.extend({
  trainerId: z.string().trim().min(1),
});

export const updateTrainerStatusSchema = z.object({
  status: trainerStatusSchema,
});

export const updateTrainerCoursesSchema = z.object({
  courses: z.array(z.string().trim().min(1).max(255)).min(1, "Select at least one course."),
});

export type CreateTrainerInput = z.infer<typeof createTrainerSchema>;
export type GetTrainerRegistryInput = z.infer<typeof getTrainerRegistrySchema>;
export type UpdateTrainerInput = z.infer<typeof updateTrainerSchema>;
export type UpdateTrainerStatusInput = z.infer<typeof updateTrainerStatusSchema>;
export type UpdateTrainerCoursesInput = z.infer<typeof updateTrainerCoursesSchema>;