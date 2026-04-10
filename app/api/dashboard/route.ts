import type { NextRequest } from "next/server";

import { getDashboardStatsSchema } from "@/lib/validation-schemas/dashboard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { getDashboardStatsService } from "@/services/dashboard-service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "dashboard.view");
    const input = getDashboardStatsSchema.parse({
      programType: String(request.nextUrl.searchParams.get("programType") ?? "").trim() || undefined,
      courseId: String(request.nextUrl.searchParams.get("courseId") ?? "").trim() || undefined,
      programId: String(request.nextUrl.searchParams.get("programId") ?? "").trim() || undefined,
      batchId: String(request.nextUrl.searchParams.get("batchId") ?? "").trim() || undefined,
    });
    const stats = await getDashboardStatsService(input);
    return apiSuccess(stats);
  } catch (error) {
    return apiError(error);
  }
}