import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { CANDIDATE_USERS_PERMISSIONS } from "@/lib/users/constants";
import { userIdSchema } from "@/lib/validation-schemas/users";
import { sendCandidatePasswordResetService } from "@/services/users";

type RouteContext = {
  params: {
    userId: string;
  };
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, CANDIDATE_USERS_PERMISSIONS.edit);
    const { userId } = userIdSchema.parse(params);
    const result = await sendCandidatePasswordResetService(userId, session.userId);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
