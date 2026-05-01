import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { contentIdSchema } from "@/lib/validation-schemas/course-content";
import { restoreLearningResourceVersionSchema } from "@/lib/validation-schemas/learning-resources";
import { restoreCourseContentVersionService } from "@/services/course-content-service";

type RouteContext = { params: { contentId: string } };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "course_content.edit");
    const { contentId } = contentIdSchema.parse(params);
    const body = await request.json();
    const input = restoreLearningResourceVersionSchema.parse(body);
    const content = await restoreCourseContentVersionService(contentId, input, { actorUserId: session.userId });
    return apiSuccess(content);
  } catch (error) {
    return apiError(error);
  }
}