import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { cancelScheduleEventSchema, updateScheduleEventSchema } from "@/lib/validation-schemas/schedule";
import { cancelScheduleEventService, getScheduleEventByIdService, updateScheduleEventService } from "@/services/schedule-service";

type RouteContext = {
  params: {
    eventid: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "schedule.view");
    const event = await getScheduleEventByIdService(params.eventid);
    if (!event) {
      throw new Error("Schedule event not found.");
    }

    return apiSuccess(event);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "schedule.edit");
    const body = await request.json();
    const input = updateScheduleEventSchema.parse({ ...body, eventId: params.eventid });
    const result = await updateScheduleEventService(input, session.userId);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "schedule.delete");
    const { searchParams } = new URL(request.url);
    const input = cancelScheduleEventSchema.parse({
      eventId: params.eventid,
      scope: searchParams.get("scope") ?? undefined,
    });

    const result = await cancelScheduleEventService(input, session.userId);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
