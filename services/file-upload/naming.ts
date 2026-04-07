import path from "node:path";
import { randomUUID } from "node:crypto";

import type { BrandingAssetSlot } from "@/services/file-upload/types";

function sanitizeBaseName(fileName: string) {
  const parsed = path.parse(fileName).name;
  const normalized = parsed.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
  return normalized || "asset";
}

export function sanitizeStoragePathSegment(value: string) {
  const normalized = value.trim().replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
  return normalized || "item";
}

export function buildCourseContentStorageScope(courseCode: string, courseName: string) {
  return `${sanitizeStoragePathSegment(courseCode)}-${sanitizeStoragePathSegment(courseName)}`;
}

function toCamelCase(value: string) {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((segment, index) => {
      const normalized = segment.toLowerCase();
      return index === 0 ? normalized : `${normalized.slice(0, 1).toUpperCase()}${normalized.slice(1)}`;
    })
    .join("");
}

export function sanitizeExtension(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();
  return /^[.][a-z0-9]+$/.test(extension) ? extension : "";
}

export function getNormalizedFileExtension(fileName: string) {
  return sanitizeExtension(fileName).replace(/^[.]/, "");
}

function buildLocalScopedStoragePath(scope: string, fileName: string) {
  const extension = sanitizeExtension(fileName);
  return path.posix.join("uploads", scope, `${randomUUID()}${extension}`);
}

export function buildLocalSettingsStoragePath(fileName: string) {
  return buildLocalScopedStoragePath("settings", fileName);
}

export function buildLocalCourseContentStoragePath(fileName: string, courseScope: string) {
  return buildLocalScopedStoragePath(path.posix.join("course-content", courseScope), fileName);
}

function buildS3ScopedStoragePath(prefix: string, fileName: string, namingStrategy: string) {
  const extension = sanitizeExtension(fileName);
  const baseName = sanitizeBaseName(fileName);
  const fileToken = namingStrategy === "<cand_id_name_camelcase>"
    ? `${toCamelCase(baseName)}-${randomUUID()}`
    : `${baseName}-${randomUUID()}`;

  return path.posix.join(prefix, `${fileToken}${extension}`);
}

export function buildS3TemporaryStoragePath(fileName: string, namingStrategy: string, brandingSlot?: BrandingAssetSlot | null) {
  const prefix = brandingSlot
    ? path.posix.join("settings", "uploads", "branding", brandingSlot)
    : path.posix.join("settings", "uploads");

  return buildS3ScopedStoragePath(prefix, fileName, namingStrategy);
}

export function buildS3CourseContentStoragePath(fileName: string, namingStrategy: string, courseScope: string) {
  return buildS3ScopedStoragePath(path.posix.join("course-content", courseScope), fileName, namingStrategy);
}
