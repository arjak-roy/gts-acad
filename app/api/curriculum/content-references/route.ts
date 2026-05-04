import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { listCurriculumLearningResourceReferencesService } from "@/services/learning-resource-service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "curriculum.view");

    const courseId = request.nextUrl.searchParams.get("courseId")?.trim() ?? "";

    if (!courseId) {
      throw new Error("Course ID is required.");
    }

    const references = await listCurriculumLearningResourceReferencesService(courseId);
    return apiSuccess(references);
  } catch (error) {
    return apiError(error);
  }
}