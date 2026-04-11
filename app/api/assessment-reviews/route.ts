import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { listAssessmentReviewQueueSchema } from "@/lib/validation-schemas/assessment-reviews";
import { listAssessmentReviewQueueService } from "@/services/assessment-reviews-service";

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission(request, "assessment_reviews.view");
    const filters = listAssessmentReviewQueueSchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const queue = await listAssessmentReviewQueueService({
      userId: session.userId,
      filters,
    });
    return apiSuccess(queue);
  } catch (error) {
    return apiError(error);
  }
}