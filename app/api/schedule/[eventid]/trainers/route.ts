import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { assignTrainerSchema } from "@/lib/validation-schemas/schedule";
import { listTrainerAssignments, assignTrainerToSession } from "@/services/schedule";

type RouteContext = {
  params: {
    eventid: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "schedule.view");
    const assignments = await listTrainerAssignments(params.eventid);
    return apiSuccess(assignments);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "schedule.edit");
    const body = await request.json();
    const input = assignTrainerSchema.parse(body);
    const result = await assignTrainerToSession(
      { scheduleEventId: params.eventid, trainerProfileId: input.trainerProfileId, role: input.role as any },
      session.userId,
    );
    return apiSuccess(result, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
