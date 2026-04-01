import { apiError, apiSuccess } from "@/lib/api-response";
import { trainerIdSchema, updateTrainerSchema } from "@/lib/validation-schemas/trainers";
import { archiveTrainerService, getTrainerByIdService, updateTrainerService } from "@/services/trainers-service";

type RouteContext = {
  params: {
    trainerId: string;
  };
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
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

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const body = await request.json();
    const input = updateTrainerSchema.parse({ ...body, trainerId: params.trainerId });
    const trainer = await updateTrainerService(input);
    return apiSuccess(trainer);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { trainerId } = trainerIdSchema.parse(params);
    const trainer = await archiveTrainerService(trainerId);
    return apiSuccess(trainer);
  } catch (error) {
    return apiError(error);
  }
}
