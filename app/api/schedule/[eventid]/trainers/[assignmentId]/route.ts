import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { updateTrainerRoleSchema } from "@/lib/validation-schemas/schedule";
import { removeTrainerFromSession, updateTrainerSessionRole } from "@/services/schedule";
import type { TrainerSessionRoleValue } from "@/services/schedule";

type RouteContext = {
  params: {
    eventid: string;
    assignmentId: string;
  };
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "schedule.edit");
    const body = await request.json();
    const input = updateTrainerRoleSchema.parse(body);
    const result = await updateTrainerSessionRole(params.assignmentId, input.role as TrainerSessionRoleValue, session.userId);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "schedule.edit");
    await removeTrainerFromSession(params.assignmentId, session.userId);
    return apiSuccess({ removed: true });
  } catch (error) {
    return apiError(error);
  }
}
