import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { assessmentAttemptIdSchema } from "@/lib/validation-schemas/assessment-reviews";
import { listAssessmentReviewHistoryService } from "@/services/assessment-reviews-service";

type RouteContext = {
  params: {
    attemptId: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "assessment_reviews.view");
    const { attemptId } = assessmentAttemptIdSchema.parse(params);
    const history = await listAssessmentReviewHistoryService({
      attemptId,
      userId: session.userId,
    });

    return apiSuccess(history);
  } catch (error) {
    return apiError(error);
  }
}
