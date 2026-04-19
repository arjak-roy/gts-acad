import { ContentStatus, ContentType, LearningResourceTargetType, LearningResourceVisibility, UploadStorageProvider } from "@prisma/client";

import type { AuthoredContentAnyDocument } from "@/lib/authored-content";

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
  createdAt: Date;
};

export type LearningResourceAssignmentItem = {
  id: string;
  targetType: LearningResourceTargetType;
  targetId: string;
  targetLabel: string;
  notes: string | null;
  assignedByName: string | null;
  assignedAt: Date;
};

export type LearningResourceListItem = {
  id: string;
  sourceContentId: string | null;
  title: string;
  description: string | null;
  excerpt: string | null;
  contentType: ContentType;
  status: ContentStatus;
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
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  assignmentCount: number;
  previewCount: number;
  downloadCount: number;
};

export type LearningResourceDetail = LearningResourceListItem & {
  categoryId: string | null;
  subcategoryId: string | null;
  bodyJson: AuthoredContentAnyDocument | null;
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

export type LearningResourceListPage = {
  items: LearningResourceListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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
  contentType: ContentType;
  status: ContentStatus;
  visibility: LearningResourceVisibility;
  categoryName: string | null;
  subcategoryName: string | null;
  tags: string[];
  bodyJson: AuthoredContentAnyDocument | null;
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

export type LearningResourceVersionSummary = {
  id: string;
  versionNumber: number;
  title: string;
  changeSummary: string | null;
  updatedByName: string | null;
  createdAt: Date;
};

export type LearningResourceVersionDetail = LearningResourceVersionSummary & {
  snapshot: LearningResourceVersionSnapshot;
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

export type LearningResourceCreateResult = {
  id: string;
  title: string;
  contentType: ContentType;
  status: ContentStatus;
  visibility: LearningResourceVisibility;
  currentVersionNumber: number;
};
