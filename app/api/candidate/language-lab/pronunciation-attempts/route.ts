import { NextRequest } from "next/server";

import { handleCorsPreflight, withCors } from "@/lib/api-cors";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireCandidateSession } from "@/lib/auth/route-guards";
import { createPronunciationAttemptSchema } from "@/lib/validation-schemas/language-lab";
import { recordPronunciationAttemptService } from "@/services/language-lab-service";

const METHODS = ["POST", "OPTIONS"];

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request, METHODS);
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireCandidateSession(request);
    const body = await request.json();
    const input = createPronunciationAttemptSchema.parse(body);
    const attempt = await recordPronunciationAttemptService(session.userId, input);
    const response = apiSuccess(attempt, { status: 201 });
    return withCors(request, response, METHODS);
  } catch (error) {
    return withCors(request, apiError(error), METHODS);
  }
}