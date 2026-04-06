import "server-only";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { SETTINGS_UPLOAD_DIRECTORY_SEGMENTS } from "@/lib/settings/constants";
import { isStoredSettingsAsset } from "@/lib/settings/validation";
import { getBrandingAssetSlot, getBrandingCanonicalStoragePath, getFileUploadServiceConfig } from "@/services/file-upload/config";
import { buildLocalSettingsStoragePath, buildS3TemporaryStoragePath, getNormalizedFileExtension } from "@/services/file-upload/naming";
import type { FileUploadStorageProvider } from "@/services/file-upload/types";
import type { SettingsAssetValue } from "@/services/settings/types";

const S3_ALLOWED_PREFIXES = ["settings/uploads/", "branding/"];
const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

function getSettingsUploadDirectory() {
  return path.join(process.cwd(), ...SETTINGS_UPLOAD_DIRECTORY_SEGMENTS);
}

function normalizeStorageProvider(value: unknown): FileUploadStorageProvider {
  return value === "S3" ? "S3" : "LOCAL_PUBLIC";
}

function normalizeStoragePath(storagePath: string) {
  return path.posix.normalize(storagePath).replace(/^\/+/, "");
}

function isWithinDirectory(absolutePath: string, baseDirectory: string) {
  const normalizedAbsolutePath = path.resolve(absolutePath);
  const normalizedBaseDirectory = path.resolve(baseDirectory);

  return normalizedAbsolutePath === normalizedBaseDirectory || normalizedAbsolutePath.startsWith(`${normalizedBaseDirectory}${path.sep}`);
}

function getLocalAbsoluteStoragePath(storagePath: string) {
  return path.join(process.cwd(), "public", ...normalizeStoragePath(storagePath).split("/"));
}

function isAllowedS3StoragePath(storagePath: string) {
  const normalizedStoragePath = normalizeStoragePath(storagePath);
  return S3_ALLOWED_PREFIXES.some((prefix) => normalizedStoragePath.startsWith(prefix));
}

function inferContentType(storagePath: string) {
  switch (getNormalizedFileExtension(storagePath)) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "ico":
      return "image/x-icon";
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "csv":
      return "text/csv";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "mp4":
      return "video/mp4";
    default:
      return "application/octet-stream";
  }
}

function buildStoredAssetUrl(storageProvider: FileUploadStorageProvider, storagePath: string) {
  const normalizedStoragePath = normalizeStoragePath(storagePath);

  if (storageProvider === "LOCAL_PUBLIC") {
    return `/${normalizedStoragePath}`;
  }

  const params = new URLSearchParams({
    provider: storageProvider,
    path: normalizedStoragePath,
  });

  return `/api/settings/assets?${params.toString()}`;
}

function buildStoredAssetValue(file: File, storageProvider: FileUploadStorageProvider, storagePath: string): SettingsAssetValue {
  const normalizedStoragePath = normalizeStoragePath(storagePath);

  return {
    kind: "settings-asset",
    url: buildStoredAssetUrl(storageProvider, normalizedStoragePath),
    storagePath: normalizedStoragePath,
    storageProvider,
    fileName: path.posix.basename(normalizedStoragePath),
    originalName: file.name,
    mimeType: file.type || inferContentType(file.name),
    size: file.size,
    uploadedAt: new Date().toISOString(),
  };
}

function getS3Client(config: Awaited<ReturnType<typeof getFileUploadServiceConfig>>["s3"]) {
  return new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function buildCopySource(bucket: string, storagePath: string) {
  return `${bucket}/${normalizeStoragePath(storagePath).split("/").map(encodeURIComponent).join("/")}`;
}

function isMissingS3ObjectError(error: unknown) {
  return Boolean(
    error &&
    typeof error === "object" &&
    ("name" in error && ((error as { name?: string }).name === "NoSuchKey" || (error as { name?: string }).name === "NotFound") ||
      "Code" in error && ((error as { Code?: string }).Code === "NoSuchKey" || (error as { Code?: string }).Code === "NotFound")),
  );
}

export async function validateUploadedFileAgainstGlobalSettings(file: File) {
  const config = await getFileUploadServiceConfig();
  const normalizedExtension = getNormalizedFileExtension(file.name);

  if (!normalizedExtension) {
    throw new Error("Uploaded file must include a valid file extension.");
  }

  if (file.size > config.globalSettings.maximumFileUploadSizeBytes) {
    throw new Error(`Uploaded file exceeds the global ${Math.round(config.globalSettings.maximumFileUploadSizeBytes / (1024 * 1024))} MB limit.`);
  }

  const allowedExtensions = file.type.startsWith("image/")
    ? config.globalSettings.allowedImageTypes
    : config.globalSettings.allowedFileTypes;

  if (allowedExtensions.length > 0 && !allowedExtensions.includes(normalizedExtension)) {
    throw new Error("Uploaded file type is disabled by the global file upload settings.");
  }

  return config;
}

export async function storeUploadedSettingsAsset(file: File, options: { settingKey?: string } = {}): Promise<SettingsAssetValue> {
  const config = await getFileUploadServiceConfig();

  if (config.globalSettings.storageLocation === "S3") {
    if (!config.s3.isConfigured) {
      throw new Error("S3 storage is selected in global settings, but the S3 credentials or bucket configuration are incomplete.");
    }

    const client = getS3Client(config.s3);
    const brandingSlot = options.settingKey ? getBrandingAssetSlot(options.settingKey) : null;
    const storagePath = buildS3TemporaryStoragePath(file.name, config.s3.namingStrategy, brandingSlot);
    const body = Buffer.from(await file.arrayBuffer());

    await client.send(new PutObjectCommand({
      Bucket: config.s3.bucket,
      Key: storagePath,
      Body: body,
      ContentType: file.type || inferContentType(file.name),
      CacheControl: IMMUTABLE_CACHE_CONTROL,
    }));

    return buildStoredAssetValue(file, "S3", storagePath);
  }

  await mkdir(getSettingsUploadDirectory(), { recursive: true });

  const storagePath = buildLocalSettingsStoragePath(file.name);
  const absoluteStoragePath = getLocalAbsoluteStoragePath(storagePath);
  const body = Buffer.from(await file.arrayBuffer());

  await writeFile(absoluteStoragePath, body);

  return buildStoredAssetValue(file, "LOCAL_PUBLIC", storagePath);
}

export function areStoredAssetsFromSameLocation(left: unknown, right: unknown) {
  if (!isStoredSettingsAsset(left) || !isStoredSettingsAsset(right)) {
    return false;
  }

  return (
    normalizeStorageProvider(left.storageProvider) === normalizeStorageProvider(right.storageProvider) &&
    normalizeStoragePath(left.storagePath) === normalizeStoragePath(right.storagePath)
  );
}

export async function publishBrandingSettingsAsset(settingKey: string, value: unknown) {
  if (!isStoredSettingsAsset(value)) {
    return value;
  }

  const brandingSlot = getBrandingAssetSlot(settingKey);
  if (!brandingSlot) {
    return value;
  }

  if (normalizeStorageProvider(value.storageProvider) !== "S3") {
    return value;
  }

  const config = await getFileUploadServiceConfig();
  if (config.globalSettings.storageLocation !== "S3" || !config.s3.isConfigured) {
    return value;
  }

  const canonicalStoragePath = getBrandingCanonicalStoragePath(brandingSlot);
  if (normalizeStoragePath(value.storagePath) === canonicalStoragePath) {
    return {
      ...value,
      storageProvider: "S3",
      storagePath: canonicalStoragePath,
      url: buildStoredAssetUrl("S3", canonicalStoragePath),
    } satisfies SettingsAssetValue;
  }

  const client = getS3Client(config.s3);

  await client.send(new CopyObjectCommand({
    Bucket: config.s3.bucket,
    Key: canonicalStoragePath,
    CopySource: buildCopySource(config.s3.bucket, value.storagePath),
    CacheControl: IMMUTABLE_CACHE_CONTROL,
    ContentType: value.mimeType || inferContentType(canonicalStoragePath),
    MetadataDirective: "REPLACE",
  }));

  await client.send(new DeleteObjectCommand({
    Bucket: config.s3.bucket,
    Key: value.storagePath,
  }));

  return {
    ...value,
    storageProvider: "S3",
    storagePath: canonicalStoragePath,
    url: buildStoredAssetUrl("S3", canonicalStoragePath),
    fileName: path.posix.basename(canonicalStoragePath),
  } satisfies SettingsAssetValue;
}

export async function deleteUploadedSettingsAsset(value: unknown) {
  if (!isStoredSettingsAsset(value)) {
    return;
  }

  try {
    const storageProvider = normalizeStorageProvider(value.storageProvider);

    if (storageProvider === "S3") {
      const config = await getFileUploadServiceConfig();
      if (!config.s3.isConfigured || !isAllowedS3StoragePath(value.storagePath)) {
        return;
      }

      const client = getS3Client(config.s3);
      await client.send(new DeleteObjectCommand({
        Bucket: config.s3.bucket,
        Key: normalizeStoragePath(value.storagePath),
      }));
      return;
    }

    const absoluteStoragePath = getLocalAbsoluteStoragePath(value.storagePath);
    if (!isWithinDirectory(absoluteStoragePath, getSettingsUploadDirectory())) {
      return;
    }

    await rm(absoluteStoragePath, { force: true });
  } catch (error) {
    console.warn("Settings asset cleanup failed", error);
  }
}

export async function resolveStoredAssetResponse(input: { storageProvider?: unknown; storagePath: string }) {
  const storageProvider = normalizeStorageProvider(input.storageProvider);
  const storagePath = normalizeStoragePath(input.storagePath);

  if (storageProvider === "S3") {
    const config = await getFileUploadServiceConfig();
    if (!config.s3.isConfigured || !isAllowedS3StoragePath(storagePath)) {
      return null;
    }

    try {
      const client = getS3Client(config.s3);
      const object = await client.send(new GetObjectCommand({
        Bucket: config.s3.bucket,
        Key: storagePath,
      }));

      const body = object.Body ? Buffer.from(await object.Body.transformToByteArray()) : null;
      if (!body) {
        return null;
      }

      return {
        body,
        contentType: object.ContentType || inferContentType(storagePath),
        cacheControl: object.CacheControl || IMMUTABLE_CACHE_CONTROL,
      };
    } catch (error) {
      if (isMissingS3ObjectError(error)) {
        return null;
      }

      throw error;
    }
  }

  const absoluteStoragePath = getLocalAbsoluteStoragePath(storagePath);
  if (!isWithinDirectory(absoluteStoragePath, getSettingsUploadDirectory())) {
    return null;
  }

  try {
    const body = await readFile(absoluteStoragePath);
    return {
      body,
      contentType: inferContentType(storagePath),
      cacheControl: IMMUTABLE_CACHE_CONTROL,
    };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}
