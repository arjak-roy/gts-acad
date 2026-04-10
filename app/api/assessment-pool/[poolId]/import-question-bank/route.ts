import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { importQuestionBankQuestionsSchema } from "@/lib/validation-schemas/question-bank";
import { importQuestionBankQuestionsToAssessmentService } from "@/services/question-bank-service";

type RouteContext = { params: { poolId: string } };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "assessment_pool.edit");
    const body = await request.json();
    const input = importQuestionBankQuestionsSchema.parse({ ...body, assessmentPoolId: params.poolId });
    const result = await importQuestionBankQuestionsToAssessmentService(input, { actorUserId: session.userId });
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}