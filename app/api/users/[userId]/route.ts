import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { STAFF_USERS_PERMISSIONS } from "@/lib/users/constants";
import { updateUserSchema, userIdSchema } from "@/lib/validation-schemas/users";
import { getUserByIdService, updateInternalUserService } from "@/services/users";

type RouteContext = {
  params: {
    userId: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, STAFF_USERS_PERMISSIONS.view);
    const { userId } = userIdSchema.parse(params);
    const user = await getUserByIdService(userId);

    if (!user) {
      throw new Error("User not found.");
    }

    return apiSuccess(user);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, STAFF_USERS_PERMISSIONS.edit);
    const { userId } = userIdSchema.parse(params);
    const body = await request.json();
    const input = updateUserSchema.parse(body);
    const user = await updateInternalUserService(userId, input, session.userId);
    return apiSuccess(user);
  } catch (error) {
    return apiError(error);
  }
}
