import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { listAssignedSharedCourseContentService } from "@/services/course-content-service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "course_content.view");
    const courseId = request.nextUrl.searchParams.get("courseId") || undefined;
    const contents = await listAssignedSharedCourseContentService(courseId);
    return apiSuccess(contents);
  } catch (error) {
    return apiError(error);
  }
}