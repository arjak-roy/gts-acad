import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { retakeGrantRequestSchema } from "@/lib/validation-schemas/assessment-analytics";
import { grantRetakeService, getRetakeGrantsForLearner } from "@/services/assessment-analytics";

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission(request, "assessments.manage");
    const body = await request.json();
    const input = retakeGrantRequestSchema.parse(body);
    const result = await grantRetakeService({ userId: user.userId, input });
    return apiSuccess(result, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "assessment_reports.view");
    const params = request.nextUrl.searchParams;
    const learnerId = params.get("learnerId");
    const assessmentPoolId = params.get("assessmentPoolId");
    const batchId = params.get("batchId");

    if (!learnerId || !assessmentPoolId || !batchId) {
      return apiError(new Error("learnerId, assessmentPoolId, and batchId are required"));
    }

    const grants = await getRetakeGrantsForLearner({
      learnerId,
      assessmentPoolId,
      batchId,
    });

    return apiSuccess(grants);
  } catch (error) {
    return apiError(error);
  }
}
