import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { assessmentAttemptIdSchema, gradeAssessmentAttemptSchema } from "@/lib/validation-schemas/assessment-reviews";
import { gradeAssessmentAttemptService } from "@/services/assessment-reviews-service";

type RouteContext = {
  params: {
    attemptId: string;
  };
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "assessment_reviews.grade");
    const { attemptId } = assessmentAttemptIdSchema.parse(params);
    const body = await request.json();
    const input = gradeAssessmentAttemptSchema.parse(body);
    const detail = await gradeAssessmentAttemptService({
      attemptId,
      userId: session.userId,
      input,
    });
    return apiSuccess(detail);
  } catch (error) {
    return apiError(error);
  }
}