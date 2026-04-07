import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { contentIdSchema, updateContentSchema } from "@/lib/validation-schemas/course-content";
import { archiveContentService, getContentByIdService, updateContentService } from "@/services/course-content-service";

type RouteContext = { params: { contentId: string } };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "course_content.view");
    const { contentId } = contentIdSchema.parse(params);
    const content = await getContentByIdService(contentId);
    if (!content) throw new Error("Content not found.");
    return apiSuccess(content);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "course_content.edit");
    const body = await request.json();
    const input = updateContentSchema.parse({ ...body, contentId: params.contentId });
    const content = await updateContentService(input, { actorUserId: session.userId });
    return apiSuccess(content);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "course_content.delete");
    const { contentId } = contentIdSchema.parse(params);
    const content = await archiveContentService(contentId, { actorUserId: session.userId });
    return apiSuccess(content);
  } catch (error) {
    return apiError(error);
  }
}
