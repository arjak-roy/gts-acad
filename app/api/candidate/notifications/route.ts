import { NextRequest } from "next/server";

import { withCors, handleCorsPreflight } from "@/lib/api-cors";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireCandidateSession } from "@/lib/auth/route-guards";
import { candidateNotificationsQuerySchema } from "@/lib/validation-schemas/notifications";
import { listCandidateNotificationsService } from "@/services/push-notifications";

const METHODS = ["GET", "OPTIONS"];

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request, METHODS);
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireCandidateSession(request);
    const query = candidateNotificationsQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    const notifications = await listCandidateNotificationsService(session.userId, query);
    return withCors(request, apiSuccess(notifications), METHODS);
  } catch (error) {
    return withCors(request, apiError(error), METHODS);
  }
}