import { ContentType, ContentStatus, QuestionType, DifficultyLevel, AssessmentPoolStatus } from "@prisma/client";

export type BatchAssignmentSource = "COURSE" | "BATCH" | "COURSE_AND_BATCH";

export type BatchContentItem = {
  id: string;
  batchId: string;
  contentId: string;
  resourceId: string | null;
  resourceAssignmentId: string | null;
  contentTitle: string;
  contentDescription: string | null;
  contentExcerpt: string | null;
  contentType: ContentType;
  contentStatus: ContentStatus;
  folderName: string | null;
  estimatedReadingMinutes: number | null;
  fileUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  assignedByName: string | null;
  assignedAt: Date;
  assignmentSource: BatchAssignmentSource;
  isInheritedFromCourse: boolean;
  isBatchMapped: boolean;
  canRemoveBatchMapping: boolean;
};

export type BatchAvailableContentItem = {
  id: string;
  sourceContentId: string | null;
  title: string;
  contentType: ContentType;
  fileName: string | null;
  folderName: string | null;
  sourceCourseName: string | null;
  hasSourceContent: boolean;
};

export type BatchAssessmentItem = {
  id: string;
  batchId: string;
  assessmentPoolId: string;
  assessmentTitle: string;
  assessmentCode: string;
  questionType: QuestionType;
  difficultyLevel: DifficultyLevel;
  status: AssessmentPoolStatus;
  questionCount: number;
  totalMarks: number;
  timeLimitMinutes: number | null;
  assignedByName: string | null;
  scheduledAt: Date | null;
  assignedAt: Date;
  assignmentSource: BatchAssignmentSource;
  isInheritedFromCourse: boolean;
  isBatchMapped: boolean;
  canRemoveBatchMapping: boolean;
};
