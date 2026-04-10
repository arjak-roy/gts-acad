import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAnyPermission } from "@/lib/auth/route-guards";
import { getFileUploadServiceConfig, storeUploadedLearningResourceAsset, validateUploadedFileAgainstGlobalSettings } from "@/services/file-upload";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requireAnyPermission(request, ["learning_resources.create", "learning_resources.edit"]);
    const config = await getFileUploadServiceConfig();

    return apiSuccess({
      maximumFileUploadSizeBytes: config.globalSettings.maximumFileUploadSizeBytes,
      allowedFileTypes: config.globalSettings.allowedFileTypes,
      allowedImageTypes: config.globalSettings.allowedImageTypes,
      storageLocation: config.globalSettings.storageLocation,
      enableDocumentPreview: config.globalSettings.enableDocumentPreview,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAnyPermission(request, ["learning_resources.create", "learning_resources.edit"]);
    const formData = await request.formData();
    const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (files.length === 0) {
      throw new Error("Select at least one file to upload.");
    }

    const assets = [];
    for (const file of files) {
      await validateUploadedFileAgainstGlobalSettings(file);
      assets.push(await storeUploadedLearningResourceAsset(file));
    }

    return apiSuccess({
      assets,
      createdCount: assets.length,
    }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
