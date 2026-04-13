import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { listCoursesService } from "@/services/courses-service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "lms.view");
    const courses = await listCoursesService();
    return apiSuccess(courses);
  } catch (error) {
    return apiError(error);
  }
}