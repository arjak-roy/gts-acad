import "server-only";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import type { BatchAssessmentItem, BatchContentItem } from "@/services/batch-content/types";
import type { ContentListItem } from "@/services/course-content/types";
import type { AssessmentPoolListItem } from "@/services/assessment-pool/types";

export async function listBatchContentService(batchId: string): Promise<BatchContentItem[]> {
  if (!isDatabaseConfigured) return [];

  const mappings = await prisma.batchContentMapping.findMany({
    where: { batchId },
    orderBy: { assignedAt: "desc" },
    select: {
      id: true,
      batchId: true,
      contentId: true,
      assignedAt: true,
      content: {
        select: { title: true, contentType: true, status: true, fileName: true },
      },
      assignedBy: { select: { name: true } },
    },
  });

  return mappings.map((m) => ({
    id: m.id,
    batchId: m.batchId,
    contentId: m.contentId,
    contentTitle: m.content.title,
    contentType: m.content.contentType,
    contentStatus: m.content.status,
    fileName: m.content.fileName,
    assignedByName: m.assignedBy?.name ?? null,
    assignedAt: m.assignedAt,
  }));
}

export async function listBatchAssessmentsService(batchId: string): Promise<BatchAssessmentItem[]> {
  if (!isDatabaseConfigured) return [];

  const mappings = await prisma.batchAssessmentMapping.findMany({
    where: { batchId },
    orderBy: { assignedAt: "desc" },
    select: {
      id: true,
      batchId: true,
      assessmentPoolId: true,
      scheduledAt: true,
      assignedAt: true,
      assessmentPool: {
        select: {
          title: true,
          code: true,
          questionType: true,
          difficultyLevel: true,
          status: true,
          totalMarks: true,
          _count: { select: { questions: true } },
        },
      },
      assignedBy: { select: { name: true } },
    },
  });

  return mappings.map((m) => ({
    id: m.id,
    batchId: m.batchId,
    assessmentPoolId: m.assessmentPoolId,
    assessmentTitle: m.assessmentPool.title,
    assessmentCode: m.assessmentPool.code,
    questionType: m.assessmentPool.questionType,
    difficultyLevel: m.assessmentPool.difficultyLevel,
    status: m.assessmentPool.status,
    questionCount: m.assessmentPool._count.questions,
    totalMarks: m.assessmentPool.totalMarks,
    assignedByName: m.assignedBy?.name ?? null,
    scheduledAt: m.scheduledAt,
    assignedAt: m.assignedAt,
  }));
}

export async function getAvailableContentForBatchService(
  batchId: string,
): Promise<ContentListItem[]> {
  if (!isDatabaseConfigured) return [];

  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    select: { program: { select: { courseId: true } } },
  });

  if (!batch) return [];

  const assigned = await prisma.batchContentMapping.findMany({
    where: { batchId },
    select: { contentId: true },
  });

  const assignedIds = new Set(assigned.map((a) => a.contentId));

  const contents = await prisma.courseContent.findMany({
    where: {
      courseId: batch.program.courseId,
      status: "PUBLISHED",
      id: { notIn: [...assignedIds] },
    },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: {
      id: true,
      courseId: true,
      folderId: true,
      title: true,
      description: true,
      excerpt: true,
      contentType: true,
      estimatedReadingMinutes: true,
      fileUrl: true,
      fileName: true,
      fileSize: true,
      mimeType: true,
      storagePath: true,
      storageProvider: true,
      sortOrder: true,
      status: true,
      isScorm: true,
      createdAt: true,
      folder: { select: { name: true } },
      course: { select: { name: true } },
    },
  });

  return contents.map((c) => ({
    id: c.id,
    courseId: c.courseId,
    courseName: c.course.name,
    folderId: c.folderId,
    folderName: c.folder?.name ?? null,
    title: c.title,
    description: c.description,
    excerpt: c.excerpt,
    contentType: c.contentType,
    estimatedReadingMinutes: c.estimatedReadingMinutes,
    fileUrl: c.fileUrl,
    fileName: c.fileName,
    fileSize: c.fileSize,
    mimeType: c.mimeType,
    storagePath: c.storagePath,
    storageProvider: c.storageProvider,
    sortOrder: c.sortOrder,
    status: c.status,
    isScorm: c.isScorm,
    createdAt: c.createdAt,
  }));
}

export async function getAvailableAssessmentsForBatchService(
  batchId: string,
): Promise<AssessmentPoolListItem[]> {
  if (!isDatabaseConfigured) return [];

  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    select: { program: { select: { courseId: true } } },
  });

  if (!batch) return [];

  const assigned = await prisma.batchAssessmentMapping.findMany({
    where: { batchId },
    select: { assessmentPoolId: true },
  });

  const assignedIds = new Set(assigned.map((a) => a.assessmentPoolId));

  // Get assessments linked to the course OR standalone (no course)
  const pools = await prisma.assessmentPool.findMany({
    where: {
      status: "PUBLISHED",
      id: { notIn: [...assignedIds] },
      OR: [
        { courseId: batch.program.courseId },
        { courseAssessmentLinks: { some: { courseId: batch.program.courseId } } },
        { courseId: null },
      ],
    },
    orderBy: { title: "asc" },
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
