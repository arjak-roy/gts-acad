import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { createTrainerSchema } from "@/lib/validation-schemas/trainers";
import { createTrainerService, listTrainersService } from "@/services/trainers-service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "trainers.view");
    const { searchParams } = new URL(request.url);
    const courseName = searchParams.get("courseName") ?? searchParams.get("programName") ?? undefined;
    const trainers = await listTrainersService(courseName);
    return apiSuccess(trainers);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, "trainers.create");
    const body = await request.json();
    const input = createTrainerSchema.parse(body);
    const trainer = await createTrainerService(input);
    return apiSuccess(trainer, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}