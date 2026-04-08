import { NextRequest } from "next/server";

import { withCors, handleCorsPreflight } from "@/lib/api-cors";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireCandidateSession } from "@/lib/auth/route-guards";
import { updateCandidateSelfProfileSchema } from "@/lib/validation-schemas/candidate-profile";
import { getCandidateProfileByUserIdService, updateCandidateSelfProfileService } from "@/services/learners-service";

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request, ["GET", "PATCH", "OPTIONS"]);
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireCandidateSession(request);
    const profile = await getCandidateProfileByUserIdService(session.userId);

    if (!profile) {
      throw new Error("Candidate profile not found.");
    }

    const response = apiSuccess(profile);
    return withCors(request, response, ["GET", "PATCH", "OPTIONS"]);
  } catch (error) {
    return withCors(request, apiError(error), ["GET", "PATCH", "OPTIONS"]);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireCandidateSession(request);
    const body = await request.json();
    const input = updateCandidateSelfProfileSchema.parse(body);
    const profile = await updateCandidateSelfProfileService(session.userId, input, session.userId);

    const response = apiSuccess(profile);
    return withCors(request, response, ["GET", "PATCH", "OPTIONS"]);
  } catch (error) {
    return withCors(request, apiError(error), ["GET", "PATCH", "OPTIONS"]);
  }
}
