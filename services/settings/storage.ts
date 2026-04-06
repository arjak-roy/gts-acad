import { deleteUploadedSettingsAsset, storeUploadedSettingsAsset } from "@/services/file-upload";
import type { SettingsAssetValue } from "@/services/settings/types";

export async function storeSettingsAsset(file: File, options: { settingKey?: string } = {}): Promise<SettingsAssetValue> {
  return storeUploadedSettingsAsset(file, options);
}

export async function deleteSettingsAsset(value: unknown) {
  await deleteUploadedSettingsAsset(value);
}