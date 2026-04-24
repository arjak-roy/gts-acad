import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { trainerIdSchema } from "@/lib/validation-schemas/trainers";
import { getTrainerStatusHistoryService } from "@/services/trainers-service";

type RouteContext = {
  params: {
    trainerId: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "trainers.view");
    const { trainerId } = trainerIdSchema.parse(params);
    const history = await getTrainerStatusHistoryService(trainerId);
    return apiSuccess(history);
  } catch (error) {
    return apiError(error);
  }
}
