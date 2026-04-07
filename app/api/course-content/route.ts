import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { createContentSchema } from "@/lib/validation-schemas/course-content";
import { createContentService, listCourseContentService } from "@/services/course-content-service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "course_content.view");
    const courseId = request.nextUrl.searchParams.get("courseId") || undefined;
    const folderId = request.nextUrl.searchParams.get("folderId") || undefined;
    const contents = await listCourseContentService(courseId, folderId);
    return apiSuccess(contents);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "course_content.create");
    const body = await request.json();
    const input = createContentSchema.parse(body);
    const content = await createContentService(input, { actorUserId: session.userId });
    return apiSuccess(content, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
