import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { generateAssessmentWithAi } from "@/services/assessment-pool-service";

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, "assessment_pool.create");
    const body = await request.json();
    const result = await generateAssessmentWithAi(body);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
