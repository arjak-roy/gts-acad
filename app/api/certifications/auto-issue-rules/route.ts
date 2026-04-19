import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { listAutoIssueRulesForCourseService } from "@/services/certifications/auto-issue-rules";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "certifications.view");
    const courseId = request.nextUrl.searchParams.get("courseId");
    if (!courseId) {
      return apiSuccess([]);
    }
    const rules = await listAutoIssueRulesForCourseService(courseId);
    return apiSuccess(rules);
  } catch (error) {
    return apiError(error);
  }
}
