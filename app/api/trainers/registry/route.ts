import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { getTrainerRegistrySchema } from "@/lib/validation-schemas/trainers";
import { getTrainerRegistryService } from "@/services/trainers-service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "trainers.view");
    const { searchParams } = new URL(request.url);
    const input = getTrainerRegistrySchema.parse(Object.fromEntries(searchParams.entries()));
    const trainers = await getTrainerRegistryService(input);
    return apiSuccess(trainers);
  } catch (error) {
    return apiError(error);
  }
}