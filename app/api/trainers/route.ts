import { apiError, apiSuccess } from "@/lib/api-response";
import { createTrainerSchema } from "@/lib/validation-schemas/trainers";
import { createTrainerService, listTrainersService } from "@/services/trainers-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const programName = searchParams.get("programName") ?? undefined;
    const trainers = await listTrainersService(programName);
    return apiSuccess(trainers);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = createTrainerSchema.parse(body);
    const trainer = await createTrainerService(input);
    return apiSuccess(trainer, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}