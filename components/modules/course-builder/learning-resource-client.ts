import type { AuthoredContentDocument } from "@/lib/authored-content";

export type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "accent";

export type LearningResourceContentType = "ARTICLE" | "PDF" | "DOCUMENT" | "VIDEO" | "SCORM" | "LINK" | "OTHER";
export type LearningResourceStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type LearningResourceVisibility = "PRIVATE" | "RESTRICTED" | "PUBLIC";
export type LearningResourceTargetType = "COURSE" | "BATCH" | "ASSESSMENT_POOL" | "SCHEDULE_EVENT";
export type UploadStorageProvider = "LOCAL_PUBLIC" | "S3";

export type ApiResponse<T> = {
  data?: T;
  error?: string;
};

export type UploadedAsset = {
  fileName: string;
  originalName: string;
  mimeType: string | null;
  size: number | null;
  storagePath: string;
  storageProvider: UploadStorageProvider;
  relativeUrl: string;
  url: string;
  uploadedAt: string;
};

export type LearningResourceCategorySummary = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  parentName: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type LearningResourceTagSummary = {
  id: string;
  name: string;
  slug: string;
};

export type LearningResourceLookupOption = {
  id: string;
  label: string;
  meta: string | null;
};

export type LearningResourceLookups = {
  categories: LearningResourceCategorySummary[];
  tags: LearningResourceTagSummary[];
  courses: LearningResourceLookupOption[];
  batches: LearningResourceLookupOption[];
  assessments: LearningResourceLookupOption[];
  scheduleEvents: LearningResourceLookupOption[];
};

export type LearningResourceListItem = {
  id: string;
  sourceContentId: string | null;
  title: string;
  description: string | null;
  excerpt: string | null;
  contentType: LearningResourceContentType;
  status: LearningResourceStatus;
  visibility: LearningResourceVisibility;
  categoryName: string | null;
  subcategoryName: string | null;
  tagNames: string[];
  estimatedReadingMinutes: number | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  currentVersionNumber: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignmentCount: number;
  previewCount: number;
  downloadCount: number;
};

export type LearningResourceAttachmentItem = {
  id: string;
  title: string | null;
  fileUrl: string | null;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  storagePath: string | null;
  storageProvider: UploadStorageProvider | null;
  sortOrder: number;
  createdAt: string;
};

export type LearningResourceAssignmentItem = {
  id: string;
  targetType: LearningResourceTargetType;
  targetId: string;
  targetLabel: string;
  notes: string | null;
  assignedByName: string | null;
  assignedAt: string;
};

export type LearningResourceDetail = LearningResourceListItem & {
  categoryId: string | null;
  subcategoryId: string | null;
  bodyJson: AuthoredContentDocument | null;
  renderedHtml: string | null;
  storagePath: string | null;
  storageProvider: UploadStorageProvider | null;
  tags: LearningResourceTagSummary[];
  attachments: LearningResourceAttachmentItem[];
  assignments: LearningResourceAssignmentItem[];
  versionsCount: number;
  createdByName: string | null;
  updatedByName: string | null;
};

export type LearningResourceSnapshotAttachment = {
  title: string | null;
  fileUrl: string | null;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  storagePath: string | null;
  storageProvider: UploadStorageProvider | null;
  sortOrder: number;
};

export type LearningResourceVersionSnapshot = {
  title: string;
  description: string | null;
  excerpt: string | null;
  contentType: LearningResourceContentType;
  status: LearningResourceStatus;
  visibility: LearningResourceVisibility;
  categoryName: string | null;
  subcategoryName: string | null;
  tags: string[];
  bodyJson: AuthoredContentDocument | null;
  renderedHtml: string | null;
  estimatedReadingMinutes: number | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  storagePath: string | null;
  storageProvider: UploadStorageProvider | null;
  attachments: LearningResourceSnapshotAttachment[];
};

export type LearningResourceVersionDetail = {
  id: string;
  versionNumber: number;
  title: string;
  changeSummary: string | null;
  updatedByName: string | null;
  createdAt: string;
  snapshot: LearningResourceVersionSnapshot;
};

export type LearningResourceAssetDraft = {
  key: string;
  title: string;
  fileUrl: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  storagePath: string | null;
  storageProvider: UploadStorageProvider | null;
  uploadedAt: string | null;
};

export type LearningResourceUploadConfig = {
  maximumFileUploadSizeBytes: number;
  allowedFileTypes: string[];
  allowedImageTypes: string[];
  storageLocation: UploadStorageProvider;
  enableDocumentPreview: boolean;
};

export const EMPTY_LEARNING_RESOURCE_LOOKUPS: LearningResourceLookups = {
  categories: [],
  tags: [],
  courses: [],
  batches: [],
  assessments: [],
  scheduleEvents: [],
};

export const LEARNING_RESOURCE_CONTENT_TYPE_OPTIONS: Array<{ value: LearningResourceContentType; label: string }> = [
  { value: "ARTICLE", label: "Authored Article" },
  { value: "PDF", label: "PDF" },
  { value: "DOCUMENT", label: "Document" },
  { value: "VIDEO", label: "Video" },
  { value: "SCORM", label: "SCORM Package" },
  { value: "LINK", label: "External Link" },
  { value: "OTHER", label: "Other" },
];

export const LEARNING_RESOURCE_STATUS_OPTIONS: Array<{ value: LearningResourceStatus; label: string }> = [
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Published" },
  { value: "ARCHIVED", label: "Archived" },
];

export const LEARNING_RESOURCE_VISIBILITY_OPTIONS: Array<{ value: LearningResourceVisibility; label: string }> = [
  { value: "PRIVATE", label: "Private" },
  { value: "RESTRICTED", label: "Internal" },
  { value: "PUBLIC", label: "Public" },
];

export const LEARNING_RESOURCE_TARGET_TYPE_OPTIONS: Array<{ value: LearningResourceTargetType; label: string }> = [
  { value: "COURSE", label: "Course" },
  { value: "BATCH", label: "Batch" },
  { value: "ASSESSMENT_POOL", label: "Quiz Pool" },
  { value: "SCHEDULE_EVENT", label: "Trainer Session" },
];

export const LEARNING_RESOURCE_STATUS_LABELS: Record<LearningResourceStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

export const LEARNING_RESOURCE_VISIBILITY_LABELS: Record<LearningResourceVisibility, string> = {
  PRIVATE: "Private",
  RESTRICTED: "Internal",
  PUBLIC: "Public",
};

export const LEARNING_RESOURCE_CONTENT_TYPE_LABELS: Record<LearningResourceContentType, string> = {
  ARTICLE: "Authored Article",
  PDF: "PDF",
  DOCUMENT: "Document",
  VIDEO: "Video",
  SCORM: "SCORM Package",
  LINK: "External Link",
  OTHER: "Other",
};

export const LEARNING_RESOURCE_TARGET_TYPE_LABELS: Record<LearningResourceTargetType, string> = {
  COURSE: "Course",
  BATCH: "Batch",
  ASSESSMENT_POOL: "Quiz Pool",
  SCHEDULE_EVENT: "Trainer Session",
};

export function getLearningResourceStatusBadgeVariant(status: LearningResourceStatus): BadgeVariant {
  switch (status) {
    case "PUBLISHED":
      return "success";
    case "ARCHIVED":
      return "warning";
    default:
      return "info";
  }
}

export function getLearningResourceVisibilityBadgeVariant(visibility: LearningResourceVisibility): BadgeVariant {
  switch (visibility) {
    case "PUBLIC":
      return "success";
    case "RESTRICTED":
      return "accent";
    default:
      return "default";
  }
}

export function formatFileSize(bytes: number | null) {
  if (!bytes) {
    return "-";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleString("en-IN");
}

export function parseTagInput(value: string) {
  return Array.from(new Set(value.split(",").map((tag) => tag.trim()).filter(Boolean)));
}

export function getLearningResourceCategoryLabel(category: LearningResourceCategorySummary) {
  return category.parentName ? `${category.parentName} / ${category.name}` : category.name;
}

export function buildLearningResourceAssetUrl(
  resourceId: string,
  options?: { attachmentId?: string; download?: boolean },
) {
  const params = new URLSearchParams();

  if (options?.attachmentId) {
    params.set("attachmentId", options.attachmentId);
  }

  if (options?.download) {
    params.set("download", "1");
  }

  const query = params.toString();
  return `/api/learning-resources/${resourceId}/asset${query ? `?${query}` : ""}`;
}

export function buildLearningResourceAssetDraftFromUpload(asset: UploadedAsset): LearningResourceAssetDraft {
  return {
    key: asset.storagePath || asset.url,
    title: "",
    fileUrl: asset.url,
    fileName: asset.originalName || asset.fileName,
    fileSize: asset.size ?? null,
    mimeType: asset.mimeType ?? null,
    storagePath: asset.storagePath,
    storageProvider: asset.storageProvider,
    uploadedAt: asset.uploadedAt,
  };
}

export async function parseApiResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || payload?.error) {
    throw new Error(payload?.error || fallbackMessage);
  }

  if (typeof payload?.data === "undefined") {
    throw new Error(fallbackMessage);
  }

  return payload.data;
}