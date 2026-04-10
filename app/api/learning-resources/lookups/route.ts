import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { listLearningResourceLookupsService } from "@/services/learning-resource-service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "learning_resources.view");
    const lookups = await listLearningResourceLookupsService();
    return apiSuccess(lookups);
  } catch (error) {
    return apiError(error);
  }
}
