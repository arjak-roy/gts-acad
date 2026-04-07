import "server-only";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import type { AssignContentToBatchInput, RemoveContentFromBatchInput, AssignAssessmentToBatchInput, RemoveAssessmentFromBatchInput } from "@/lib/validation-schemas/batch-content";

export async function assignContentToBatchService(
  input: AssignContentToBatchInput,
  options?: { actorUserId?: string },
): Promise<number> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const batch = await prisma.batch.findUnique({ where: { id: input.batchId }, select: { id: true } });
  if (!batch) throw new Error("Batch not found.");

  const validContent = await prisma.courseContent.findMany({
    where: { id: { in: input.contentIds }, status: "PUBLISHED" },
    select: { id: true },
  });

  if (validContent.length === 0) {
    throw new Error("No valid published content items found.");
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

  const batch = await prisma.batch.findUnique({ where: { id: input.batchId }, select: { id: true } });
  if (!batch) throw new Error("Batch not found.");

  const validPools = await prisma.assessmentPool.findMany({
    where: { id: { in: input.assessmentPoolIds }, status: "PUBLISHED" },
    select: { id: true },
  });

  if (validPools.length === 0) {
    throw new Error("No valid published assessments found.");
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
