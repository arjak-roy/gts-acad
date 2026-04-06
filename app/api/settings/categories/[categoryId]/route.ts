import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { SETTINGS_PERMISSIONS } from "@/lib/settings/constants";
import { settingsCategoryIdSchema, updateSettingsCategorySchema } from "@/lib/validation-schemas/settings";
import { deleteSettingsCategoryService, updateSettingsCategoryService } from "@/services/settings";

type RouteContext = {
  params: {
    categoryId: string;
  };
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, SETTINGS_PERMISSIONS.manage);
    const { categoryId } = settingsCategoryIdSchema.parse(params);
    const body = await request.json();
    const input = updateSettingsCategorySchema.parse({ ...body, categoryId });
    const category = await updateSettingsCategoryService(input, {
      actorUserId: session.userId,
    });
    return apiSuccess(category);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, SETTINGS_PERMISSIONS.manage);
    const { categoryId } = settingsCategoryIdSchema.parse(params);
    const result = await deleteSettingsCategoryService(categoryId, {
      actorUserId: session.userId,
    });
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}