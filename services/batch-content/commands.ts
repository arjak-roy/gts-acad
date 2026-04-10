import "server-only";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { getBatchCourseContext } from "@/services/lms/hierarchy";
import type { AssignContentToBatchInput, RemoveContentFromBatchInput, AssignAssessmentToBatchInput, RemoveAssessmentFromBatchInput } from "@/lib/validation-schemas/batch-content";

export async function assignContentToBatchService(
  input: AssignContentToBatchInput,
  options?: { actorUserId?: string },
): Promise<number> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const batch = await getBatchCourseContext(input.batchId);
  if (!batch) throw new Error("Batch not found.");

  const validContent = await prisma.courseContent.findMany({
    where: {
      id: { in: input.contentIds },
      status: "PUBLISHED",
      courseId: batch.courseId,
    },
    select: { id: true },
  });

  if (validContent.length === 0) {
    throw new Error("No valid published content items found for this batch's course.");
  }

  const result = await prisma.batchContentMapping.createMany({
    data: validContent.map((c) => ({
      batchId: input.batchId,
      contentId: c.id,
      assignedById: options?.actorUserId ?? null,
    })),
    skipDuplicates: true,
  });

  return result.count;
}

export async function removeContentFromBatchService(input: RemoveContentFromBatchInput): Promise<void> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  await prisma.batchContentMapping.deleteMany({
    where: { batchId: input.batchId, contentId: input.contentId },
  });
}

export async function assignAssessmentToBatchService(
  input: AssignAssessmentToBatchInput,
  options?: { actorUserId?: string },
): Promise<number> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const batch = await getBatchCourseContext(input.batchId);
  if (!batch) throw new Error("Batch not found.");

  const validPools = await prisma.assessmentPool.findMany({
    where: {
      id: { in: input.assessmentPoolIds },
      status: "PUBLISHED",
      OR: [
        { courseAssessmentLinks: { some: { courseId: batch.courseId } } },
        { courseAssessmentLinks: { none: {} } },
      ],
    },
    select: { id: true },
  });

  if (validPools.length === 0) {
    throw new Error("No valid published assessments found for this batch's course.");
  }

  const result = await prisma.batchAssessmentMapping.createMany({
    data: validPools.map((p) => ({
      batchId: input.batchId,
      assessmentPoolId: p.id,
      assignedById: options?.actorUserId ?? null,
      scheduledAt: input.scheduledAt ?? null,
    })),
    skipDuplicates: true,
  });

  return result.count;
}

export async function removeAssessmentFromBatchService(input: RemoveAssessmentFromBatchInput): Promise<void> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  await prisma.batchAssessmentMapping.deleteMany({
    where: { batchId: input.batchId, assessmentPoolId: input.assessmentPoolId },
  });
}
