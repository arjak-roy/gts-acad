import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { trainerIdSchema, updateTrainerSchema } from "@/lib/validation-schemas/trainers";
import { archiveTrainerService, getTrainerByIdService, updateTrainerService } from "@/services/trainers-service";

type RouteContext = {
  params: {
    trainerId: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "trainers.view");
    const { trainerId } = trainerIdSchema.parse(params);
    const trainer = await getTrainerByIdService(trainerId);

    if (!trainer) {
      throw new Error("Trainer not found.");
    }

    return apiSuccess(trainer);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "trainers.edit");
    const body = await request.json();
    const input = updateTrainerSchema.parse({ ...body, trainerId: params.trainerId });
    const trainer = await updateTrainerService(input, { actorUserId: session.userId });
    return apiSuccess(trainer);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "trainers.delete");
    const { trainerId } = trainerIdSchema.parse(params);
    const trainer = await archiveTrainerService(trainerId, { actorUserId: session.userId });
    return apiSuccess(trainer);
  } catch (error) {
    return apiError(error);
  }
}
