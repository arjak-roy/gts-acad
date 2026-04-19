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

import { isStoredSettingsAsset } from "@/lib/settings/validation";
import { getBrandingAssetSlot, getBrandingCanonicalStoragePath, getFileUploadServiceConfig } from "@/services/file-upload/config";
import {
  buildLocalCandidateProfilePhotoStoragePath,
  buildCourseContentStorageScope,
  buildLocalCertificationBrandingStoragePath,
  buildLocalCourseContentStoragePath,
  buildLocalEmailTemplateStoragePath,
  buildLocalLearningResourceStoragePath,
  buildLocalSettingsStoragePath,
  buildS3CandidateProfilePhotoStoragePath,
  buildS3CertificationBrandingStoragePath,
  buildS3CourseContentStoragePath,
  buildS3EmailTemplateStoragePath,
  buildS3LearningResourceStoragePath,
  buildS3TemporaryStoragePath,
  getNormalizedFileExtension,
} from "@/services/file-upload/naming";
import type { FileUploadStorageProvider } from "@/services/file-upload/types";
import type { SettingsAssetValue } from "@/services/settings/types";

type StoredUploadAsset = {
  url: string;
  storagePath: string;
  storageProvider: FileUploadStorageProvider;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
};

const S3_ALLOWED_PREFIXES = ["settings/uploads/", "branding/", "course-content/", "email-templates/", "learning-resources/", "certifications/", "candidate-profile-photos/"];
const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

function getPublicUploadDirectory() {
  return path.join(process.cwd(), "public", "uploads");
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
    case "ppt":
      return "application/vnd.ms-powerpoint";
    case "pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
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

export function getStoredUploadAssetUrl(input: { storageProvider?: unknown; storagePath: string }) {
  return buildStoredAssetUrl(normalizeStorageProvider(input.storageProvider), input.storagePath);
}

function buildStoredUploadValue(file: File, storageProvider: FileUploadStorageProvider, storagePath: string): StoredUploadAsset {
  const normalizedStoragePath = normalizeStoragePath(storagePath);

  return {
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

function toSettingsAssetValue(asset: StoredUploadAsset): SettingsAssetValue {
  return {
    kind: "settings-asset",
    ...asset,
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

async function storeUploadedFile(
  file: File,
  options: {
    buildLocalStoragePath: () => string;
    buildS3StoragePath: (config: Awaited<ReturnType<typeof getFileUploadServiceConfig>>) => string;
  },
): Promise<StoredUploadAsset> {
  const config = await getFileUploadServiceConfig();

  if (config.globalSettings.storageLocation === "S3") {
    if (!config.s3.isConfigured) {
      throw new Error("S3 storage is selected in global settings, but the S3 credentials or bucket configuration are incomplete.");
    }

    const client = getS3Client(config.s3);
    const storagePath = options.buildS3StoragePath(config);
    const body = Buffer.from(await file.arrayBuffer());

    await client.send(new PutObjectCommand({
      Bucket: config.s3.bucket,
      Key: storagePath,
      Body: body,
      ContentType: file.type || inferContentType(file.name),
      CacheControl: IMMUTABLE_CACHE_CONTROL,
    }));

    return buildStoredUploadValue(file, "S3", storagePath);
  }

  const storagePath = options.buildLocalStoragePath();
  const absoluteStoragePath = getLocalAbsoluteStoragePath(storagePath);
  const body = Buffer.from(await file.arrayBuffer());

  await mkdir(path.dirname(absoluteStoragePath), { recursive: true });
  await writeFile(absoluteStoragePath, body);

  return buildStoredUploadValue(file, "LOCAL_PUBLIC", storagePath);
}

export async function storeUploadedSettingsAsset(file: File, options: { settingKey?: string } = {}): Promise<SettingsAssetValue> {
  const asset = await storeUploadedFile(file, {
    buildLocalStoragePath: () => buildLocalSettingsStoragePath(file.name),
    buildS3StoragePath: (config) => {
      const brandingSlot = options.settingKey ? getBrandingAssetSlot(options.settingKey) : null;
      return buildS3TemporaryStoragePath(file.name, config.s3.namingStrategy, brandingSlot);
    },
  });

  return toSettingsAssetValue(asset);
}

export async function storeUploadedCourseContentAsset(
  file: File,
  course: { courseCode: string; courseName: string },
): Promise<StoredUploadAsset> {
  const courseScope = buildCourseContentStorageScope(course.courseCode, course.courseName);

  return storeUploadedFile(file, {
    buildLocalStoragePath: () => buildLocalCourseContentStoragePath(file.name, courseScope),
    buildS3StoragePath: (config) => buildS3CourseContentStoragePath(file.name, config.s3.namingStrategy, courseScope),
  });
}

export async function storeUploadedLearningResourceAsset(file: File): Promise<StoredUploadAsset> {
  return storeUploadedFile(file, {
    buildLocalStoragePath: () => buildLocalLearningResourceStoragePath(file.name),
    buildS3StoragePath: (config) => buildS3LearningResourceStoragePath(file.name, config.s3.namingStrategy),
  });
}

export async function storeUploadedCandidateProfilePhotoAsset(file: File, learnerScope: string): Promise<StoredUploadAsset> {
  const config = await getFileUploadServiceConfig();

  if (!config.s3.isConfigured) {
    throw new Error("S3 profile photo storage is not configured.");
  }

  const client = getS3Client(config.s3);
  const storagePath = buildS3CandidateProfilePhotoStoragePath(file.name, config.s3.namingStrategy, learnerScope);
  const body = Buffer.from(await file.arrayBuffer());

  await client.send(new PutObjectCommand({
    Bucket: config.s3.bucket,
    Key: storagePath,
    Body: body,
    ContentType: file.type || inferContentType(file.name),
    CacheControl: IMMUTABLE_CACHE_CONTROL,
  }));

  return buildStoredUploadValue(file, "S3", storagePath);
}

export async function storeUploadedEmailTemplateAsset(file: File): Promise<StoredUploadAsset> {
  return storeUploadedFile(file, {
    buildLocalStoragePath: () => buildLocalEmailTemplateStoragePath(file.name),
    buildS3StoragePath: (config) => buildS3EmailTemplateStoragePath(file.name, config.s3.namingStrategy),
  });
}

export async function storeUploadedCertificationBrandingAsset(file: File): Promise<StoredUploadAsset> {
  return storeUploadedFile(file, {
    buildLocalStoragePath: () => buildLocalCertificationBrandingStoragePath(file.name),
    buildS3StoragePath: (config) => buildS3CertificationBrandingStoragePath(file.name, config.s3.namingStrategy),
  });
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

  await deleteStoredUploadAsset(value);
}

export async function deleteStoredUploadAsset(
  value: { storageProvider?: unknown; storagePath: string },
  options?: { throwOnError?: boolean },
) {
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
    if (!isWithinDirectory(absoluteStoragePath, getPublicUploadDirectory())) {
      return;
    }

    await rm(absoluteStoragePath, { force: true });
  } catch (error) {
    console.warn("Uploaded asset cleanup failed", error);
    if (options?.throwOnError) {
      throw error;
    }
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
  if (!isWithinDirectory(absoluteStoragePath, getPublicUploadDirectory())) {
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
