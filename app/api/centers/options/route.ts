import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAnyPermission } from "@/lib/auth/route-guards";
import { listCenterOptionsService } from "@/services/centers-service";

export async function GET(request: NextRequest) {
  try {
    await requireAnyPermission(request, ["centers.view", "batches.view", "batches.create", "batches.edit"]);
    const centers = await listCenterOptionsService();
    return apiSuccess(centers);
  } catch (error) {
    return apiError(error);
  }
}