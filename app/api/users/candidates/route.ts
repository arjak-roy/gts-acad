import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { CANDIDATE_USERS_PERMISSIONS } from "@/lib/users/constants";
import { getCandidateUsersSchema, onboardCandidateSchema } from "@/lib/validation-schemas/candidate-users";
import { getCandidateUsersService, onboardCandidateService } from "@/services/users";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, CANDIDATE_USERS_PERMISSIONS.view);
    const { searchParams } = new URL(request.url);
    const input = getCandidateUsersSchema.parse(Object.fromEntries(searchParams.entries()));
    const result = await getCandidateUsersService(input);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, CANDIDATE_USERS_PERMISSIONS.create);
    const body = await request.json();
    const input = onboardCandidateSchema.parse(body);
    const user = await onboardCandidateService(input, session.userId);
    return apiSuccess(user, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
