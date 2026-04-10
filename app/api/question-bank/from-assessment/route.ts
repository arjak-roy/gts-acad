import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { duplicateAssessmentQuestionsToBankSchema } from "@/lib/validation-schemas/question-bank";
import { duplicateAssessmentQuestionsToBankService } from "@/services/question-bank-service";

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "assessment_pool.edit");
    const body = await request.json();
    const input = duplicateAssessmentQuestionsToBankSchema.parse(body);
    const result = await duplicateAssessmentQuestionsToBankService(input, { actorUserId: session.userId });
    return apiSuccess(result, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}