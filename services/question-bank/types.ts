import { QuestionType } from "@prisma/client";

export type QuestionBankQuestionItem = {
  id: string;
  courseId: string | null;
  courseName: string | null;
  questionText: string;
  questionType: QuestionType;
  options: unknown;
  correctAnswer: unknown;
  explanation: string | null;
  tags: string[];
  marks: number;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type QuestionBankImportResult = {
  importedCount: number;
};

export type QuestionBankBulkMutationResult = {
  affectedCount: number;
};