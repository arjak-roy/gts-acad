import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { replaceTrainerAssessmentAssignmentsSchema } from "@/lib/validation-schemas/assessment-reviews";
import { trainerIdSchema } from "@/lib/validation-schemas/trainers";
import {
  listTrainerAssessmentAssignmentsService,
  replaceTrainerAssessmentAssignmentsService,
} from "@/services/trainer-assessments-service";

type RouteContext = {
  params: {
    trainerId: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "trainers.manage");
    const { trainerId } = trainerIdSchema.parse(params);
    const assignments = await listTrainerAssessmentAssignmentsService(trainerId);
    return apiSuccess(assignments);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "trainers.manage");
    const { trainerId } = trainerIdSchema.parse(params);
    const body = await request.json();
    const input = replaceTrainerAssessmentAssignmentsSchema.parse(body);
    const assignments = await replaceTrainerAssessmentAssignmentsService({
      trainerId,
      assignments: input.assignments,
      actorUserId: session.userId,
    });
    return apiSuccess(assignments);
  } catch (error) {
    return apiError(error);
  }
}