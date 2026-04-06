import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { SETTINGS_PERMISSIONS } from "@/lib/settings/constants";
import { createSettingsCategorySchema } from "@/lib/validation-schemas/settings";
import { createSettingsCategoryService, listSettingsCategoriesService } from "@/services/settings";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, SETTINGS_PERMISSIONS.view);
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
    const input = createSettingsCategorySchema.parse(body);
    const category = await createSettingsCategoryService(input, {
      actorUserId: session.userId,
    });
    return apiSuccess(category, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}