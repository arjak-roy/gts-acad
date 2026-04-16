import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAnyPermission } from "@/lib/auth/route-guards";
import {
  releaseCurriculumStageItemForBatchSchema,
  revokeCurriculumStageItemReleaseForBatchSchema,
} from "@/lib/validation-schemas/curriculum";
import {
  getCurriculaForBatchService,
  releaseCurriculumStageItemForBatchService,
  revokeCurriculumStageItemReleaseForBatchService,
} from "@/services/curriculum-service";

type RouteContext = {
  params: {
    batchId: string;
    itemId: string;
  };
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAnyPermission(request, ["batches.edit", "curriculum.edit"]);
    const body = await request.json().catch(() => ({}));
    const input = releaseCurriculumStageItemForBatchSchema.parse({
      ...body,
      batchId: params.batchId,
      itemId: params.itemId,
    });
    await releaseCurriculumStageItemForBatchService(input, { actorUserId: session.userId });
    const workspace = await getCurriculaForBatchService(params.batchId);
    return apiSuccess(workspace);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAnyPermission(request, ["batches.edit", "curriculum.edit"]);
    const body = await request.json().catch(() => ({}));
    const input = revokeCurriculumStageItemReleaseForBatchSchema.parse({
      ...body,
      batchId: params.batchId,
      itemId: params.itemId,
    });
    await revokeCurriculumStageItemReleaseForBatchService(input, { actorUserId: session.userId });
    const workspace = await getCurriculaForBatchService(params.batchId);
    return apiSuccess(workspace);
  } catch (error) {
    return apiError(error);
  }
}