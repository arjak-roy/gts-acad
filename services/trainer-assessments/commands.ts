import "server-only";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import type { ReplaceTrainerAssessmentAssignmentsInput } from "@/lib/validation-schemas/assessment-reviews";
import { listTrainerAssessmentAssignmentsService } from "@/services/trainer-assessments/queries";
import type { TrainerAssessmentAssignmentItem } from "@/services/trainer-assessments/types";

function normalizeAssignments(input: ReplaceTrainerAssessmentAssignmentsInput["assignments"]) {
  const deduplicated = new Map<string, ReplaceTrainerAssessmentAssignmentsInput["assignments"][number]>();

  input.forEach((assignment) => {
    deduplicated.set(assignment.assessmentPoolId, assignment);
  });

  return Array.from(deduplicated.values());
}

export async function replaceTrainerAssessmentAssignmentsService(options: {
  trainerId: string;
  assignments: ReplaceTrainerAssessmentAssignmentsInput["assignments"];
  actorUserId?: string | null;
}): Promise<TrainerAssessmentAssignmentItem[]> {
  if (!isDatabaseConfigured) {
    return [];
  }

  const normalizedAssignments = normalizeAssignments(options.assignments);
  const trainer = await prisma.trainerProfile.findUnique({
    where: { id: options.trainerId },
    select: { id: true },
  });

  if (!trainer) {
    throw new Error("Trainer not found.");
  }

  const assessmentPoolIds = normalizedAssignments.map((assignment) => assignment.assessmentPoolId);

  if (assessmentPoolIds.length > 0) {
    const pools = await prisma.assessmentPool.findMany({
      where: {
        id: { in: assessmentPoolIds },
        status: { not: "ARCHIVED" },
      },
      select: { id: true },
    });

    if (pools.length !== assessmentPoolIds.length) {
      throw new Error("One or more selected assessments are invalid.");
    }
  }

  await prisma.$transaction(async (tx) => {
    if (assessmentPoolIds.length === 0) {
      await tx.trainerAssessmentAssignment.deleteMany({
        where: {
          trainerId: options.trainerId,
        },
      });
      return;
    }

    await tx.trainerAssessmentAssignment.deleteMany({
      where: {
        trainerId: options.trainerId,
        assessmentPoolId: {
          notIn: assessmentPoolIds,
        },
      },
    });

    for (const assignment of normalizedAssignments) {
      await tx.trainerAssessmentAssignment.upsert({
        where: {
          trainerId_assessmentPoolId: {
            trainerId: options.trainerId,
            assessmentPoolId: assignment.assessmentPoolId,
          },
        },
        update: {
          canReviewSubmissions: assignment.canReviewSubmissions,
          canManageAttempts: assignment.canManageAttempts,
          canManualGrade: assignment.canManualGrade,
          notes: assignment.notes.trim() || null,
          isActive: true,
          assignedById: options.actorUserId ?? null,
        },
        create: {
          trainerId: options.trainerId,
          assessmentPoolId: assignment.assessmentPoolId,
          canReviewSubmissions: assignment.canReviewSubmissions,
          canManageAttempts: assignment.canManageAttempts,
          canManualGrade: assignment.canManualGrade,
          notes: assignment.notes.trim() || null,
          isActive: true,
          assignedById: options.actorUserId ?? null,
        },
      });
    }
  });

  return listTrainerAssessmentAssignmentsService(options.trainerId);
}