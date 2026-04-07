import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { createCourseContentFolderSchema } from "@/lib/validation-schemas/course-content";
import { createCourseContentFolderService, listCourseContentFoldersService } from "@/services/course-content-folders-service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "course_content_folder.view");
    const courseId = request.nextUrl.searchParams.get("courseId") || undefined;
    const folders = await listCourseContentFoldersService(courseId);
    return apiSuccess(folders);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "course_content_folder.create");
    const body = await request.json();
    const input = createCourseContentFolderSchema.parse(body);
    const folder = await createCourseContentFolderService(input, { actorUserId: session.userId });
    return apiSuccess(folder, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}