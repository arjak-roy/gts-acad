import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { isStoredSettingsAsset } from "@/lib/settings/validation";
import { getBrandingCanonicalStoragePath, getBrandingSettingKey } from "@/services/file-upload/config";
import { resolveStoredAssetResponse } from "@/services/file-upload/service";
import type { BrandingAssetSlot } from "@/services/file-upload/types";
import { getFileUploadServiceConfig } from "@/services/file-upload/config";
import { getSettingByKeyService } from "@/services/settings/queries";

const BRANDING_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300";

const STATIC_BRANDING_FALLBACKS: Record<BrandingAssetSlot, { path: string; contentType: string }> = {
  "application-logo": {
    path: path.join(process.cwd(), "public", "branding", "application-logo.png"),
    contentType: "image/png",
  },
  favicon: {
    path: path.join(process.cwd(), "public", "branding", "favicon.png"),
    contentType: "image/png",
  },
  "login-page-banner": {
    path: path.join(process.cwd(), "public", "branding", "login-page-banner.png"),
    contentType: "image/png",
  },
};

async function getFallbackBrandingAssetResponse(slot: BrandingAssetSlot) {
  const fallback = STATIC_BRANDING_FALLBACKS[slot];
  const body = await readFile(fallback.path);
  return {
    body,
    contentType: fallback.contentType,
    cacheControl: BRANDING_CACHE_CONTROL,
  };
}

export async function resolveBrandingAssetResponse(slot: BrandingAssetSlot) {
  try {
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

      return getFallbackBrandingAssetResponse(slot);
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

    return getFallbackBrandingAssetResponse(slot);
  } catch (error) {
    console.warn(`Branding asset fallback activated for ${slot}.`, error);
    return getFallbackBrandingAssetResponse(slot);
  }
}
