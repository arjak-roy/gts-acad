import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { SETTINGS_PERMISSIONS } from "@/lib/settings/constants";
import { validateUploadedFileAgainstGlobalSettings } from "@/services/file-upload";
import { getSettingByKeyService } from "@/services/settings";
import { storeSettingsAsset } from "@/services/settings/storage";

function getRuleNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, SETTINGS_PERMISSIONS.edit);
    const formData = await request.formData();
    const settingKey = String(formData.get("settingKey") ?? "").trim();
    const file = formData.get("file");

    if (!settingKey) {
      throw new Error("Setting key is required.");
    }

    if (!(file instanceof File)) {
      throw new Error("A file is required.");
    }

    const setting = await getSettingByKeyService(settingKey);
    if (!setting || setting.type !== "FILE") {
      throw new Error("Invalid file-upload setting.");
    }

    const allowedMimeTypes = Array.isArray(setting.validationRules.allowedMimeTypes)
      ? setting.validationRules.allowedMimeTypes.filter((entry): entry is string => typeof entry === "string")
      : [];

    if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(file.type)) {
      throw new Error("Uploaded file type is not allowed.");
    }

    const maxSizeBytes = getRuleNumber(setting.validationRules.maxSizeBytes);
    if (maxSizeBytes !== null && file.size > maxSizeBytes) {
      throw new Error("Uploaded file exceeds the allowed size.");
    }

    await validateUploadedFileAgainstGlobalSettings(file);

    const asset = await storeSettingsAsset(file, { settingKey });
    return apiSuccess(asset, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}