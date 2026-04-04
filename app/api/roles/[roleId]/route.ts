import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { updateRoleSchema } from "@/lib/validation-schemas/rbac";
import { deleteRole, getRoleById, updateRole } from "@/services/rbac-service";

type RouteContext = {
  params: {
    roleId: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "roles.view");
    const role = await getRoleById(params.roleId);
    return apiSuccess(role);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "roles.edit");
    const body = await request.json();
    const input = updateRoleSchema.parse(body);
    const role = await updateRole(params.roleId, input);
    return apiSuccess(role);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "roles.delete");
    await deleteRole(params.roleId);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
