import "server-only";

import { Prisma } from "@prisma/client";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import type {
  BulkDeleteQuestionBankQuestionsInput,
  CreateQuestionBankQuestionInput,
  DuplicateAssessmentQuestionsToBankInput,
  ImportQuestionBankQuestionsInput,
  UpdateQuestionBankQuestionInput,
} from "@/lib/validation-schemas/question-bank";
import { createAuditLogEntry } from "@/services/logs-actions-service";
import { AUDIT_ACTION_TYPE, AUDIT_ENTITY_TYPE } from "@/services/logs-actions/constants";
import type { QuestionBankBulkMutationResult, QuestionBankImportResult, QuestionBankQuestionItem } from "@/services/question-bank/types";

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

function toNullableJsonValue(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  return value === null || value === undefined ? Prisma.DbNull : value as Prisma.InputJsonValue;
}

function normalizeQuestionBankTags(tags: string[] | undefined): string[] {
  const normalized = (tags ?? [])
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);

  return [...new Set(normalized)];
}

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

export async function createQuestionBankQuestionService(
  input: CreateQuestionBankQuestionInput,
  options?: { actorUserId?: string },
): Promise<QuestionBankQuestionItem> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const question = await prisma.questionBankQuestion.create({
    data: {
      courseId: input.courseId || null,
      questionText: input.questionText.trim(),
      questionType: input.questionType,
      options: toNullableJsonValue(input.options),
      correctAnswer: toNullableJsonValue(input.correctAnswer),
      explanation: input.explanation?.trim() || null,
      tags: normalizeQuestionBankTags(input.tags),
      marks: input.marks ?? 1,
      createdById: options?.actorUserId ?? null,
    },
    select: questionBankQuestionSelect,
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.SYSTEM,
    entityId: question.id,
    action: AUDIT_ACTION_TYPE.CREATED,
    message: "Question bank question created.",
    actorUserId: options?.actorUserId,
    metadata: {
      domain: "QUESTION_BANK",
      questionType: question.questionType,
      courseId: question.courseId,
      tags: question.tags,
    },
  });

  return mapQuestionBankQuestion(question);
}

export async function updateQuestionBankQuestionService(
  input: UpdateQuestionBankQuestionInput,
  options?: { actorUserId?: string },
): Promise<QuestionBankQuestionItem> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const question = await prisma.questionBankQuestion.update({
    where: { id: input.questionId },
    data: {
      ...(input.courseId !== undefined && { courseId: input.courseId || null }),
      ...(input.questionText !== undefined && { questionText: input.questionText.trim() }),
      ...(input.questionType !== undefined && { questionType: input.questionType }),
      ...(input.options !== undefined && { options: toNullableJsonValue(input.options) }),
      ...(input.correctAnswer !== undefined && { correctAnswer: toNullableJsonValue(input.correctAnswer) }),
      ...(input.explanation !== undefined && { explanation: input.explanation.trim() || null }),
      ...(input.tags !== undefined && { tags: normalizeQuestionBankTags(input.tags) }),
      ...(input.marks !== undefined && { marks: input.marks }),
    },
    select: questionBankQuestionSelect,
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.SYSTEM,
    entityId: question.id,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: "Question bank question updated.",
    actorUserId: options?.actorUserId,
    metadata: {
      domain: "QUESTION_BANK",
      questionType: question.questionType,
      courseId: question.courseId,
      tags: question.tags,
    },
  });

  return mapQuestionBankQuestion(question);
}

export async function deleteQuestionBankQuestionService(
  questionId: string,
  options?: { actorUserId?: string },
): Promise<void> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  await prisma.questionBankQuestion.delete({ where: { id: questionId } });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.SYSTEM,
    entityId: questionId,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: "Question bank question deleted.",
    actorUserId: options?.actorUserId,
    metadata: { domain: "QUESTION_BANK" },
  });
}

export async function bulkDeleteQuestionBankQuestionsService(
  input: BulkDeleteQuestionBankQuestionsInput,
  options?: { actorUserId?: string },
): Promise<QuestionBankBulkMutationResult> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const uniqueQuestionIds = [...new Set(input.questionIds)];

  const result = await prisma.questionBankQuestion.deleteMany({
    where: { id: { in: uniqueQuestionIds } },
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.SYSTEM,
    entityId: uniqueQuestionIds.join(","),
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `Deleted ${result.count} question bank question(s).`,
    actorUserId: options?.actorUserId,
    metadata: { domain: "QUESTION_BANK", questionIds: uniqueQuestionIds, affectedCount: result.count },
  });

  return { affectedCount: result.count };
}

export async function importQuestionBankQuestionsToAssessmentService(
  input: ImportQuestionBankQuestionsInput,
  options?: { actorUserId?: string },
): Promise<QuestionBankImportResult> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const uniqueQuestionIds = [...new Set(input.questionIds)];
  if (uniqueQuestionIds.length === 0) {
    throw new Error("Select at least one question.");
  }

  const assessmentPool = await prisma.assessmentPool.findUnique({
    where: { id: input.assessmentPoolId },
    select: { id: true, title: true },
  });

  if (!assessmentPool) {
    throw new Error("Assessment pool not found.");
  }

  const sourceQuestions = await prisma.questionBankQuestion.findMany({
    where: { id: { in: uniqueQuestionIds } },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      questionText: true,
      questionType: true,
      options: true,
      correctAnswer: true,
      explanation: true,
      marks: true,
    },
  });

  if (sourceQuestions.length !== uniqueQuestionIds.length) {
    throw new Error("Some selected question bank items could not be found.");
  }

  const orderedSourceQuestions = uniqueQuestionIds
    .map((questionId) => sourceQuestions.find((question) => question.id === questionId))
    .filter((question): question is (typeof sourceQuestions)[number] => Boolean(question));

  await prisma.$transaction(async (transaction) => {
    const lastQuestion = await transaction.assessmentQuestion.findFirst({
      where: { assessmentPoolId: input.assessmentPoolId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    let nextSortOrder = (lastQuestion?.sortOrder ?? -1) + 1;

    for (const question of orderedSourceQuestions) {
      await transaction.assessmentQuestion.create({
        data: {
          assessmentPoolId: input.assessmentPoolId,
          questionText: question.questionText,
          questionType: question.questionType,
          options: toNullableJsonValue(question.options),
          correctAnswer: toNullableJsonValue(question.correctAnswer),
          explanation: question.explanation,
          marks: question.marks,
          sortOrder: nextSortOrder,
        },
      });

      nextSortOrder += 1;
    }
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.ASSESSMENT_POOL,
    entityId: assessmentPool.id,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `Imported ${sourceQuestions.length} question bank item(s) into assessment pool "${assessmentPool.title}".`,
    actorUserId: options?.actorUserId,
    metadata: {
      source: "QUESTION_BANK",
      importedCount: sourceQuestions.length,
      questionIds: uniqueQuestionIds,
    },
  });

  return { importedCount: sourceQuestions.length };
}

export async function duplicateAssessmentQuestionsToBankService(
  input: DuplicateAssessmentQuestionsToBankInput,
  options?: { actorUserId?: string },
): Promise<QuestionBankBulkMutationResult> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const uniqueQuestionIds = [...new Set(input.questionIds)];
  const normalizedTags = normalizeQuestionBankTags(input.tags);

  const assessmentPool = await prisma.assessmentPool.findUnique({
    where: { id: input.assessmentPoolId },
    select: { id: true, title: true },
  });

  if (!assessmentPool) {
    throw new Error("Assessment pool not found.");
  }

  const sourceQuestions = await prisma.assessmentQuestion.findMany({
    where: {
      assessmentPoolId: input.assessmentPoolId,
      id: { in: uniqueQuestionIds },
    },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      questionText: true,
      questionType: true,
      options: true,
      correctAnswer: true,
      explanation: true,
      marks: true,
    },
  });

  if (sourceQuestions.length !== uniqueQuestionIds.length) {
    throw new Error("Some selected assessment questions could not be found.");
  }

  const orderedSourceQuestions = sourceQuestions.sort(
    (left, right) => uniqueQuestionIds.indexOf(left.id) - uniqueQuestionIds.indexOf(right.id),
  );

  await prisma.$transaction(async (transaction) => {
    for (const question of orderedSourceQuestions) {
      await transaction.questionBankQuestion.create({
        data: {
          courseId: input.courseId || null,
          questionText: question.questionText,
          questionType: question.questionType,
          options: toNullableJsonValue(question.options),
          correctAnswer: toNullableJsonValue(question.correctAnswer),
          explanation: question.explanation,
          tags: normalizedTags,
          marks: question.marks,
          createdById: options?.actorUserId ?? null,
        },
      });
    }
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.SYSTEM,
    entityId: assessmentPool.id,
    action: AUDIT_ACTION_TYPE.CREATED,
    message: `Duplicated ${orderedSourceQuestions.length} assessment question(s) into the question bank from "${assessmentPool.title}".`,
    actorUserId: options?.actorUserId,
    metadata: {
      domain: "QUESTION_BANK",
      source: "ASSESSMENT_POOL",
      assessmentPoolId: assessmentPool.id,
      questionIds: uniqueQuestionIds,
      affectedCount: orderedSourceQuestions.length,
      tags: normalizedTags,
    },
  });

  return { affectedCount: orderedSourceQuestions.length };
}