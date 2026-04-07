import "server-only";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import type { AssessmentPoolDetail, AssessmentPoolListItem, QuestionDetail } from "@/services/assessment-pool/types";

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
  if (filters?.courseId) where.courseId = filters.courseId;
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
      courseId: true,
      questionType: true,
      difficultyLevel: true,
      totalMarks: true,
      passingMarks: true,
      timeLimitMinutes: true,
      status: true,
      isAiGenerated: true,
      createdAt: true,
      course: { select: { name: true } },
      _count: { select: { questions: true, courseAssessmentLinks: true } },
    },
  });

  return pools.map((p) => ({
    id: p.id,
    code: p.code,
    title: p.title,
    description: p.description,
    courseId: p.courseId,
    courseName: p.course?.name ?? null,
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
      courseId: true,
      questionType: true,
      difficultyLevel: true,
      totalMarks: true,
      passingMarks: true,
      timeLimitMinutes: true,
      status: true,
      isAiGenerated: true,
      createdAt: true,
      updatedAt: true,
      course: { select: { name: true } },
      createdBy: { select: { name: true } },
      questions: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          questionText: true,
          questionType: true,
          options: true,
          correctAnswer: true,
          explanation: true,
          marks: true,
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
    courseId: pool.courseId,
    courseName: pool.course?.name ?? null,
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
      options: true,
      correctAnswer: true,
      explanation: true,
      marks: true,
      sortOrder: true,
    },
  });

  return questions as QuestionDetail[];
}
