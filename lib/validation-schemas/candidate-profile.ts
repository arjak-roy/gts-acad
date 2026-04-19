import { z } from "zod";

const imageDataUriPattern = /^data:image\/(?:png|jpeg|jpg|webp);base64,[a-z0-9+/=\s]+$/i;

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

export const uploadCandidateSelfProfilePhotoSchema = z.object({
  photoDataUri: z
    .string()
    .trim()
    .min(1, "Profile photo is required.")
    .regex(imageDataUriPattern, "Upload a PNG, JPEG, or WEBP image."),
  fileName: z.string().trim().max(255).optional(),
});

export type UpdateCandidateSelfProfileInput = z.infer<typeof updateCandidateSelfProfileSchema>;
export type UploadCandidateSelfProfilePhotoInput = z.infer<typeof uploadCandidateSelfProfilePhotoSchema>;