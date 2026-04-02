import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireRequestModuleAccess } from "@/lib/auth/access";
import { createTrainerSchema } from "@/lib/validation-schemas/trainers";
import { createTrainerService, listTrainersService } from "@/services/trainers-service";

export async function GET(request: NextRequest) {
  try {
    await requireRequestModuleAccess(request, "trainers");
    const { searchParams } = new URL(request.url);
    const programName = searchParams.get("programName") ?? undefined;
    const trainers = await listTrainersService(programName);
    return apiSuccess(trainers);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRequestModuleAccess(request, "trainers");
    const body = await request.json();
    const input = createTrainerSchema.parse(body);
    const trainer = await createTrainerService(input);
    return apiSuccess(trainer, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}