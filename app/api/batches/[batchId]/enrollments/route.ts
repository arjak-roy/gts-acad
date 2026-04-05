import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { batchEnrollmentSchema, batchIdSchema, getBatchEnrolledLearnersSchema } from "@/lib/validation-schemas/batches";
import { enrollLearnerToBatchService, getBatchEnrolledLearnersService } from "@/services/batches-service";

type RouteContext = {
  params: {
    batchId: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "batches.view");
    const { batchId } = batchIdSchema.parse(params);
    const { searchParams } = new URL(request.url);
    const input = getBatchEnrolledLearnersSchema.parse(Object.fromEntries(searchParams.entries()));
    const learners = await getBatchEnrolledLearnersService(batchId, input);
    return apiSuccess(learners);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "batches.edit");
    const { batchId } = batchIdSchema.parse(params);
    const body = await request.json();
    const input = batchEnrollmentSchema.parse(body);
    const learner = await enrollLearnerToBatchService(batchId, input.learnerCode);
    return apiSuccess(learner, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
