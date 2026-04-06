import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { SETTINGS_UPLOAD_DIRECTORY_SEGMENTS, SETTINGS_UPLOAD_PUBLIC_PREFIX } from "@/lib/settings/constants";
import { isStoredSettingsAsset } from "@/lib/settings/validation";
import type { SettingsAssetValue } from "@/services/settings/types";

function getSettingsUploadDirectory() {
  return path.join(process.cwd(), ...SETTINGS_UPLOAD_DIRECTORY_SEGMENTS);
}

function sanitizeExtension(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();
  return /^[.][a-z0-9]+$/.test(extension) ? extension : "";
}

function buildRelativeStoragePath(fileName: string) {
  return path.posix.join("uploads", "settings", fileName);
}

export async function storeSettingsAsset(file: File): Promise<SettingsAssetValue> {
  await mkdir(getSettingsUploadDirectory(), { recursive: true });

  const extension = sanitizeExtension(file.name);
  const fileName = `${randomUUID()}${extension}`;
  const relativeStoragePath = buildRelativeStoragePath(fileName);
  const absoluteStoragePath = path.join(process.cwd(), relativeStoragePath);
  const buffer = Buffer.from(await file.arrayBuffer());

  await writeFile(absoluteStoragePath, buffer);

  return {
    kind: "settings-asset",
    url: `${SETTINGS_UPLOAD_PUBLIC_PREFIX}/${fileName}`,
    storagePath: relativeStoragePath,
    fileName,
    originalName: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    uploadedAt: new Date().toISOString(),
  };
}

export async function deleteSettingsAsset(value: unknown) {
  if (!isStoredSettingsAsset(value)) {
    return;
  }

  const absoluteStoragePath = path.join(process.cwd(), value.storagePath);
  const safeBaseDirectory = getSettingsUploadDirectory();
  if (!absoluteStoragePath.startsWith(safeBaseDirectory)) {
    return;
  }

  await rm(absoluteStoragePath, { force: true });
}