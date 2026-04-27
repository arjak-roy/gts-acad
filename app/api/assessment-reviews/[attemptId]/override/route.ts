import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { assessmentAttemptIdSchema, overrideAssessmentAttemptSchema } from "@/lib/validation-schemas/assessment-reviews";
import { overrideAssessmentAttemptService } from "@/services/assessment-reviews-service";

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
    const input = overrideAssessmentAttemptSchema.parse(body);
    const detail = await overrideAssessmentAttemptService({
      attemptId,
      userId: session.userId,
      input,
    });

    return apiSuccess(detail);
  } catch (error) {
    return apiError(error);
  }
}
