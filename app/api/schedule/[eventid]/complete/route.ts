import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { completeSessionSchema } from "@/lib/validation-schemas/schedule";
import { completeSessionService } from "@/services/schedule";

type RouteContext = {
  params: {
    eventid: string;
  };
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "schedule.edit");
    const body = await request.json();
    const input = completeSessionSchema.parse(body);
    const result = await completeSessionService(
      params.eventid,
      input.completionNotes ?? null,
      input.attendanceCount ?? null,
      session.userId,
    );
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
