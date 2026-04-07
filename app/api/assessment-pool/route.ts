import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { createAssessmentPoolSchema } from "@/lib/validation-schemas/assessment-pool";
import { createAssessmentPoolService, listAssessmentPoolsService } from "@/services/assessment-pool-service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "assessment_pool.view");
    const searchParams = request.nextUrl.searchParams;
    const filters = {
      courseId: searchParams.get("courseId") || undefined,
      questionType: searchParams.get("questionType") || undefined,
      difficultyLevel: searchParams.get("difficultyLevel") || undefined,
      status: searchParams.get("status") || undefined,
    };
    const pools = await listAssessmentPoolsService(filters);
    return apiSuccess(pools);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "assessment_pool.create");
    const body = await request.json();
    const input = createAssessmentPoolSchema.parse(body);
    const pool = await createAssessmentPoolService(input, { actorUserId: session.userId });
    return apiSuccess(pool, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
