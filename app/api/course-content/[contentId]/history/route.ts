import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { contentIdSchema } from "@/lib/validation-schemas/course-content";
import { listCourseContentVersionsService } from "@/services/course-content-service";

type RouteContext = { params: { contentId: string } };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "course_content.view");
    const { contentId } = contentIdSchema.parse(params);
    const versions = await listCourseContentVersionsService(contentId);
    return apiSuccess(versions);
  } catch (error) {
    return apiError(error);
  }
}