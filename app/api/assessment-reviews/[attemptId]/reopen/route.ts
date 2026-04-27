import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { assessmentAttemptIdSchema, reopenAssessmentAttemptSchema } from "@/lib/validation-schemas/assessment-reviews";
import { reopenAssessmentAttemptService } from "@/services/assessment-reviews-service";

type RouteContext = {
  params: {
    attemptId: string;
  };
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "assessment_reviews.manage");
    const { attemptId } = assessmentAttemptIdSchema.parse(params);
    const body = await request.json();
    const input = reopenAssessmentAttemptSchema.parse(body);
    const detail = await reopenAssessmentAttemptService({
      attemptId,
      userId: session.userId,
      input,
    });

    return apiSuccess(detail);
  } catch (error) {
    return apiError(error);
  }
}
