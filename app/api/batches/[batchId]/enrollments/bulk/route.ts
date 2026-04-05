import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { batchBulkEnrollmentSchema, batchIdSchema } from "@/lib/validation-schemas/batches";
import { bulkEnrollLearnersToBatchService } from "@/services/batches-service";

type RouteContext = {
  params: {
    batchId: string;
  };
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "batches.edit");
    const { batchId } = batchIdSchema.parse(params);
    const body = await request.json();
    const input = batchBulkEnrollmentSchema.parse(body);
    const result = await bulkEnrollLearnersToBatchService(batchId, input.learnerCodes);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
