import { NextRequest } from "next/server";

import { withCors, handleCorsPreflight } from "@/lib/api-cors";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireCandidateSession } from "@/lib/auth/route-guards";
import { candidateNotificationIdSchema } from "@/lib/validation-schemas/notifications";
import { markCandidateNotificationReadService } from "@/services/push-notifications";

type RouteContext = {
  params: {
    notificationId: string;
  };
};

const METHODS = ["POST", "OPTIONS"];

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request, METHODS);
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireCandidateSession(request);
    const { notificationId } = candidateNotificationIdSchema.parse(params);
    const result = await markCandidateNotificationReadService(session.userId, notificationId);
    return withCors(request, apiSuccess(result), METHODS);
  } catch (error) {
    return withCors(request, apiError(error), METHODS);
  }
}