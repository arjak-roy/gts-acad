import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { SETTINGS_PERMISSIONS } from "@/lib/settings/constants";
import { settingsCategoryCodeSchema, updateSettingsCategoryValuesSchema } from "@/lib/validation-schemas/settings";
import { getSettingsCategoryService, updateSettingsCategoryValuesService } from "@/services/settings";

type RouteContext = {
  params: {
    categoryCode: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requirePermission(request, SETTINGS_PERMISSIONS.view);
    const { categoryCode } = settingsCategoryCodeSchema.parse(params);
    const category = await getSettingsCategoryService(categoryCode);
    if (!category) {
      throw new Error("Settings category not found.");
    }

    return apiSuccess(category);
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, SETTINGS_PERMISSIONS.edit);
    const { categoryCode } = settingsCategoryCodeSchema.parse(params);
    const body = await request.json();
    const input = updateSettingsCategoryValuesSchema.parse(body);
    const category = await updateSettingsCategoryValuesService(categoryCode, input, {
      actorUserId: session.userId,
    });
    return apiSuccess(category);
  } catch (error) {
    return apiError(error);
  }
}