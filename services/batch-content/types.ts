import { ContentType, ContentStatus, QuestionType, DifficultyLevel, AssessmentPoolStatus } from "@prisma/client";

export type BatchContentItem = {
  id: string;
  batchId: string;
  contentId: string;
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
  assignedByName: string | null;
  scheduledAt: Date | null;
  assignedAt: Date;
};
