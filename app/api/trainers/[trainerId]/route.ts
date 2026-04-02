import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireRequestModuleAccess } from "@/lib/auth/access";
import { trainerIdSchema, updateTrainerSchema } from "@/lib/validation-schemas/trainers";
import { archiveTrainerService, getTrainerByIdService, updateTrainerService } from "@/services/trainers-service";

type RouteContext = {
  params: {
    trainerId: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requireRequestModuleAccess(request, "trainers");
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
    await requireRequestModuleAccess(request, "trainers");
    const body = await request.json();
    const input = updateTrainerSchema.parse({ ...body, trainerId: params.trainerId });
    const trainer = await updateTrainerService(input);
    return apiSuccess(trainer);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    await requireRequestModuleAccess(request, "trainers");
    const { trainerId } = trainerIdSchema.parse(params);
    const trainer = await archiveTrainerService(trainerId);
    return apiSuccess(trainer);
  } catch (error) {
    return apiError(error);
  }
}
