import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { listScheduleLearnerOptionsService } from "@/services/schedule-service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "schedule.view");
    const learners = await listScheduleLearnerOptionsService();
    return apiSuccess(learners);
  } catch (error) {
    return apiError(error);
  }
}