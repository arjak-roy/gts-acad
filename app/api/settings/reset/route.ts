import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { SETTINGS_PERMISSIONS } from "@/lib/settings/constants";
import { settingsResetSchema } from "@/lib/validation-schemas/settings";
import { resetSettingsCategoryService } from "@/services/settings";

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, SETTINGS_PERMISSIONS.edit);
    const body = await request.json();
    const input = settingsResetSchema.parse(body);
    const category = await resetSettingsCategoryService(input.categoryCode, {
      actorUserId: session.userId,
    });
    return apiSuccess(category);
  } catch (error) {
    return apiError(error);
  }
}