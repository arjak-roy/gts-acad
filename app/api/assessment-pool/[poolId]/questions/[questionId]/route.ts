import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { updateQuestionSchema, questionIdSchema } from "@/lib/validation-schemas/assessment-pool";
import { updateQuestionService, deleteQuestionService, getQuestionByIdService } from "@/services/assessment-pool-service";

type RouteContext = { params: { poolId: string; questionId: string } };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "assessment_pool.view");
    const { questionId } = questionIdSchema.parse(params);
    const question = await getQuestionByIdService(questionId);
    if (!question) {
      return apiError(new Error("Question not found."));
    }
    return apiSuccess(question);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "assessment_pool.edit");
    const body = await request.json();
    const input = updateQuestionSchema.parse({ ...body, questionId: params.questionId });
    const question = await updateQuestionService(input);
    return apiSuccess(question);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "assessment_pool.edit");
    const { questionId } = questionIdSchema.parse(params);
    await deleteQuestionService(questionId);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
