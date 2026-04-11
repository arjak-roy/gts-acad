import { AssessmentPoolStatus, DifficultyLevel, QuestionType } from "@prisma/client";

export type AssessmentPoolListItem = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  questionType: QuestionType;
  difficultyLevel: DifficultyLevel;
  totalMarks: number;
  passingMarks: number;
  timeLimitMinutes: number | null;
  status: AssessmentPoolStatus;
  isAiGenerated: boolean;
  questionCount: number;
  courseLinksCount: number;
  createdAt: Date;
};

export type QuestionDetail = {
  id: string;
  questionText: string;
  questionType: QuestionType;
  options: unknown;
  correctAnswer: unknown;
  explanation: string | null;
  marks: number;
  sortOrder: number;
};

export type AssessmentPoolDetail = AssessmentPoolListItem & {
  questions: QuestionDetail[];
  createdByName: string | null;
  updatedAt: Date;
};

export type AssessmentPoolCreateResult = {
  id: string;
  code: string;
  title: string;
  questionType: QuestionType;
  status: AssessmentPoolStatus;
};

export type GradeResult = {
  questionId: string;
  isCorrect: boolean | null;
  marksAwarded: number;
  maxMarks: number;
  correctAnswer: unknown;
  requiresManualReview?: boolean;
  feedback?: string | null;
};

export type GradingReport = {
  totalMarks: number;
  marksObtained: number;
  percentage: number;
  passed: boolean;
  requiresManualReview: boolean;
  results: GradeResult[];
};

export type CandidateAssessmentQuestion = {
  id: string;
  questionText: string;
  questionType: QuestionType;
  options: unknown;
  marks: number;
  sortOrder: number;
};

export type CandidateAssessmentAttemptSummary = {
  assessmentId: string;
  status: "PENDING_REVIEW" | "IN_REVIEW" | "GRADED";
  percentage: number | null;
  passed: boolean | null;
  submittedAt: Date;
  gradedAt: Date | null;
  marksObtained: number | null;
  totalMarks: number;
  requiresManualReview: boolean;
};

export type CandidateAssessmentDetail = {
  batchId: string;
  assessmentPoolId: string;
  mappingId: string;
  assessmentTitle: string;
  assessmentCode: string;
  description: string | null;
  questionType: QuestionType;
  difficultyLevel: DifficultyLevel;
  totalMarks: number;
  passingMarks: number;
  timeLimitMinutes: number | null;
  scheduledAt: Date | null;
  opensAt: Date | null;
  closesAt: Date | null;
  isOpen: boolean;
  isClosed: boolean;
  supportsInAppAttempt: boolean;
  availabilityMessage: string | null;
  questionCount: number;
  questions: CandidateAssessmentQuestion[];
  attempt: CandidateAssessmentAttemptSummary | null;
};

export type CandidateAssessmentSubmissionResult = {
  batchId: string;
  assessmentPoolId: string;
  attempt: CandidateAssessmentAttemptSummary;
};
