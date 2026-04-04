import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { archiveCourseService, getCourseByIdService, updateCourseService } from "@/services/courses-service";
import { courseIdSchema, updateCourseSchema } from "@/lib/validation-schemas/courses";

type RouteContext = {
  params: {
    courseId: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "courses.view");
    const { courseId } = courseIdSchema.parse(params);
    const course = await getCourseByIdService(courseId);

    if (!course) {
      throw new Error("Course not found.");
    }

    return apiSuccess(course);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "courses.edit");
    const body = await request.json();
    const input = updateCourseSchema.parse({ ...body, courseId: params.courseId });
    const course = await updateCourseService(input);
    return apiSuccess(course);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "courses.delete");
    const { courseId } = courseIdSchema.parse(params);
    const course = await archiveCourseService(courseId);
    return apiSuccess(course);
  } catch (error) {
    return apiError(error);
  }
}