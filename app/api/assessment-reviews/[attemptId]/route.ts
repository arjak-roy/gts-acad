import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { assessmentAttemptIdSchema, updateAssessmentAttemptStatusSchema } from "@/lib/validation-schemas/assessment-reviews";
import {
  getAssessmentReviewDetailService,
  updateAssessmentAttemptStatusService,
} from "@/services/assessment-reviews-service";

type RouteContext = {
  params: {
    attemptId: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "assessment_reviews.view");
    const { attemptId } = assessmentAttemptIdSchema.parse(params);
    const detail = await getAssessmentReviewDetailService({
      attemptId,
      userId: session.userId,
    });

    if (!detail) {
      throw new Error("Assessment review not found.");
    }

    return apiSuccess(detail);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "assessment_reviews.manage");
    const { attemptId } = assessmentAttemptIdSchema.parse(params);
    const body = await request.json();
    const input = updateAssessmentAttemptStatusSchema.parse(body);
    const detail = await updateAssessmentAttemptStatusService({
      attemptId,
      userId: session.userId,
      input,
    });
    return apiSuccess(detail);
  } catch (error) {
    return apiError(error);
  }
}