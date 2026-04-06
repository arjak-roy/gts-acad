import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { SETTINGS_PERMISSIONS } from "@/lib/settings/constants";
import { settingsDefinitionIdSchema, updateSettingDefinitionSchema } from "@/lib/validation-schemas/settings";
import { deleteSettingDefinitionService, updateSettingDefinitionService } from "@/services/settings";

type RouteContext = {
  params: {
    settingId: string;
  };
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, SETTINGS_PERMISSIONS.manage);
    const { settingId } = settingsDefinitionIdSchema.parse(params);
    const body = await request.json();
    const input = updateSettingDefinitionSchema.parse({ ...body, settingId });
    const setting = await updateSettingDefinitionService(input, {
      actorUserId: session.userId,
    });
    return apiSuccess(setting);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requirePermission(request, SETTINGS_PERMISSIONS.manage);
    const { settingId } = settingsDefinitionIdSchema.parse(params);
    const result = await deleteSettingDefinitionService(settingId, {
      actorUserId: session.userId,
    });
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}