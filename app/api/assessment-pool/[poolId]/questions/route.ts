import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { createQuestionSchema } from "@/lib/validation-schemas/assessment-pool";
import { addQuestionService, listQuestionsService } from "@/services/assessment-pool-service";

type RouteContext = { params: { poolId: string } };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "assessment_pool.view");
    const questions = await listQuestionsService(params.poolId);
    return apiSuccess(questions);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "assessment_pool.edit");
    const body = await request.json();
    const input = createQuestionSchema.parse({ ...body, assessmentPoolId: params.poolId });
    const question = await addQuestionService(input, { actorUserId: session.userId });
    return apiSuccess(question, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
