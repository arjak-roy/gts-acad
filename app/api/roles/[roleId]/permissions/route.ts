import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { setRolePermissionsSchema } from "@/lib/validation-schemas/rbac";
import { setRolePermissions } from "@/services/rbac-service";

type RouteContext = {
  params: {
    roleId: string;
  };
};

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "roles.edit");
    const body = await request.json();
    const { permissionIds } = setRolePermissionsSchema.parse(body);
    await setRolePermissions(params.roleId, permissionIds);
    return apiSuccess({ updated: true });
  } catch (error) {
    return apiError(error);
  }
}
