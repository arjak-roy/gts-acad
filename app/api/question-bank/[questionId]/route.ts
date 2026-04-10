import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { questionBankQuestionIdSchema, updateQuestionBankQuestionSchema } from "@/lib/validation-schemas/question-bank";
import { deleteQuestionBankQuestionService, updateQuestionBankQuestionService } from "@/services/question-bank-service";

type RouteContext = { params: { questionId: string } };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "assessment_pool.edit");
    const body = await request.json();
    const input = updateQuestionBankQuestionSchema.parse({ ...body, questionId: params.questionId });
    const question = await updateQuestionBankQuestionService(input, { actorUserId: session.userId });
    return apiSuccess(question);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "assessment_pool.edit");
    const { questionId } = questionBankQuestionIdSchema.parse(params);
    await deleteQuestionBankQuestionService(questionId, { actorUserId: session.userId });
    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}