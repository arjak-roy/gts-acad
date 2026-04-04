import type { NextRequest } from "next/server";

import { getDashboardStatsSchema } from "@/lib/validation-schemas/dashboard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { getDashboardStatsService } from "@/services/dashboard-service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "dashboard.view");
    getDashboardStatsSchema.parse({});
    const stats = await getDashboardStatsService();
    return apiSuccess(stats);
  } catch (error) {
    return apiError(error);
  }
}