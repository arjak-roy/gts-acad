import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { rescheduleSessionSchema } from "@/lib/validation-schemas/schedule";
import { rescheduleSessionService } from "@/services/schedule";

type RouteContext = {
  params: {
    eventid: string;
  };
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "schedule.edit");
    const body = await request.json();
    const input = rescheduleSessionSchema.parse(body);
    const result = await rescheduleSessionService(
      params.eventid,
      input.startsAt,
      input.endsAt ?? null,
      input.reason,
      session.userId,
    );
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
