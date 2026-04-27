import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { questionAnalyticsRequestSchema } from "@/lib/validation-schemas/assessment-analytics";
import { getQuestionAnalytics, getMostDifficultQuestions } from "@/services/assessment-analytics";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "assessment_reports.view");
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const filters = questionAnalyticsRequestSchema.parse(params);

    const [questions, difficult] = await Promise.all([
      getQuestionAnalytics(filters),
      getMostDifficultQuestions({ assessmentPoolId: filters.assessmentPoolId, status: "ALL", limit: 10 }),
    ]);

    return apiSuccess({ questions, mostDifficult: difficult });
  } catch (error) {
    return apiError(error);
  }
}
