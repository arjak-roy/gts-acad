import { z } from "zod";

export const getCandidateUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().max(100).optional().default(""),
  status: z.enum(["ALL", "ACTIVE", "INACTIVE"]).default("ALL"),
  sortBy: z.enum(["name", "email", "createdAt", "lastLoginAt"]).default("name"),
  sortDirection: z.enum(["asc", "desc"]).default("asc"),
});

export const onboardCandidateSchema = z.object({
  fullName: z.string().trim().min(2, "Name is required.").max(255),
  email: z.string().trim().email("Valid email is required.").max(255),
  phone: z.string().trim().max(20).optional().default(""),
  programName: z.string().trim().min(2, "Program name is required.").max(255),
  batchCode: z.string().trim().max(50).optional().default(""),
  campus: z.string().trim().max(120).optional().default(""),
});

export const updateCandidateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(255).optional(),
    email: z.string().trim().email("Valid email is required.").max(255).optional(),
    phone: z.string().trim().max(20).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.email !== undefined ||
      value.phone !== undefined ||
      value.isActive !== undefined,
    { message: "At least one field is required." },
  );

export const candidateCustomMailSchema = z.object({
  subject: z.string().trim().min(2, "Subject is required.").max(255),
  body: z.string().trim().min(10, "Email body is required.").max(10000),
});

export type GetCandidateUsersInput = z.infer<typeof getCandidateUsersSchema>;
export type OnboardCandidateInput = z.infer<typeof onboardCandidateSchema>;
export type UpdateCandidateUserInput = z.infer<typeof updateCandidateUserSchema>;
export type CandidateCustomMailInput = z.infer<typeof candidateCustomMailSchema>;
