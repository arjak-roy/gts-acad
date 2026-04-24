import "server-only";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import type { AssessmentPoolDetail, AssessmentPoolListItem, AssessmentSectionDetail, QuestionDetail } from "@/services/assessment-pool/types";

export async function listAssessmentPoolsService(filters?: {
  courseId?: string;
  questionType?: string;
  difficultyLevel?: string;
  status?: string;
}): Promise<AssessmentPoolListItem[]> {
  if (!isDatabaseConfigured) {
    return [];
  }

  const where: Record<string, unknown> = {};
  if (filters?.courseId) {
    where.courseAssessmentLinks = { some: { courseId: filters.courseId } };
  }
  if (filters?.questionType) where.questionType = filters.questionType;
  if (filters?.difficultyLevel) where.difficultyLevel = filters.difficultyLevel;
  if (filters?.status) where.status = filters.status;

  const pools = await prisma.assessmentPool.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      code: true,
      title: true,
      description: true,
      questionType: true,
      difficultyLevel: true,
      totalMarks: true,
      passingMarks: true,
      timeLimitMinutes: true,
      status: true,
      isAiGenerated: true,
      createdAt: true,
      _count: { select: { questions: true, courseAssessmentLinks: true } },
    },
  });

  return pools.map((p) => ({
    id: p.id,
    code: p.code,
    title: p.title,
    description: p.description,
    questionType: p.questionType,
    difficultyLevel: p.difficultyLevel,
    totalMarks: p.totalMarks,
    passingMarks: p.passingMarks,
    timeLimitMinutes: p.timeLimitMinutes,
    status: p.status,
    isAiGenerated: p.isAiGenerated,
    questionCount: p._count.questions,
    courseLinksCount: p._count.courseAssessmentLinks,
    createdAt: p.createdAt,
  }));
}

export type AssessmentPoolSearchItem = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  questionType: string;
  difficultyLevel: string;
  status: string;
};

export async function searchAssessmentPoolsService(query: string, limit: number): Promise<AssessmentPoolSearchItem[]> {
  if (!isDatabaseConfigured) return [];

  try {
    const pools = await prisma.assessmentPool.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { code: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: [{ createdAt: "desc" }],
      take: limit,
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
        questionType: true,
        difficultyLevel: true,
        status: true,
      },
    });

    return pools.map((p) => ({
      id: p.id,
      code: p.code,
      title: p.title,
      description: p.description,
      questionType: p.questionType,
      difficultyLevel: p.difficultyLevel,
      status: p.status,
    }));
  } catch (error) {
    console.warn("Assessment pool search fallback activated", error);
    return [];
  }
}

export async function getAssessmentPoolByIdService(poolId: string): Promise<AssessmentPoolDetail | null> {
  if (!isDatabaseConfigured) {
    return null;
  }

  const pool = await prisma.assessmentPool.findUnique({
    where: { id: poolId },
    select: {
      id: true,
      code: true,
      title: true,
      description: true,
      questionType: true,
      difficultyLevel: true,
      totalMarks: true,
      passingMarks: true,
      timeLimitMinutes: true,
      status: true,
      isAiGenerated: true,
      shuffleQuestions: true,
      shuffleOptions: true,
      randomSubsetCount: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { name: true } },
      questions: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          questionText: true,
          questionType: true,
          difficultyLevel: true,
          options: true,
          correctAnswer: true,
          explanation: true,
          marks: true,
          sortOrder: true,
          sectionId: true,
        },
      },
      sections: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          sortOrder: true,
        },
      },
      _count: { select: { questions: true, courseAssessmentLinks: true } },
    },
  });

  if (!pool) return null;

  return {
    id: pool.id,
    code: pool.code,
    title: pool.title,
    description: pool.description,
    questionType: pool.questionType,
    difficultyLevel: pool.difficultyLevel,
    totalMarks: pool.totalMarks,
    passingMarks: pool.passingMarks,
    timeLimitMinutes: pool.timeLimitMinutes,
    status: pool.status,
    isAiGenerated: pool.isAiGenerated,
    questionCount: pool._count.questions,
    courseLinksCount: pool._count.courseAssessmentLinks,
    createdAt: pool.createdAt,
    updatedAt: pool.updatedAt,
    createdByName: pool.createdBy?.name ?? null,
    questions: pool.questions as QuestionDetail[],
    sections: pool.sections as AssessmentSectionDetail[],
    shuffleQuestions: pool.shuffleQuestions,
    shuffleOptions: pool.shuffleOptions,
    randomSubsetCount: pool.randomSubsetCount,
  };
}

export async function listQuestionsService(poolId: string): Promise<QuestionDetail[]> {
  if (!isDatabaseConfigured) {
    return [];
  }

  const questions = await prisma.assessmentQuestion.findMany({
    where: { assessmentPoolId: poolId },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      questionText: true,
      questionType: true,
      difficultyLevel: true,
      options: true,
      correctAnswer: true,
      explanation: true,
      marks: true,
      sortOrder: true,
      sectionId: true,
    },
  });

  return questions as QuestionDetail[];
}

export async function getQuestionByIdService(questionId: string): Promise<QuestionDetail | null> {
  const question = await prisma.assessmentQuestion.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      questionText: true,
      questionType: true,
      difficultyLevel: true,
      options: true,
      correctAnswer: true,
      explanation: true,
      marks: true,
      sortOrder: true,
      sectionId: true,
    },
  });
  return question as QuestionDetail | null;
}
