import { NextRequest } from "next/server";

import { withCors, handleCorsPreflight } from "@/lib/api-cors";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireCandidateSession } from "@/lib/auth/route-guards";
import { candidatePushPreferencesSchema } from "@/lib/validation-schemas/notifications";
import {
  getCandidatePushPreferencesService,
  updateCandidatePushPreferencesService,
} from "@/services/push-notifications";

const METHODS = ["GET", "PATCH", "OPTIONS"];

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request, METHODS);
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireCandidateSession(request);
    const preferences = await getCandidatePushPreferencesService(session.userId);
    return withCors(request, apiSuccess(preferences), METHODS);
  } catch (error) {
    return withCors(request, apiError(error), METHODS);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireCandidateSession(request);
    const body = await request.json();
    const input = candidatePushPreferencesSchema.parse(body);
    const preferences = await updateCandidatePushPreferencesService(session.userId, input);
    return withCors(request, apiSuccess(preferences), METHODS);
  } catch (error) {
    return withCors(request, apiError(error), METHODS);
  }
}