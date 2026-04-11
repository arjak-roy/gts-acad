import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { trainerIdSchema, updateTrainerStatusSchema } from "@/lib/validation-schemas/trainers";
import { updateTrainerStatusService } from "@/services/trainers-service";

type RouteContext = {
  params: {
    trainerId: string;
  };
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "trainers.edit");
    const { trainerId } = trainerIdSchema.parse(params);
    const body = await request.json();
    const input = updateTrainerStatusSchema.parse(body);
    const trainer = await updateTrainerStatusService(trainerId, input.status);
    return apiSuccess(trainer);
  } catch (error) {
    return apiError(error);
  }
}