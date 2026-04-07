import "server-only";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { AUDIT_ENTITY_TYPE, AUDIT_ACTION_TYPE } from "@/services/logs-actions/constants";
import { deriveGeneratedCodePrefix } from "@/lib/utils";
import type { CreateAssessmentPoolInput, UpdateAssessmentPoolInput, CreateQuestionInput, UpdateQuestionInput } from "@/lib/validation-schemas/assessment-pool";
import { createAuditLogEntry } from "@/services/logs-actions-service";
import type { AssessmentPoolCreateResult, QuestionDetail } from "@/services/assessment-pool/types";

export async function generateAssessmentPoolCode(title: string): Promise<string> {
  const prefix = deriveGeneratedCodePrefix(title);
  if (!isDatabaseConfigured) {
    return `A-${prefix}-001`;
  }

  const lastPool = await prisma.assessmentPool.findFirst({
    where: { code: { startsWith: `A-${prefix}-` } },
    orderBy: { code: "desc" },
    select: { code: true },
  });

  let sequence = 1;
  if (lastPool) {
    const match = lastPool.code.match(/-(\d+)$/);
    sequence = match ? Number.parseInt(match[1], 10) + 1 : 1;
  }

  return `A-${prefix}-${sequence.toString().padStart(3, "0")}`;
}

export async function createAssessmentPoolService(
  input: CreateAssessmentPoolInput,
  options?: { actorUserId?: string },
): Promise<AssessmentPoolCreateResult> {
  const normalizedTitle = input.title.trim();
  let normalizedCode = input.code?.trim().toUpperCase() || "";

  if (!normalizedCode) {
    normalizedCode = await generateAssessmentPoolCode(normalizedTitle);
  }

  if (!isDatabaseConfigured) {
    return {
      id: `mock-pool-${Date.now()}`,
      code: normalizedCode,
      title: normalizedTitle,
      questionType: input.questionType as AssessmentPoolCreateResult["questionType"],
      status: "DRAFT" as AssessmentPoolCreateResult["status"],
    };
  }

  const existingCode = await prisma.assessmentPool.findUnique({
    where: { code: normalizedCode },
    select: { id: true },
  });

  if (existingCode) {
    throw new Error("Assessment pool code already exists.");
  }

  const pool = await prisma.assessmentPool.create({
    data: {
      code: normalizedCode,
      title: normalizedTitle,
      description: input.description?.trim() || null,
      courseId: input.courseId || null,
      questionType: input.questionType as AssessmentPoolCreateResult["questionType"],
      difficultyLevel: (input.difficultyLevel ?? "MEDIUM") as "EASY" | "MEDIUM" | "HARD",
      totalMarks: input.totalMarks ?? 100,
      passingMarks: input.passingMarks ?? 40,
      timeLimitMinutes: input.timeLimitMinutes ?? null,
      createdById: options?.actorUserId ?? null,
    },
    select: {
      id: true,
      code: true,
      title: true,
      questionType: true,
      status: true,
    },
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.ASSESSMENT_POOL,
    entityId: pool.id,
    action: AUDIT_ACTION_TYPE.CREATED,
    message: `Assessment pool "${pool.title}" created.`,
    actorUserId: options?.actorUserId,
    metadata: { code: pool.code, questionType: pool.questionType },
  });

  return pool;
}

export async function updateAssessmentPoolService(
  input: UpdateAssessmentPoolInput,
  options?: { actorUserId?: string },
): Promise<AssessmentPoolCreateResult> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const existing = await prisma.assessmentPool.findUnique({
    where: { id: input.poolId },
    select: { id: true, title: true },
  });

  if (!existing) {
    throw new Error("Assessment pool not found.");
  }

  const pool = await prisma.assessmentPool.update({
    where: { id: input.poolId },
    data: {
      ...(input.title !== undefined && { title: input.title.trim() }),
      ...(input.description !== undefined && { description: input.description.trim() || null }),
      ...(input.questionType !== undefined && { questionType: input.questionType as AssessmentPoolCreateResult["questionType"] }),
      ...(input.difficultyLevel !== undefined && { difficultyLevel: input.difficultyLevel as "EASY" | "MEDIUM" | "HARD" }),
      ...(input.totalMarks !== undefined && { totalMarks: input.totalMarks }),
      ...(input.passingMarks !== undefined && { passingMarks: input.passingMarks }),
      ...(input.timeLimitMinutes !== undefined && { timeLimitMinutes: input.timeLimitMinutes }),
      ...(input.status !== undefined && { status: input.status as AssessmentPoolCreateResult["status"] }),
    },
    select: {
      id: true,
      code: true,
      title: true,
      questionType: true,
      status: true,
    },
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.ASSESSMENT_POOL,
    entityId: pool.id,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `Assessment pool "${pool.title}" updated.`,
    actorUserId: options?.actorUserId,
  });

  return pool;
}

export async function publishAssessmentPoolService(
  poolId: string,
  options?: { actorUserId?: string },
): Promise<AssessmentPoolCreateResult> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const pool = await prisma.assessmentPool.update({
    where: { id: poolId },
    data: { status: "PUBLISHED" },
    select: { id: true, code: true, title: true, questionType: true, status: true },
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.ASSESSMENT_POOL,
    entityId: pool.id,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `Assessment pool "${pool.title}" published.`,
    actorUserId: options?.actorUserId,
  });

  return pool;
}

export async function archiveAssessmentPoolService(
  poolId: string,
  options?: { actorUserId?: string },
): Promise<AssessmentPoolCreateResult> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const pool = await prisma.assessmentPool.update({
    where: { id: poolId },
    data: { status: "ARCHIVED" },
    select: { id: true, code: true, title: true, questionType: true, status: true },
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.ASSESSMENT_POOL,
    entityId: pool.id,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `Assessment pool "${pool.title}" archived.`,
    actorUserId: options?.actorUserId,
  });

  return pool;
}

export async function addQuestionService(
  input: CreateQuestionInput,
  options?: { actorUserId?: string },
): Promise<QuestionDetail> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const pool = await prisma.assessmentPool.findUnique({
    where: { id: input.assessmentPoolId },
    select: { id: true },
  });

  if (!pool) {
    throw new Error("Assessment pool not found.");
  }

  const lastQuestion = await prisma.assessmentQuestion.findFirst({
    where: { assessmentPoolId: input.assessmentPoolId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const nextOrder = input.sortOrder ?? ((lastQuestion?.sortOrder ?? -1) + 1);

  const question = await prisma.assessmentQuestion.create({
    data: {
      assessmentPoolId: input.assessmentPoolId,
      questionText: input.questionText.trim(),
      questionType: input.questionType as QuestionDetail["questionType"],
      options: input.options ?? null,
      correctAnswer: input.correctAnswer ?? null,
      explanation: input.explanation?.trim() || null,
      marks: input.marks ?? 1,
      sortOrder: nextOrder,
    },
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

  return question as QuestionDetail;
}

export async function updateQuestionService(input: UpdateQuestionInput): Promise<QuestionDetail> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const question = await prisma.assessmentQuestion.update({
    where: { id: input.questionId },
    data: {
      ...(input.questionText !== undefined && { questionText: input.questionText.trim() }),
      ...(input.questionType !== undefined && { questionType: input.questionType as QuestionDetail["questionType"] }),
      ...(input.options !== undefined && { options: input.options }),
      ...(input.correctAnswer !== undefined && { correctAnswer: input.correctAnswer }),
      ...(input.explanation !== undefined && { explanation: input.explanation.trim() || null }),
      ...(input.marks !== undefined && { marks: input.marks }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
    },
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

  return question as QuestionDetail;
}

export async function deleteQuestionService(questionId: string): Promise<void> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  await prisma.assessmentQuestion.delete({ where: { id: questionId } });
}
