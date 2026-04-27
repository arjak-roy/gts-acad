import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { learnerPerformanceRequestSchema } from "@/lib/validation-schemas/assessment-analytics";
import { getLearnerPerformanceReport } from "@/services/assessment-analytics";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "assessment_reports.view");
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const filters = learnerPerformanceRequestSchema.parse(params);
    const report = await getLearnerPerformanceReport(filters);
    return apiSuccess(report);
  } catch (error) {
    return apiError(error);
  }
}
