import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireRequestModuleAccess } from "@/lib/auth/access";
import { createCourseSchema } from "@/lib/validation-schemas/courses";
import { createCourseService, listCoursesService } from "@/services/courses-service";

export async function GET(request: NextRequest) {
  try {
    await requireRequestModuleAccess(request, "courses");
    const courses = await listCoursesService();
    return apiSuccess(courses);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRequestModuleAccess(request, "courses");
    const body = await request.json();
    const input = createCourseSchema.parse(body);
    const course = await createCourseService(input);
    return apiSuccess(course, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}