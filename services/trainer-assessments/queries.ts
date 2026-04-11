import "server-only";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import type { TrainerAssessmentAssignmentItem } from "@/services/trainer-assessments/types";

function mapTrainerAssessmentAssignment(record: {
  id: string;
  canReviewSubmissions: boolean;
  canManageAttempts: boolean;
  canManualGrade: boolean;
  notes: string | null;
  assignedAt: Date;
  updatedAt: Date;
  assessmentPool: {
    id: string;
    code: string;
    title: string;
    questionType: TrainerAssessmentAssignmentItem["questionType"];
    difficultyLevel: TrainerAssessmentAssignmentItem["difficultyLevel"];
    status: TrainerAssessmentAssignmentItem["status"];
  };
}): TrainerAssessmentAssignmentItem {
  return {
    id: record.id,
    assessmentPoolId: record.assessmentPool.id,
    assessmentCode: record.assessmentPool.code,
    assessmentTitle: record.assessmentPool.title,
    questionType: record.assessmentPool.questionType,
    difficultyLevel: record.assessmentPool.difficultyLevel,
    status: record.assessmentPool.status,
    canReviewSubmissions: record.canReviewSubmissions,
    canManageAttempts: record.canManageAttempts,
    canManualGrade: record.canManualGrade,
    notes: record.notes,
    assignedAt: record.assignedAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function listTrainerAssessmentAssignmentsService(trainerId: string): Promise<TrainerAssessmentAssignmentItem[]> {
  if (!isDatabaseConfigured) {
    return [];
  }

  const assignments = await prisma.trainerAssessmentAssignment.findMany({
    where: {
      trainerId,
      isActive: true,
    },
    select: {
      id: true,
      canReviewSubmissions: true,
      canManageAttempts: true,
      canManualGrade: true,
      notes: true,
      assignedAt: true,
      updatedAt: true,
      assessmentPool: {
        select: {
          id: true,
          code: true,
          title: true,
          questionType: true,
          difficultyLevel: true,
          status: true,
        },
      },
    },
    orderBy: [
      { assessmentPool: { title: "asc" } },
      { assignedAt: "desc" },
    ],
  });

  return assignments.map((assignment) => mapTrainerAssessmentAssignment(assignment));
}