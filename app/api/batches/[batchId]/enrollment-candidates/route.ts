import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { batchIdSchema, getBatchEnrollmentCandidatesSchema } from "@/lib/validation-schemas/batches";
import { getBatchEnrollmentCandidatesService } from "@/services/batches-service";

type RouteContext = {
  params: {
    batchId: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "batches.edit");
    const { batchId } = batchIdSchema.parse(params);
    const { searchParams } = new URL(request.url);
    const input = getBatchEnrollmentCandidatesSchema.parse(Object.fromEntries(searchParams.entries()));
    const candidates = await getBatchEnrollmentCandidatesService(batchId, input);
    return apiSuccess(candidates);
  } catch (error) {
    return apiError(error);
  }
}
