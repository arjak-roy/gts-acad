import "server-only";

import { getFileUploadRuntimeSettings } from "@/services/settings/runtime";
import type { BrandingAssetSlot, FileUploadRuntimeConfig, FileUploadStorageProvider } from "@/services/file-upload/types";

const BRANDING_SETTING_SLOT_MAP = {
  "branding.application_logo": "application-logo",
  "branding.favicon": "favicon",
  "branding.login_page_banner": "login-page-banner",
} as const satisfies Record<string, BrandingAssetSlot>;

const BRANDING_SLOT_SETTING_MAP = Object.fromEntries(
  Object.entries(BRANDING_SETTING_SLOT_MAP).map(([settingKey, slot]) => [slot, settingKey]),
) as Record<BrandingAssetSlot, string>;

function normalizeStorageLocation(value: string | null | undefined): FileUploadStorageProvider {
  return value === "S3" ? "S3" : "LOCAL_PUBLIC";
}

function normalizeExtensionList(values: string[]) {
  return values
    .map((value) => value.trim().toLowerCase().replace(/^[.]+/, ""))
    .filter(Boolean);
}

export async function getFileUploadServiceConfig(): Promise<FileUploadRuntimeConfig> {
  const runtimeSettings = await getFileUploadRuntimeSettings();

  return {
    globalSettings: {
      maximumFileUploadSizeBytes: Math.max(1, Number(runtimeSettings.maximumFileUploadSizeMb) || 20) * 1024 * 1024,
      allowedFileTypes: normalizeExtensionList(runtimeSettings.allowedFileTypes),
      allowedImageTypes: normalizeExtensionList(runtimeSettings.allowedImageTypes),
      storageLocation: normalizeStorageLocation(runtimeSettings.storageLocation),
      enableDocumentPreview: Boolean(runtimeSettings.enableDocumentPreview),
    },
    s3: {
      region: process.env.S3_REGION?.trim() ?? "",
      bucket: process.env.S3_BUCKET?.trim() ?? "",
      accessKeyId: process.env.S3_ACCESS_KEY?.trim() ?? "",
      secretAccessKey: process.env.S3_SECRET_KEY?.trim() ?? "",
      namingStrategy: process.env.S3_NAMING_STRATEGY?.trim() ?? "",
      isConfigured: Boolean(
        process.env.S3_REGION?.trim() &&
        process.env.S3_BUCKET?.trim() &&
        process.env.S3_ACCESS_KEY?.trim() &&
        process.env.S3_SECRET_KEY?.trim(),
      ),
    },
  };
}

export function getBrandingAssetSlot(settingKey: string): BrandingAssetSlot | null {
  return BRANDING_SETTING_SLOT_MAP[settingKey as keyof typeof BRANDING_SETTING_SLOT_MAP] ?? null;
}

export function getBrandingSettingKey(slot: BrandingAssetSlot) {
  return BRANDING_SLOT_SETTING_MAP[slot];
}

export function getBrandingCanonicalStoragePath(slot: BrandingAssetSlot) {
  return `branding/${slot}`;
}

export function parseBrandingAssetSlot(value: string): BrandingAssetSlot | null {
  return Object.values(BRANDING_SETTING_SLOT_MAP).includes(value as BrandingAssetSlot) ? (value as BrandingAssetSlot) : null;
}
