import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAnyPermission } from "@/lib/auth/route-guards";
import { trainerIdSchema, updateTrainerCoursesSchema } from "@/lib/validation-schemas/trainers";
import { updateTrainerCoursesService } from "@/services/trainers-service";

type RouteContext = {
  params: {
    trainerId: string;
  };
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    await requireAnyPermission(request, ["trainers.assign", "trainers.edit"]);
    const { trainerId } = trainerIdSchema.parse(params);
    const body = await request.json();
    const input = updateTrainerCoursesSchema.parse(body);
    const trainer = await updateTrainerCoursesService(trainerId, input);
    return apiSuccess(trainer);
  } catch (error) {
    return apiError(error);
  }
}