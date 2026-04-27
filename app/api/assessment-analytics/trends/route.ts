import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { trendAnalysisRequestSchema } from "@/lib/validation-schemas/assessment-analytics";
import { getAttemptTrends } from "@/services/assessment-analytics";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "assessment_reports.view");
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const filters = trendAnalysisRequestSchema.parse(params);
    const trends = await getAttemptTrends(filters);
    return apiSuccess(trends);
  } catch (error) {
    return apiError(error);
  }
}
