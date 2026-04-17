import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { listScheduleTrainerOptionsService } from "@/services/schedule-service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "schedule.view");
    const trainers = await listScheduleTrainerOptionsService();
    return apiSuccess(trainers);
  } catch (error) {
    return apiError(error);
  }
}