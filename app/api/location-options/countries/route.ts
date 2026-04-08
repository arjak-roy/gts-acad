import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { listCountriesService } from "@/services/centers-service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "centers.view");
    const countries = await listCountriesService();
    return apiSuccess(countries);
  } catch (error) {
    return apiError(error);
  }
}