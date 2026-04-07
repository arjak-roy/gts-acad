import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { folderIdSchema, updateCourseContentFolderSchema } from "@/lib/validation-schemas/course-content";
import {
  deleteCourseContentFolderService,
  getCourseContentFolderByIdService,
  updateCourseContentFolderService,
} from "@/services/course-content-folders-service";

type RouteContext = { params: { folderId: string } };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "course_content_folder.view");
    const { folderId } = folderIdSchema.parse(params);
    const folder = await getCourseContentFolderByIdService(folderId);
    if (!folder) {
      throw new Error("Folder not found.");
    }

    return apiSuccess(folder);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "course_content_folder.edit");
    const body = await request.json();
    const input = updateCourseContentFolderSchema.parse({ ...body, folderId: params.folderId });
    const folder = await updateCourseContentFolderService(input, { actorUserId: session.userId });
    return apiSuccess(folder);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "course_content_folder.delete");
    const { folderId } = folderIdSchema.parse(params);
    await deleteCourseContentFolderService(folderId, { actorUserId: session.userId });
    return apiSuccess({ success: true });
  } catch (error) {
    return apiError(error);
  }
}