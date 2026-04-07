import { AssessmentPoolStatus, DifficultyLevel, QuestionType } from "@prisma/client";

export type AssessmentPoolListItem = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  courseId: string | null;
  courseName: string | null;
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
  isCorrect: boolean;
  marksAwarded: number;
  maxMarks: number;
  correctAnswer: unknown;
};

export type GradingReport = {
  totalMarks: number;
  marksObtained: number;
  percentage: number;
  passed: boolean;
  results: GradeResult[];
};
