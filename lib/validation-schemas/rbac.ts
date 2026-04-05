import { z } from "zod";

const CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,48}[A-Z0-9]$/;

export const createRoleSchema = z.object({
  name: z.string().trim().min(2).max(100),
  code: z
    .string()
    .trim()
    .min(3)
    .max(50)
    .regex(CODE_PATTERN, "Code must be uppercase alphanumeric with underscores (e.g. CONTENT_MANAGER)."),
  description: z.string().trim().max(500).optional().default(""),
  permissionIds: z.array(z.string().uuid()).optional().default([]),
});

export const updateRoleSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  code: z
    .string()
    .trim()
    .min(3)
    .max(50)
    .regex(CODE_PATTERN, "Code must be uppercase alphanumeric with underscores.")
    .optional(),
  description: z.string().trim().max(500).optional(),
  isActive: z.boolean().optional(),
});

export const setRolePermissionsSchema = z.object({
  permissionIds: z.array(z.string().uuid()),
});

export const assignUserRolesSchema = z.object({
  roleIds: z.array(z.string().uuid()).min(1, "At least one role is required."),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type SetRolePermissionsInput = z.infer<typeof setRolePermissionsSchema>;
export type AssignUserRolesInput = z.infer<typeof assignUserRolesSchema>;
