import type { NextRequest } from "next/server";

import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { batchIdSchema } from "@/lib/validation-schemas/batches";
import { assignTrainerToBatchService } from "@/services/batches-service";

const assignTrainerSchema = z.object({
  trainerId: z.string().trim().min(1),
});

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
    const input = assignTrainerSchema.parse(body);
    const batch = await assignTrainerToBatchService(batchId, input.trainerId);
    return apiSuccess(batch);
  } catch (error) {
    return apiError(error);
  }
}