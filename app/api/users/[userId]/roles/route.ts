import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { assignUserRolesSchema } from "@/lib/validation-schemas/rbac";
import { assignRolesToUser, getUserRoles } from "@/services/rbac-service";

type RouteContext = {
  params: {
    userId: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "users.view");
    const roles = await getUserRoles(params.userId);
    return apiSuccess(roles);
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "users.edit");
    const body = await request.json();
    const { roleIds } = assignUserRolesSchema.parse(body);
    await assignRolesToUser(params.userId, roleIds);
    return apiSuccess({ updated: true });
  } catch (error) {
    return apiError(error);
  }
}
