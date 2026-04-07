import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { stageItemIdSchema, updateCurriculumStageItemSchema } from "@/lib/validation-schemas/curriculum";
import { deleteCurriculumStageItemService, updateCurriculumStageItemService } from "@/services/curriculum-service";

type RouteContext = { params: { itemId: string } };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "curriculum.edit");
    const body = await request.json();
    const input = updateCurriculumStageItemSchema.parse({ ...body, itemId: params.itemId });
    const item = await updateCurriculumStageItemService(input, { actorUserId: session.userId });
    return apiSuccess(item);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "curriculum.edit");
    const { itemId } = stageItemIdSchema.parse(params);
    await deleteCurriculumStageItemService(itemId, { actorUserId: session.userId });
    return apiSuccess({ success: true });
  } catch (error) {
    return apiError(error);
  }
}