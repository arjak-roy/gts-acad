import { NextRequest } from "next/server";

import { handleCorsPreflight, withCors } from "@/lib/api-cors";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireCandidateSession } from "@/lib/auth/route-guards";
import { analyzePronunciationSchema } from "@/lib/validation-schemas/language-lab";
import { analyzePronunciationService } from "@/services/language-lab-service";
import { getLanguageLabRuntimeSettings } from "@/services/settings";

const METHODS = ["POST", "OPTIONS"];

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request, METHODS);
}

export async function POST(request: NextRequest) {
  try {
    await requireCandidateSession(request);
    const body = await request.json();
    const input = analyzePronunciationSchema.parse(body);

    const settings = await getLanguageLabRuntimeSettings();

    const analysis = await analyzePronunciationService(input, settings);
    const response = apiSuccess(analysis);
    return withCors(request, response, METHODS);
  } catch (error) {
    return withCors(request, apiError(error), METHODS);
  }
}
