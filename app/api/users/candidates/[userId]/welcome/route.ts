import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { CANDIDATE_USERS_PERMISSIONS } from "@/lib/users/constants";
import { userIdSchema } from "@/lib/validation-schemas/users";
import { resendCandidateWelcomeService } from "@/services/users";

type RouteContext = {
  params: {
    userId: string;
  };
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, CANDIDATE_USERS_PERMISSIONS.edit);
    const { userId } = userIdSchema.parse(params);
    const user = await resendCandidateWelcomeService(userId, session.userId);
    return apiSuccess(user);
  } catch (error) {
    return apiError(error);
  }
}
