import "server-only";

import { Prisma } from "@prisma/client";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import type { QuestionBankQuestionItem } from "@/services/question-bank/types";

const questionBankQuestionSelect = {
  id: true,
  courseId: true,
  questionText: true,
  questionType: true,
  options: true,
  correctAnswer: true,
  explanation: true,
  tags: true,
  marks: true,
  difficultyLevel: true,
  createdAt: true,
  updatedAt: true,
  course: { select: { name: true } },
  createdBy: { select: { name: true } },
} satisfies Prisma.QuestionBankQuestionSelect;

type QuestionBankQuestionRecord = Prisma.QuestionBankQuestionGetPayload<{ select: typeof questionBankQuestionSelect }>;

function mapQuestionBankQuestion(question: QuestionBankQuestionRecord): QuestionBankQuestionItem {
  return {
    id: question.id,
    courseId: question.courseId,
    courseName: question.course?.name ?? null,
    questionText: question.questionText,
    questionType: question.questionType,
    options: question.options,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    tags: question.tags,
    marks: question.marks,
    difficultyLevel: question.difficultyLevel,
    createdByName: question.createdBy?.name ?? null,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
  };
}

export async function getQuestionBankQuestionByIdService(questionId: string): Promise<QuestionBankQuestionItem | null> {
  const question = await prisma.questionBankQuestion.findUnique({
    where: { id: questionId },
    select: questionBankQuestionSelect,
  });
  if (!question) return null;
  return mapQuestionBankQuestion(question);
}

export async function listQuestionBankQuestionsService(filters?: {
  courseId?: string;
  questionType?: string;
  search?: string;
}): Promise<QuestionBankQuestionItem[]> {
  if (!isDatabaseConfigured) {
    return [];
  }

  const where: Prisma.QuestionBankQuestionWhereInput = {};

  if (filters?.courseId) {
    where.courseId = filters.courseId;
  }

  if (filters?.questionType) {
    where.questionType = filters.questionType as QuestionBankQuestionItem["questionType"];
  }

  if (filters?.search) {
    where.OR = [
      { questionText: { contains: filters.search, mode: "insensitive" } },
      { explanation: { contains: filters.search, mode: "insensitive" } },
      { tags: { has: filters.search.trim().toLowerCase() } },
    ];
  }

  const questions = await prisma.questionBankQuestion.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: questionBankQuestionSelect,
  });

  return questions.map(mapQuestionBankQuestion);
}