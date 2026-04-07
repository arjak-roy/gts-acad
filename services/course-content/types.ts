import { ContentStatus, ContentType, UploadStorageProvider } from "@prisma/client";

export type ContentListItem = {
  id: string;
  courseId: string;
  courseName: string;
  folderId: string | null;
  folderName: string | null;
  title: string;
  description: string | null;
  contentType: ContentType;
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
  scormMetadata: unknown;
  createdByName: string | null;
  updatedAt: Date;
  batchCount: number;
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
