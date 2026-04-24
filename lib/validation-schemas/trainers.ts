import { z } from "zod";

import { TRAINER_IMPORT_MAX_ROWS } from "@/lib/imports/trainers";

const trainerStatusSchema = z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]);
const trainerAvailabilitySchema = z.enum(["AVAILABLE", "LIMITED", "UNAVAILABLE", "ON_LEAVE"]);
const trainerRegistryStatusSchema = z.enum(["ALL", "ACTIVE", "INACTIVE", "SUSPENDED"]);
const trainerRegistryAvailabilitySchema = z.enum(["ALL", "AVAILABLE", "LIMITED", "UNAVAILABLE", "ON_LEAVE"]);
const trainerRegistrySortSchema = z.enum([
  "fullName",
  "employeeCode",
  "email",
  "specialization",
  "department",
  "status",
  "availabilityStatus",
  "lastActiveAt",
]);

export const createTrainerSchema = z.object({
  fullName: z.string().trim().min(2).max(255),
  employeeCode: z.string().trim().min(2).max(50),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(20).optional().default(""),
  department: z.string().trim().max(255).optional().default(""),
  jobTitle: z.string().trim().max(255).optional().default(""),
  specialization: z.string().trim().min(2).max(255),
  skills: z.array(z.string().trim().min(1).max(100)).optional().default([]),
  certifications: z.array(z.string().trim().min(1).max(200)).optional().default([]),
  experienceYears: z.coerce.number().int().min(0).max(60).optional(),
  preferredLanguage: z.string().trim().max(100).optional().default(""),
  timeZone: z.string().trim().max(100).optional().default(""),
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
  department: z.string().trim().max(255).optional().default(""),
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
  reason: z.string().trim().max(500).optional().default(""),
});

export const updateTrainerCoursesSchema = z.object({
  courses: z.array(z.string().trim().min(1).max(255)).min(1, "Select at least one course."),
});

export const trainerImportCommitRowSchema = createTrainerSchema
  .omit({ department: true, jobTitle: true, skills: true, certifications: true, experienceYears: true, preferredLanguage: true, timeZone: true })
  .extend({
    rowNumber: z.coerce.number().int().min(2),
  });

export const commitTrainerImportSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  rows: z.array(trainerImportCommitRowSchema).min(1).max(TRAINER_IMPORT_MAX_ROWS),
});

export type CreateTrainerInput = z.infer<typeof createTrainerSchema>;
export type GetTrainerRegistryInput = z.infer<typeof getTrainerRegistrySchema>;
export type UpdateTrainerInput = z.infer<typeof updateTrainerSchema>;
export type UpdateTrainerStatusInput = z.infer<typeof updateTrainerStatusSchema>;
export type UpdateTrainerCoursesInput = z.infer<typeof updateTrainerCoursesSchema>;
export type TrainerImportCommitRow = z.infer<typeof trainerImportCommitRowSchema>;
export type CommitTrainerImportInput = z.infer<typeof commitTrainerImportSchema>;