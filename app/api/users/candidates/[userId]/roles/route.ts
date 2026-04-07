import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { CANDIDATE_USERS_PERMISSIONS } from "@/lib/users/constants";
import { assignUserRolesSchema } from "@/lib/validation-schemas/rbac";
import { userIdSchema } from "@/lib/validation-schemas/users";
import { assignCandidateUserRolesService } from "@/services/users";

type RouteContext = {
  params: {
    userId: string;
  };
};

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, CANDIDATE_USERS_PERMISSIONS.edit);
    const { userId } = userIdSchema.parse(params);
    const body = await request.json();
    const { roleIds } = assignUserRolesSchema.parse(body);
    const user = await assignCandidateUserRolesService(userId, roleIds, session.userId);
    return apiSuccess(user);
  } catch (error) {
    return apiError(error);
  }
}
