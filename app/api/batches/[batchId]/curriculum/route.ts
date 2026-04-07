import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAnyPermission, requirePermission } from "@/lib/auth/route-guards";
import {
  assignCurriculumToBatchSchema,
  removeCurriculumFromBatchSchema,
} from "@/lib/validation-schemas/curriculum";
import {
  assignCurriculumToBatchService,
  getCurriculaForBatchService,
  removeCurriculumFromBatchService,
} from "@/services/curriculum-service";

type RouteContext = {
  params: {
    batchId: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "batches.view");
    const workspace = await getCurriculaForBatchService(params.batchId);
    return apiSuccess(workspace);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAnyPermission(request, ["batches.edit", "curriculum.edit"]);
    const body = await request.json();
    const input = assignCurriculumToBatchSchema.parse({ ...body, batchId: params.batchId });
    await assignCurriculumToBatchService(input, { actorUserId: session.userId });
    const workspace = await getCurriculaForBatchService(params.batchId);
    return apiSuccess(workspace);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAnyPermission(request, ["batches.edit", "curriculum.edit"]);
    const body = await request.json();
    const input = removeCurriculumFromBatchSchema.parse({ ...body, batchId: params.batchId });
    await removeCurriculumFromBatchService(input, { actorUserId: session.userId });
    const workspace = await getCurriculaForBatchService(params.batchId);
    return apiSuccess(workspace);
  } catch (error) {
    return apiError(error);
  }
}