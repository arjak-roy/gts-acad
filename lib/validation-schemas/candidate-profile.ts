import { z } from "zod";

export const updateCandidateSelfProfileSchema = z
  .object({
    fullName: z.string().trim().min(2).max(255).optional(),
    email: z.string().trim().email("Valid email is required.").max(255).optional(),
    phone: z.string().trim().max(20).optional(),
    country: z.string().trim().max(100).optional(),
    dob: z.string().trim().optional(),
    gender: z.string().trim().max(20).optional(),
  })
  .refine(
    (value) =>
      value.fullName !== undefined ||
      value.email !== undefined ||
      value.phone !== undefined ||
      value.country !== undefined ||
      value.dob !== undefined ||
      value.gender !== undefined,
    {
      message: "At least one field is required.",
    },
  );

export type UpdateCandidateSelfProfileInput = z.infer<typeof updateCandidateSelfProfileSchema>;