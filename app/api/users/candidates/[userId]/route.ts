import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { CANDIDATE_USERS_PERMISSIONS } from "@/lib/users/constants";
import { userIdSchema } from "@/lib/validation-schemas/users";
import { updateCandidateUserSchema } from "@/lib/validation-schemas/candidate-users";
import { getCandidateUserByIdService, updateCandidateUserService } from "@/services/users";

type RouteContext = {
  params: {
    userId: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, CANDIDATE_USERS_PERMISSIONS.view);
    const { userId } = userIdSchema.parse(params);
    const user = await getCandidateUserByIdService(userId);

    if (!user) {
      throw new Error("Candidate user not found.");
    }

    return apiSuccess(user);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, CANDIDATE_USERS_PERMISSIONS.edit);
    const { userId } = userIdSchema.parse(params);
    const body = await request.json();
    const input = updateCandidateUserSchema.parse(body);
    const user = await updateCandidateUserService(userId, input, session.userId);
    return apiSuccess(user);
  } catch (error) {
    return apiError(error);
  }
}
