import type { NextRequest } from "next/server";

import { apiError } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { exportRequestSchema } from "@/lib/validation-schemas/assessment-analytics";
import {
  getAssessmentSummaryReport,
  getLearnerPerformanceReport,
  getQuestionAnalytics,
} from "@/services/assessment-analytics";
import {
  exportSummaryReport,
  exportLearnerPerformanceReport,
  exportQuestionAnalyticsReport,
} from "@/services/assessment-analytics/export";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "assessment_reports.view");
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const { format, reportType, ...filters } = exportRequestSchema.parse(params);

    switch (reportType) {
      case "summary": {
        const data = await getAssessmentSummaryReport(filters);
        return exportSummaryReport(format, data);
      }
      case "learner-performance": {
        const report = await getLearnerPerformanceReport({
          ...filters,
          page: 1,
          pageSize: 10000,
          sortBy: "learnerName",
          sortDirection: "asc",
        });
        return exportLearnerPerformanceReport(format, report.rows);
      }
      case "question-analytics": {
        if (!filters.assessmentPoolId) {
          return apiError(new Error("assessmentPoolId is required for question analytics export."));
        }
        const data = await getQuestionAnalytics({
          ...filters,
          assessmentPoolId: filters.assessmentPoolId,
          lowSuccessThreshold: 40,
        });
        return exportQuestionAnalyticsReport(format, data);
      }
      default:
        return apiError(new Error("Invalid report type."));
    }
  } catch (error) {
    return apiError(error);
  }
}
