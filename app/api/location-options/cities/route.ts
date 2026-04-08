import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { listCitiesService } from "@/services/centers-service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "centers.view");
    const { searchParams } = new URL(request.url);
    const stateId = searchParams.get("stateId");
    const cities = await listCitiesService(stateId ? Number.parseInt(stateId, 10) : undefined);
    return apiSuccess(cities);
  } catch (error) {
    return apiError(error);
  }
}