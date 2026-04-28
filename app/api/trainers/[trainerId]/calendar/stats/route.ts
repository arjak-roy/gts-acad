import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAnyPermission } from "@/lib/auth/route-guards";
import { getTrainerCalendarStats } from "@/services/trainers";

type RouteContext = {
  params: {
    trainerId: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requireAnyPermission(request, ["schedule.view", "trainers.view"]);
    const stats = await getTrainerCalendarStats(params.trainerId);
    return apiSuccess(stats);
  } catch (error) {
    return apiError(error);
  }
}
