import { NextRequest } from "next/server";

import { handleCorsPreflight, withCors } from "@/lib/api-cors";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireCandidateSession } from "@/lib/auth/route-guards";
import { listLanguageLabWordsSchema } from "@/lib/validation-schemas/language-lab";
import { listLanguageLabWordsService } from "@/services/language-lab-service";

const METHODS = ["GET", "OPTIONS"];

export function OPTIONS(request: NextRequest) {
  return handleCorsPreflight(request, METHODS);
}

export async function GET(request: NextRequest) {
  try {
    await requireCandidateSession(request);

    const input = listLanguageLabWordsSchema.parse({
      ...Object.fromEntries(request.nextUrl.searchParams.entries()),
      isActive: request.nextUrl.searchParams.get("isActive") ?? true,
    });
    const words = await listLanguageLabWordsService(input);
    const response = apiSuccess(words);
    return withCors(request, response, METHODS);
  } catch (error) {
    return withCors(request, apiError(error), METHODS);
  }
}