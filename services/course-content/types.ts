import { ContentStatus, ContentType, UploadStorageProvider } from "@prisma/client";

import type { AuthoredContentDocument } from "@/lib/authored-content";

export type ContentListItem = {
  id: string;
  courseId: string;
  courseName: string;
  folderId: string | null;
  folderName: string | null;
  title: string;
  description: string | null;
  excerpt: string | null;
  contentType: ContentType;
  estimatedReadingMinutes: number | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  storagePath: string | null;
  storageProvider: UploadStorageProvider | null;
  sortOrder: number;
  status: ContentStatus;
  isScorm: boolean;
  createdAt: Date;
};

export type ContentDetail = ContentListItem & {
  bodyJson: AuthoredContentDocument | null;
  renderedHtml: string | null;
  scormMetadata: unknown;
  isAiGenerated: boolean;
  aiGenerationMetadata: unknown;
  createdByName: string | null;
  updatedAt: Date;
  batchCount: number;
};

export type CandidateContentDetail = {
  id: string;
  title: string;
  description: string | null;
  excerpt: string | null;
  contentType: ContentType;
  estimatedReadingMinutes: number | null;
  fileUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  renderedHtml: string | null;
  bodyJson: AuthoredContentDocument | null;
  updatedAt: Date;
};

export type ContentCreateResult = {
  id: string;
  courseId: string;
  folderId: string | null;
  title: string;
  contentType: ContentType;
  status: ContentStatus;
  fileName: string | null;
};

export type CourseContentFolderListItem = {
  id: string;
  courseId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  contentCount: number;
  createdAt: Date;
};

export type CourseContentFolderDetail = CourseContentFolderListItem & {
  createdByName: string | null;
  updatedAt: Date;
};
