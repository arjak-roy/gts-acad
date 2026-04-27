import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { assessmentAnalyticsFiltersSchema } from "@/lib/validation-schemas/assessment-analytics";
import { getDashboardAnalyticsWidgets } from "@/services/assessment-analytics";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "assessment_reports.view");
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const filters = assessmentAnalyticsFiltersSchema.parse(params);
    const widgets = await getDashboardAnalyticsWidgets(filters);
    return apiSuccess(widgets);
  } catch (error) {
    return apiError(error);
  }
}
