import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { createQuestionBankQuestionSchema } from "@/lib/validation-schemas/question-bank";
import { createQuestionBankQuestionService, listQuestionBankQuestionsService } from "@/services/question-bank-service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "assessment_pool.view");
    const searchParams = request.nextUrl.searchParams;
    const questions = await listQuestionBankQuestionsService({
      courseId: searchParams.get("courseId") || undefined,
      questionType: searchParams.get("questionType") || undefined,
      search: searchParams.get("q") || undefined,
    });
    return apiSuccess(questions);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "assessment_pool.edit");
    const body = await request.json();
    const input = createQuestionBankQuestionSchema.parse(body);
    const question = await createQuestionBankQuestionService(input, { actorUserId: session.userId });
    return apiSuccess(question, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}