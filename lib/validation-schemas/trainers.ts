import { z } from "zod";

export const createTrainerSchema = z.object({
  fullName: z.string().trim().min(2).max(255),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(20).optional().default(""),
  specialization: z.string().trim().min(2).max(255),
  capacity: z.coerce.number().int().min(0).max(100).optional().default(0),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  programs: z.array(z.string().trim().min(2).max(255)).min(1, "Select at least one program."),
  bio: z.string().trim().max(2000).optional().default(""),
});

export const trainerIdSchema = z.object({
  trainerId: z.string().trim().min(1),
});

export const updateTrainerSchema = createTrainerSchema.extend({
  trainerId: z.string().trim().min(1),
});

export type CreateTrainerInput = z.infer<typeof createTrainerSchema>;
export type UpdateTrainerInput = z.infer<typeof updateTrainerSchema>;