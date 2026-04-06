import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { STAFF_USERS_PERMISSIONS } from "@/lib/users/constants";
import { assignUserRolesSchema } from "@/lib/validation-schemas/rbac";
import { userIdSchema } from "@/lib/validation-schemas/users";
import { assignInternalUserRolesService, getInternalUserRolesService } from "@/services/users";

type RouteContext = {
  params: {
    userId: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, STAFF_USERS_PERMISSIONS.view);
    const { userId } = userIdSchema.parse(params);
    const roles = await getInternalUserRolesService(userId);
    return apiSuccess(roles);
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, STAFF_USERS_PERMISSIONS.edit);
    const { userId } = userIdSchema.parse(params);
    const body = await request.json();
    const { roleIds } = assignUserRolesSchema.parse(body);
    const user = await assignInternalUserRolesService(userId, roleIds, {
      actorUserId: session.userId,
      actorRoleCode: session.role,
    });
    return apiSuccess(user);
  } catch (error) {
    return apiError(error);
  }
}
