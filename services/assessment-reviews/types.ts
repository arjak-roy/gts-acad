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
  overrideMarks: number | null;
  overridePassed: boolean | null;
  overrideReason: string | null;
  isFinalized: boolean;
  finalizedAt: string | null;
  finalizedByName: string | null;
  feedbackVisibleToLearner: boolean;
  requiresManualReview: boolean;
  access: AssessmentReviewAccess;
};

export type AssessmentReviewQuestionItem = {
  questionId: string;
  questionText: string;
  questionType: QuestionType;
  options: unknown;
  correctAnswer: unknown;
  isMandatory: boolean;
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

export type AssessmentReviewHistoryItem = {
  id: string;
  eventType: string;
  notes: string | null;
  scoreBefore: number | null;
  scoreAfter: number | null;
  passedBefore: boolean | null;
  passedAfter: boolean | null;
  createdAt: string;
  actorName: string | null;
};