import { AssessmentPoolStatus, DifficultyLevel, QuestionType } from "@prisma/client";

import type { CandidateAssessmentDeadlineSource, CandidateCurriculumAssessmentContext } from "@/services/curriculum";

export type AssessmentPoolListItem = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  questionType: QuestionType;
  difficultyLevel: DifficultyLevel;
  totalMarks: number;
  passingMarks: number;
  passCriteriaConfig?: {
    minPercentageScore?: number;
    minMarks?: number;
    mandatoryQuestionIds?: string[];
    minCompletionRequirement?: number;
  } | null;
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
  difficultyLevel: DifficultyLevel | null;
  options: unknown;
  correctAnswer: unknown;
  explanation: string | null;
  marks: number;
  isMandatory: boolean;
  sortOrder: number;
  sectionId: string | null;
};

export type AssessmentSectionDetail = {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
};

export type AssessmentPoolDetail = AssessmentPoolListItem & {
  questions: QuestionDetail[];
  sections: AssessmentSectionDetail[];
  createdByName: string | null;
  updatedAt: Date;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  randomSubsetCount: number | null;
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

export type CandidateAssessmentSavedAnswer = {
  questionId: string;
  answer: unknown;
};

export type CandidateAssessmentAvailabilityStatus = "LOCKED" | "SCHEDULED" | "OPEN" | "CLOSED" | "EXPIRED";

export type CandidateAssessmentAttemptSummary = {
  assessmentId: string;
  status: "DRAFT" | "PENDING_REVIEW" | "IN_REVIEW" | "GRADED";
  percentage: number | null;
  passed: boolean | null;
  startedAt: Date;
  lastSavedAt: Date;
  deadlineAt: Date | null;
  autoSubmittedAt: Date | null;
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
  serverNow: Date;
  scheduledAt: Date | null;
  opensAt: Date | null;
  hardClosesAt: Date | null;
  closesAt: Date | null;
  deadlineSource: CandidateAssessmentDeadlineSource;
  attemptDeadlineAt: Date | null;
  attemptDeadlineSource: CandidateAssessmentDeadlineSource;
  curriculumContext: CandidateCurriculumAssessmentContext | null;
  availabilityStatus: CandidateAssessmentAvailabilityStatus;
  isOpen: boolean;
  isClosed: boolean;
  supportsInAppAttempt: boolean;
  availabilityMessage: string | null;
  questionCount: number;
  questions: CandidateAssessmentQuestion[];
  savedAnswers: CandidateAssessmentSavedAnswer[];
  attempt: CandidateAssessmentAttemptSummary | null;
  attemptHistory: CandidateAssessmentAttemptSummary[];
  hasRetakeGrant: boolean;
};

export type CandidateAssessmentDraftSaveResult = {
  batchId: string;
  assessmentPoolId: string;
  serverNow: Date;
  attemptDeadlineAt: Date | null;
  attemptDeadlineSource: CandidateAssessmentDeadlineSource;
  savedAnswers: CandidateAssessmentSavedAnswer[];
  attempt: CandidateAssessmentAttemptSummary;
};

export type CandidateAssessmentSubmissionResult = {
  batchId: string;
  assessmentPoolId: string;
  attempt: CandidateAssessmentAttemptSummary;
};
