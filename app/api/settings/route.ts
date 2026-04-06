import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { SETTINGS_PERMISSIONS } from "@/lib/settings/constants";
import { getSettingsOverviewService } from "@/services/settings";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, SETTINGS_PERMISSIONS.view);
    const overview = await getSettingsOverviewService();
    return apiSuccess(overview);
  } catch (error) {
    return apiError(error);
  }
}