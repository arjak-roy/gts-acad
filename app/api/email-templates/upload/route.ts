import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAnyPermission } from "@/lib/auth/route-guards";
import { storeUploadedEmailTemplateAsset, validateUploadedFileAgainstGlobalSettings } from "@/services/file-upload";
import { getGeneralRuntimeSettings } from "@/services/settings/runtime";

export const runtime = "nodejs";

function normalizeOrigin(origin: string | undefined | null) {
  const normalized = origin?.trim();
  if (!normalized) {
    return null;
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized.replace(/\/$/, "");
  }

  return `https://${normalized}`.replace(/\/$/, "");
}

function resolvePreferredOrigin(requestOrigin: string | null, configuredOrigin: string | null) {
  if (!requestOrigin) {
    return configuredOrigin;
  }

  try {
    const hostname = new URL(requestOrigin).hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0") {
      return requestOrigin;
    }
  } catch {
    return configuredOrigin ?? requestOrigin;
  }

  return configuredOrigin ?? requestOrigin;
}

export async function POST(request: NextRequest) {
  try {
    await requireAnyPermission(request, ["email_templates.create", "email_templates.edit"]);

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size <= 0) {
      throw new Error("An image file is required.");
    }

    if (file.type && !file.type.startsWith("image/")) {
      throw new Error("Only image uploads are supported for email templates.");
    }

    await validateUploadedFileAgainstGlobalSettings(file);
    const asset = await storeUploadedEmailTemplateAsset(file);
    const generalSettings = await getGeneralRuntimeSettings();
    const baseOrigin = resolvePreferredOrigin(
      normalizeOrigin(request.nextUrl.origin),
      normalizeOrigin(generalSettings.applicationUrl),
    );

    return apiSuccess({
      fileName: asset.fileName,
      originalName: asset.originalName,
      mimeType: asset.mimeType,
      size: asset.size,
      storagePath: asset.storagePath,
      storageProvider: asset.storageProvider,
      relativeUrl: asset.url,
      url: baseOrigin ? new URL(asset.url, `${baseOrigin}/`).toString() : asset.url,
      uploadedAt: asset.uploadedAt,
    }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}