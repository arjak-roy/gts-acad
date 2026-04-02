import { apiError, apiSuccess } from "@/lib/api-response";
import { archiveCourseService, getCourseByIdService, updateCourseService } from "@/services/courses-service";
import { courseIdSchema, updateCourseSchema } from "@/lib/validation-schemas/courses";

type RouteContext = {
  params: {
    courseId: string;
  };
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
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

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const body = await request.json();
    const input = updateCourseSchema.parse({ ...body, courseId: params.courseId });
    const course = await updateCourseService(input);
    return apiSuccess(course);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { courseId } = courseIdSchema.parse(params);
    const course = await archiveCourseService(courseId);
    return apiSuccess(course);
  } catch (error) {
    return apiError(error);
  }
}