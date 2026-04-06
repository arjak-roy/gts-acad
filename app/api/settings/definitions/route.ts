import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { SETTINGS_PERMISSIONS } from "@/lib/settings/constants";
import { createSettingDefinitionSchema } from "@/lib/validation-schemas/settings";
import { createSettingDefinitionService, listSettingsCategoriesService } from "@/services/settings";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, SETTINGS_PERMISSIONS.manage);
    const categories = await listSettingsCategoriesService();
    return apiSuccess(categories);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, SETTINGS_PERMISSIONS.manage);
    const body = await request.json();
    const input = createSettingDefinitionSchema.parse(body);
    const setting = await createSettingDefinitionService(input, {
      actorUserId: session.userId,
    });
    return apiSuccess(setting, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}