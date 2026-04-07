import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { stageIdSchema, updateCurriculumStageSchema } from "@/lib/validation-schemas/curriculum";
import { deleteCurriculumStageService, updateCurriculumStageService } from "@/services/curriculum-service";

type RouteContext = { params: { stageId: string } };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "curriculum.edit");
    const body = await request.json();
    const input = updateCurriculumStageSchema.parse({ ...body, stageId: params.stageId });
    const stage = await updateCurriculumStageService(input, { actorUserId: session.userId });
    return apiSuccess(stage);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "curriculum.edit");
    const { stageId } = stageIdSchema.parse(params);
    await deleteCurriculumStageService(stageId, { actorUserId: session.userId });
    return apiSuccess({ success: true });
  } catch (error) {
    return apiError(error);
  }
}