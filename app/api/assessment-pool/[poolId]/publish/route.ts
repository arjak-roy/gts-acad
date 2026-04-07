import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { publishAssessmentPoolService } from "@/services/assessment-pool-service";

type RouteContext = { params: { poolId: string } };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "assessment_pool.publish");
    const pool = await publishAssessmentPoolService(params.poolId, { actorUserId: session.userId });
    return apiSuccess(pool);
  } catch (error) {
    return apiError(error);
  }
}
