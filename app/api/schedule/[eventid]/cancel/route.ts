import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { cancelSessionSchema } from "@/lib/validation-schemas/schedule";
import { cancelSessionService } from "@/services/schedule";

type RouteContext = {
  params: {
    eventid: string;
  };
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, "schedule.edit");
    const body = await request.json();
    const input = cancelSessionSchema.parse(body);
    const result = await cancelSessionService(params.eventid, input.reason, session.userId);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
