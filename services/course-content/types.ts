import {
  ContentStatus,
  ContentType,
  CurriculumProgressStatus,
  LearningResourceVisibility,
  UploadStorageProvider,
} from "@prisma/client";

import type { AuthoredContentAnyDocument } from "@/lib/authored-content";
import type {
  CurriculumStageItemAvailabilityReason,
  CurriculumStageItemAvailabilityStatus,
} from "@/services/curriculum/types";

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
  bodyJson: AuthoredContentAnyDocument | null;
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
  bodyJson: AuthoredContentAnyDocument | null;
  updatedAt: Date;
};

export type CandidateContentAccessContext = {
  batchId: string;
  batchCode: string;
  batchName: string;
  curriculumId: string;
  curriculumTitle: string;
  moduleId: string;
  moduleTitle: string;
  stageId: string;
  stageTitle: string;
  stageItemId: string;
  itemTitle: string;
  availabilityStatus: CurriculumStageItemAvailabilityStatus;
  availabilityReason: CurriculumStageItemAvailabilityReason;
  progressStatus: CurriculumProgressStatus;
  progressPercent: number;
};

export type CandidateContentAccessResult =
  | {
      kind: "content";
      content: CandidateContentDetail;
      contexts: CandidateContentAccessContext[];
    }
  | {
      kind: "blocked";
      contentId: string;
      title: string;
      availabilityStatus: Exclude<CurriculumStageItemAvailabilityStatus, "AVAILABLE">;
      availabilityReason: CurriculumStageItemAvailabilityReason;
      contexts: CandidateContentAccessContext[];
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

export type AssignedSharedContentListItem = ContentListItem & {
  targetCourseId: string;
  sourceCourseId: string;
  sourceCourseName: string;
  sourceFolderId: string | null;
  sourceFolderName: string | null;
  resourceId: string;
  resourceStatus: ContentStatus;
  resourceVisibility: LearningResourceVisibility;
  assignedAt: Date;
  isSharedAssignment: true;
  shareKind: "COURSE_ASSIGNMENT";
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
