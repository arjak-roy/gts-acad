import { ContentType, ContentStatus, QuestionType, DifficultyLevel, AssessmentPoolStatus } from "@prisma/client";

export type BatchContentItem = {
  id: string;
  batchId: string;
  contentId: string;
  contentTitle: string;
  contentType: ContentType;
  contentStatus: ContentStatus;
  fileName: string | null;
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
