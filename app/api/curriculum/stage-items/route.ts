import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { createCurriculumStageItemSchema, createCurriculumStageItemsSchema } from "@/lib/validation-schemas/curriculum";
import { createCurriculumStageItemsService } from "@/services/curriculum-service";

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "curriculum.edit");
    const body = await request.json();
    const isBatchRequest = Array.isArray(body?.contentIds) || Array.isArray(body?.assessmentPoolIds);
    const input = isBatchRequest
      ? createCurriculumStageItemsSchema.parse(body)
      : (() => {
        const singleItem = createCurriculumStageItemSchema.parse(body);

        return {
          stageId: singleItem.stageId,
          itemType: singleItem.itemType,
          contentIds: singleItem.contentId ? [singleItem.contentId] : [],
          assessmentPoolIds: singleItem.assessmentPoolId ? [singleItem.assessmentPoolId] : [],
          isRequired: singleItem.isRequired ?? false,
        };
      })();
    const items = await createCurriculumStageItemsService(input, { actorUserId: session.userId });
    return apiSuccess(isBatchRequest ? items : items[0], { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}