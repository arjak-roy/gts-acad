import type { Prisma } from "@prisma/client";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import type { GradingReport } from "@/services/assessment-pool/types";
import type { AssessmentReviewAccess } from "@/services/assessment-reviews/types";
import { hasPermission } from "@/services/rbac-service";

type StoredAttemptAnswer = {
  questionId: string;
  answer: unknown;
};

export async function resolveAssessmentReviewScope(userId: string) {
  if (!isDatabaseConfigured) {
    return {
      hasGlobalAccess: true,
      trainerId: null,
    };
  }

  const [hasTrainerManagementAccess, hasPoolEditAccess, trainerProfile] = await Promise.all([
    hasPermission(userId, "trainers.manage"),
    hasPermission(userId, "assessment_pool.edit"),
    prisma.trainerProfile.findUnique({
      where: { userId },
      select: { id: true },
    }),
  ]);

  return {
    hasGlobalAccess: hasTrainerManagementAccess || hasPoolEditAccess,
    trainerId: trainerProfile?.id ?? null,
  };
}

export async function resolveAssessmentReviewAccess(userId: string, assessmentPoolId: string): Promise<AssessmentReviewAccess> {
  const scope = await resolveAssessmentReviewScope(userId);

  if (scope.hasGlobalAccess) {
    return {
      canReviewResponses: true,
      canManageAttempts: true,
      canManualGrade: true,
      isGlobalAccess: true,
    };
  }

  if (!scope.trainerId || !isDatabaseConfigured) {
    return {
      canReviewResponses: false,
      canManageAttempts: false,
      canManualGrade: false,
      isGlobalAccess: false,
    };
  }

  const assignment = await prisma.trainerAssessmentAssignment.findFirst({
    where: {
      trainerId: scope.trainerId,
      assessmentPoolId,
      isActive: true,
    },
    select: {
      canReviewSubmissions: true,
      canManageAttempts: true,
      canManualGrade: true,
    },
  });

  return {
    canReviewResponses: assignment?.canReviewSubmissions ?? false,
    canManageAttempts: assignment?.canManageAttempts ?? false,
    canManualGrade: assignment?.canManualGrade ?? false,
    isGlobalAccess: false,
  };
}

export function parseAssessmentAttemptAnswers(value: Prisma.JsonValue | null): StoredAttemptAnswer[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) {
      return [];
    }

    const answerItem = item as { questionId?: unknown; answer?: unknown };
    return typeof answerItem.questionId === "string"
      ? [{ questionId: answerItem.questionId, answer: answerItem.answer ?? null }]
      : [];
  });
}

export function parseAssessmentAttemptGradingReport(value: Prisma.JsonValue | null): GradingReport | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as unknown as GradingReport;
}