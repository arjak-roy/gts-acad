import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { bulkDeleteQuestionBankQuestionsSchema } from "@/lib/validation-schemas/question-bank";
import { bulkDeleteQuestionBankQuestionsService } from "@/services/question-bank-service";

export async function DELETE(request: NextRequest) {
  try {
    const session = await requirePermission(request, "assessment_pool.edit");
    const body = await request.json();
    const input = bulkDeleteQuestionBankQuestionsSchema.parse(body);
    const result = await bulkDeleteQuestionBankQuestionsService(input, { actorUserId: session.userId });
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}