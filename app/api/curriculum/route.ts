import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { createCurriculumSchema } from "@/lib/validation-schemas/curriculum";
import { createCurriculumService, listCurriculaByCourseService } from "@/services/curriculum-service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "curriculum.view");
    const courseId = String(request.nextUrl.searchParams.get("courseId") ?? "").trim();

    if (!courseId) {
      throw new Error("Course ID is required.");
    }

    const curricula = await listCurriculaByCourseService(courseId);
    return apiSuccess(curricula);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "curriculum.create");
    const body = await request.json();
    const input = createCurriculumSchema.parse(body);
    const curriculum = await createCurriculumService(input, { actorUserId: session.userId });
    return apiSuccess(curriculum, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}