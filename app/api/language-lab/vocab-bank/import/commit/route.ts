import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { commitLanguageLabVocabImportSchema } from "@/lib/validation-schemas/language-lab";
import { commitLanguageLabVocabImportService } from "@/services/language-lab-vocab-bank-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "lms.edit");
    const body = await request.json();
    const input = commitLanguageLabVocabImportSchema.parse(body);
    const result = await commitLanguageLabVocabImportService(input, { actorUserId: session.userId });
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}