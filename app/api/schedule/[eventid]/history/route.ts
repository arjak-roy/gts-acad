import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { getSessionHistory } from "@/services/schedule";

type RouteContext = {
  params: {
    eventid: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, "schedule.view");
    const history = await getSessionHistory(params.eventid);
    return apiSuccess(history);
  } catch (error) {
    return apiError(error);
  }
}
