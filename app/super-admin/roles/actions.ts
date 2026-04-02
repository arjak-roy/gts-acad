"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assignRoleToUserService, deleteRoleService, upsertRoleService } from "@/services/roles-service";

const roleSchema = z.object({
  roleId: z.string().trim().min(1),
  name: z.string().trim().min(2, "Role name is required."),
  description: z.string().trim().optional(),
  permissionKeys: z.array(z.string().trim()).default([]),
});

export async function upsertRole(roleId: string, name: string, description: string, permissionKeys: string[]) {
  const parsed = roleSchema.parse({ roleId, name, description, permissionKeys });
  const role = await upsertRoleService(parsed.roleId, parsed.name, parsed.description, parsed.permissionKeys);

  revalidatePath("/super-admin/roles");
  revalidatePath(`/super-admin/roles/${role.id}`);

  return { ok: true as const, roleId: role.id };
}

export async function deleteRole(roleId: string) {
  await deleteRoleService(roleId);
  revalidatePath("/super-admin/roles");
  return { ok: true as const };
}

export async function assignRoleToUser(userId: string, roleId: string) {
  const user = await assignRoleToUserService(userId, roleId);
  revalidatePath("/super-admin/users");
  revalidatePath("/super-admin/roles");
  return { ok: true as const, userId: user.id };
}