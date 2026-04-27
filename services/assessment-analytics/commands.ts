import "server-only";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import type { RetakeGrantRequest } from "@/lib/validation-schemas/assessment-analytics";

export async function grantRetakeService(options: {
  userId: string;
  input: RetakeGrantRequest;
}) {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const [pool, learner, batch] = await Promise.all([
    prisma.assessmentPool.findUnique({
      where: { id: options.input.assessmentPoolId },
      select: { id: true, title: true },
    }),
    prisma.learner.findUnique({
      where: { id: options.input.learnerId },
      select: { id: true, fullName: true },
    }),
    prisma.batch.findUnique({
      where: { id: options.input.batchId },
      select: { id: true, name: true },
    }),
  ]);

  if (!pool) throw new Error("Assessment pool not found.");
  if (!learner) throw new Error("Learner not found.");
  if (!batch) throw new Error("Batch not found.");

  // Check learner is enrolled in the batch
  const enrollment = await prisma.batchEnrollment.findFirst({
    where: {
      learnerId: learner.id,
      batchId: batch.id,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  if (!enrollment) {
    throw new Error("Learner is not actively enrolled in this batch.");
  }

  // Check if there is already an unconsumed grant
  const existingGrant = await prisma.assessmentRetakeGrant.findFirst({
    where: {
      assessmentPoolId: pool.id,
      learnerId: learner.id,
      batchId: batch.id,
      consumedAt: null,
    },
    select: { id: true },
  });

  if (existingGrant) {
    throw new Error("An unused retake grant already exists for this learner and assessment.");
  }

  const grant = await prisma.assessmentRetakeGrant.create({
    data: {
      assessmentPoolId: pool.id,
      learnerId: learner.id,
      batchId: batch.id,
      grantedById: options.userId,
      reason: options.input.reason?.trim() || null,
      expiresAt: options.input.expiresAt ? new Date(options.input.expiresAt) : null,
    },
    select: {
      id: true,
      createdAt: true,
    },
  });

  return {
    grantId: grant.id,
    assessmentPoolId: pool.id,
    assessmentTitle: pool.title,
    learnerId: learner.id,
    learnerName: learner.fullName,
    batchId: batch.id,
    batchName: batch.name,
    createdAt: grant.createdAt.toISOString(),
  };
}

export async function getRetakeGrantsForLearner(options: {
  learnerId: string;
  assessmentPoolId: string;
  batchId: string;
}) {
  if (!isDatabaseConfigured) return [];

  return prisma.assessmentRetakeGrant.findMany({
    where: {
      learnerId: options.learnerId,
      assessmentPoolId: options.assessmentPoolId,
      batchId: options.batchId,
    },
    select: {
      id: true,
      reason: true,
      expiresAt: true,
      consumedAt: true,
      consumedAttemptId: true,
      createdAt: true,
      grantedBy: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAvailableRetakeGrant(options: {
  learnerId: string;
  assessmentPoolId: string;
  batchId: string;
}) {
  if (!isDatabaseConfigured) return null;

  const now = new Date();

  return prisma.assessmentRetakeGrant.findFirst({
    where: {
      learnerId: options.learnerId,
      assessmentPoolId: options.assessmentPoolId,
      batchId: options.batchId,
      consumedAt: null,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
    },
    select: {
      id: true,
      reason: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function consumeRetakeGrant(grantId: string, attemptId: string) {
  return prisma.assessmentRetakeGrant.update({
    where: { id: grantId },
    data: {
      consumedAt: new Date(),
      consumedAttemptId: attemptId,
    },
  });
}
