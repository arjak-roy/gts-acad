import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { assessmentPoolIdSchema, updateAssessmentPoolSchema } from "@/lib/validation-schemas/assessment-pool";
import { archiveAssessmentPoolService, getAssessmentPoolByIdService, updateAssessmentPoolService } from "@/services/assessment-pool-service";

type RouteContext = { params: { poolId: string } };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "assessment_pool.view");
    const { poolId } = assessmentPoolIdSchema.parse(params);
    const pool = await getAssessmentPoolByIdService(poolId);
    if (!pool) throw new Error("Assessment pool not found.");
    return apiSuccess(pool);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "assessment_pool.edit");
    const body = await request.json();
    const input = updateAssessmentPoolSchema.parse({ ...body, poolId: params.poolId });
    const pool = await updateAssessmentPoolService(input, { actorUserId: session.userId });
    return apiSuccess(pool);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "assessment_pool.delete");
    const { poolId } = assessmentPoolIdSchema.parse(params);
    const pool = await archiveAssessmentPoolService(poolId, { actorUserId: session.userId });
    return apiSuccess(pool);
  } catch (error) {
    return apiError(error);
  }
}
