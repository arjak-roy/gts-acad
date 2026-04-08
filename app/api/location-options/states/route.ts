import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { listStatesService } from "@/services/centers-service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "centers.view");
    const { searchParams } = new URL(request.url);
    const countryId = searchParams.get("countryId");
    const states = await listStatesService(countryId ? Number.parseInt(countryId, 10) : undefined);
    return apiSuccess(states);
  } catch (error) {
    return apiError(error);
  }
}