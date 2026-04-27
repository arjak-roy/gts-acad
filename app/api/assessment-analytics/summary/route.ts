import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { assessmentSummaryRequestSchema } from "@/lib/validation-schemas/assessment-analytics";
import { getAssessmentSummaryReport, getPassFailStats } from "@/services/assessment-analytics";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "assessment_reports.view");
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const filters = assessmentSummaryRequestSchema.parse(params);

    const [summary, passFailStats] = await Promise.all([
      getAssessmentSummaryReport(filters),
      getPassFailStats(filters),
    ]);

    return apiSuccess({ summary, passFailStats });
  } catch (error) {
    return apiError(error);
  }
}
