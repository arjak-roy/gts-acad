import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { learnerComparisonRequestSchema } from "@/lib/validation-schemas/assessment-analytics";
import { getLearnerComparison } from "@/services/assessment-analytics";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "assessment_reports.view");
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    // learnerIds comes as comma-separated in URL
    const parsed = {
      ...params,
      learnerIds: params.learnerIds?.split(",").map((id: string) => id.trim()).filter(Boolean),
    };
    const filters = learnerComparisonRequestSchema.parse(parsed);
    const comparison = await getLearnerComparison(filters);
    return apiSuccess(comparison);
  } catch (error) {
    return apiError(error);
  }
}
