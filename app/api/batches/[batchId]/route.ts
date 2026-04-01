import { apiError, apiSuccess } from "@/lib/api-response";
import { updateBatchSchema } from "@/lib/validation-schemas/batches";
import { archiveBatchService, getBatchByIdService, updateBatchService } from "@/services/batches-service";

type RouteContext = {
  params: {
    batchId: string;
  };
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const batch = await getBatchByIdService(params.batchId);
    if (!batch) {
      throw new Error("Batch not found.");
    }

    return apiSuccess(batch);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const body = await request.json();
    const input = updateBatchSchema.parse({ ...body, batchId: params.batchId });
    const batch = await updateBatchService(input);
    return apiSuccess(batch);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const batch = await archiveBatchService(params.batchId);
    return apiSuccess(batch);
  } catch (error) {
    return apiError(error);
  }
}