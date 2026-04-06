import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { isStoredSettingsAsset } from "@/lib/settings/validation";
import { getBrandingCanonicalStoragePath, getBrandingSettingKey } from "@/services/file-upload/config";
import { resolveStoredAssetResponse } from "@/services/file-upload/service";
import type { BrandingAssetSlot } from "@/services/file-upload/types";
import { getFileUploadServiceConfig } from "@/services/file-upload/config";
import { getSettingByKeyService } from "@/services/settings/queries";

const FALLBACK_BRANDING_ASSET_PATH = path.join(process.cwd(), "Logo 9-02.png");
const FALLBACK_BRANDING_ASSET_CONTENT_TYPE = "image/png";
const BRANDING_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300";

async function getFallbackBrandingAssetResponse() {
  const body = await readFile(FALLBACK_BRANDING_ASSET_PATH);
  return {
    body,
    contentType: FALLBACK_BRANDING_ASSET_CONTENT_TYPE,
    cacheControl: BRANDING_CACHE_CONTROL,
  };
}

export async function resolveBrandingAssetResponse(slot: BrandingAssetSlot) {
  const config = await getFileUploadServiceConfig();

  if (config.globalSettings.storageLocation === "S3" && config.s3.isConfigured) {
    const asset = await resolveStoredAssetResponse({
      storageProvider: "S3",
      storagePath: getBrandingCanonicalStoragePath(slot),
    });

    if (asset) {
      return {
        ...asset,
        cacheControl: BRANDING_CACHE_CONTROL,
      };
    }

    return getFallbackBrandingAssetResponse();
  }

  const setting = await getSettingByKeyService(getBrandingSettingKey(slot));
  const storedAsset = isStoredSettingsAsset(setting?.value) ? setting.value : null;

  if (storedAsset && (storedAsset.storageProvider === undefined || storedAsset.storageProvider === "LOCAL_PUBLIC")) {
    const asset = await resolveStoredAssetResponse(storedAsset);
    if (asset) {
      return {
        ...asset,
        cacheControl: BRANDING_CACHE_CONTROL,
      };
    }
  }

  return getFallbackBrandingAssetResponse();
}
