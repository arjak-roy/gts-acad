import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { createCourseSchema } from "@/lib/validation-schemas/courses";
import { createCourseService, listCoursesService } from "@/services/courses-service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "courses.view");
    const courses = await listCoursesService();
    return apiSuccess(courses);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, "courses.create");
    const body = await request.json();
    const input = createCourseSchema.parse(body);
    const course = await createCourseService(input);
    return apiSuccess(course, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}