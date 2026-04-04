import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { updateBatchSchema } from "@/lib/validation-schemas/batches";
import { archiveBatchService, getBatchByIdService, updateBatchService } from "@/services/batches-service";

type RouteContext = {
  params: {
    batchId: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "batches.view");
    const batch = await getBatchByIdService(params.batchId);
    if (!batch) {
      throw new Error("Batch not found.");
    }

    return apiSuccess(batch);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "batches.edit");
    const body = await request.json();
    const input = updateBatchSchema.parse({ ...body, batchId: params.batchId });
    const batch = await updateBatchService(input);
    return apiSuccess(batch);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "batches.delete");
    const batch = await archiveBatchService(params.batchId);
    return apiSuccess(batch);
  } catch (error) {
    return apiError(error);
  }
}