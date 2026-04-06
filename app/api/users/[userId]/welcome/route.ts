import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { STAFF_USERS_PERMISSIONS } from "@/lib/users/constants";
import { userIdSchema } from "@/lib/validation-schemas/users";
import { resendInternalUserWelcomeService } from "@/services/users";

type RouteContext = {
  params: {
    userId: string;
  };
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, STAFF_USERS_PERMISSIONS.edit);
    const { userId } = userIdSchema.parse(params);
    const user = await resendInternalUserWelcomeService(userId, session.userId);
    return apiSuccess(user);
  } catch (error) {
    return apiError(error);
  }
}
