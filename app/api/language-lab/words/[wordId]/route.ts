import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { languageLabWordIdSchema, updateLanguageLabWordSchema } from "@/lib/validation-schemas/language-lab";
import { getLanguageLabWordByIdService, updateLanguageLabWordService } from "@/services/language-lab-service";

type RouteContext = {
  params: {
    wordId: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "lms.view");
    const { wordId } = languageLabWordIdSchema.parse(params);
    const word = await getLanguageLabWordByIdService(wordId);

    if (!word) {
      throw new Error("Language Lab word not found.");
    }

    return apiSuccess(word);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "lms.edit");
    const { wordId } = languageLabWordIdSchema.parse(params);
    const body = await request.json();
    const input = updateLanguageLabWordSchema.parse(body);
    const word = await updateLanguageLabWordService(wordId, input, { actorUserId: session.userId });
    return apiSuccess(word);
  } catch (error) {
    return apiError(error);
  }
}