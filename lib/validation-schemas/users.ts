import { z } from "zod";

export const getUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(100).optional().default(""),
  status: z.enum(["ALL", "ACTIVE", "INACTIVE"]).default("ALL"),
  sortBy: z.enum(["name", "email", "createdAt", "lastLoginAt", "status"]).default("name"),
  sortDirection: z.enum(["asc", "desc"]).default("asc"),
});

export const userIdSchema = z.object({
  userId: z.string().uuid("Valid user id is required."),
});

export const createUserSchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(255),
  email: z.string().trim().email("Valid email is required.").max(255),
  phone: z.string().trim().max(20).optional().default(""),
  roleIds: z.array(z.string().uuid()).min(1, "At least one role is required."),
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(255).optional(),
    email: z.string().trim().email("Valid email is required.").max(255).optional(),
    phone: z.string().trim().max(20).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => value.name !== undefined || value.email !== undefined || value.phone !== undefined || value.isActive !== undefined, {
    message: "At least one field is required.",
  });

export type GetUsersInput = z.infer<typeof getUsersSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
