import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { createLanguageLabWordSchema, listLanguageLabWordsSchema } from "@/lib/validation-schemas/language-lab";
import { createLanguageLabWordService, listLanguageLabWordsService } from "@/services/language-lab-service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "lms.view");
    const input = listLanguageLabWordsSchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const words = await listLanguageLabWordsService(input);
    return apiSuccess(words);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "lms.edit");
    const body = await request.json();
    const input = createLanguageLabWordSchema.parse(body);
    const word = await createLanguageLabWordService(input, { actorUserId: session.userId });
    return apiSuccess(word, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}