import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import {
  getFileUploadServiceConfig,
  storeUploadedCertificationBrandingAsset,
  validateUploadedFileAgainstGlobalSettings,
} from "@/services/file-upload";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "certifications.edit");
    const config = await getFileUploadServiceConfig();

    return apiSuccess({
      maximumFileUploadSizeBytes: config.globalSettings.maximumFileUploadSizeBytes,
      allowedImageTypes: config.globalSettings.allowedImageTypes,
      storageLocation: config.globalSettings.storageLocation,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, "certifications.edit");
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      throw new Error("Select an image file to upload.");
    }

    if (!file.type.startsWith("image/")) {
      throw new Error("Only image files are allowed for certificate branding.");
    }

    await validateUploadedFileAgainstGlobalSettings(file);
    const asset = await storeUploadedCertificationBrandingAsset(file);

    return apiSuccess({ asset }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
