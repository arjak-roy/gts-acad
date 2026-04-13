import type { AssessmentAttemptStatus, DifficultyLevel, QuestionType } from "@prisma/client";

export const ASSESSMENT_ATTEMPT_STATUS_LABELS: Record<AssessmentAttemptStatus, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Pending Review",
  IN_REVIEW: "In Review",
  GRADED: "Graded",
};

export type AssessmentReviewAccess = {
  canReviewResponses: boolean;
  canManageAttempts: boolean;
  canManualGrade: boolean;
  isGlobalAccess: boolean;
};

export type AssessmentReviewQueueItem = {
  id: string;
  assessmentId: string;
  assessmentPoolId: string;
  assessmentCode: string;
  assessmentTitle: string;
  questionType: QuestionType;
  difficultyLevel: DifficultyLevel;
  learnerId: string;
  learnerCode: string;
  learnerName: string;
  batchId: string;
  batchName: string;
  status: AssessmentAttemptStatus;
  submittedAt: string;
  reviewStartedAt: string | null;
  gradedAt: string | null;
  reviewerName: string | null;
  totalMarks: number;
  marksObtained: number | null;
  percentage: number | null;
  passed: boolean | null;
  requiresManualReview: boolean;
  access: AssessmentReviewAccess;
};

export type AssessmentReviewQuestionItem = {
  questionId: string;
  questionText: string;
  questionType: QuestionType;
  options: unknown;
  submittedAnswer: unknown;
  maxMarks: number;
  marksAwarded: number | null;
  autoMarksAwarded: number | null;
  requiresManualReview: boolean;
  feedback: string | null;
};

export type AssessmentReviewDetail = AssessmentReviewQueueItem & {
  reviewerFeedback: string | null;
  questions: AssessmentReviewQuestionItem[];
};