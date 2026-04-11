import type { AssessmentPoolStatus, DifficultyLevel, QuestionType } from "@prisma/client";

export type TrainerAssessmentAssignmentItem = {
  id: string;
  assessmentPoolId: string;
  assessmentCode: string;
  assessmentTitle: string;
  questionType: QuestionType;
  difficultyLevel: DifficultyLevel;
  status: AssessmentPoolStatus;
  canReviewSubmissions: boolean;
  canManageAttempts: boolean;
  canManualGrade: boolean;
  notes: string | null;
  assignedAt: string;
  updatedAt: string;
};