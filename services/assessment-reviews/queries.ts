import "server-only";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import type { ListAssessmentReviewQueueInput } from "@/lib/validation-schemas/assessment-reviews";
import {
  parseAssessmentAttemptAnswers,
  parseAssessmentAttemptGradingReport,
  resolveAssessmentReviewAccess,
  resolveAssessmentReviewScope,
} from "@/services/assessment-reviews/internal";
import type {
  AssessmentReviewAccess,
  AssessmentReviewDetail,
  AssessmentReviewHistoryItem,
  AssessmentReviewQueueItem,
  AssessmentReviewQuestionItem,
} from "@/services/assessment-reviews/types";

const MANUAL_REVIEW_QUESTION_TYPES = new Set(["ESSAY", "MULTI_INPUT_REASONING"]);

function buildQueueItem(options: {
  record: {
    id: string;
    assessmentId: string;
    assessmentPoolId: string;
    status: AssessmentReviewQueueItem["status"];
    submittedAt: Date;
    reviewStartedAt: Date | null;
    gradedAt: Date | null;
    totalMarks: number;
    marksObtained: number | null;
    percentage: number | null;
    passed: boolean | null;
    overrideMarks: number | null;
    overridePassed: boolean | null;
    overrideReason: string | null;
    isFinalized: boolean;
    finalizedAt: Date | null;
    feedbackVisibleToLearner: boolean;
    requiresManualReview: boolean;
    learner: {
      id: string;
      learnerCode: string;
      fullName: string;
    };
    batch: {
      id: string;
      name: string;
    };
    assessmentPool: {
      id: string;
      code: string;
      title: string;
      questionType: AssessmentReviewQueueItem["questionType"];
      difficultyLevel: AssessmentReviewQueueItem["difficultyLevel"];
    };
    reviewedByUser: {
      name: string;
    } | null;
    finalizedByUser: {
      name: string;
    } | null;
  };
  access: AssessmentReviewAccess;
}): AssessmentReviewQueueItem {
  return {
    id: options.record.id,
    assessmentId: options.record.assessmentId,
    assessmentPoolId: options.record.assessmentPoolId,
    assessmentCode: options.record.assessmentPool.code,
    assessmentTitle: options.record.assessmentPool.title,
    questionType: options.record.assessmentPool.questionType,
    difficultyLevel: options.record.assessmentPool.difficultyLevel,
    learnerId: options.record.learner.id,
    learnerCode: options.record.learner.learnerCode,
    learnerName: options.record.learner.fullName,
    batchId: options.record.batch.id,
    batchName: options.record.batch.name,
    status: options.record.status,
    submittedAt: options.record.submittedAt.toISOString(),
    reviewStartedAt: options.record.reviewStartedAt?.toISOString() ?? null,
    gradedAt: options.record.gradedAt?.toISOString() ?? null,
    reviewerName: options.record.reviewedByUser?.name ?? null,
    totalMarks: options.record.totalMarks,
    marksObtained: options.record.marksObtained,
    percentage: options.record.percentage,
    passed: options.record.passed,
    overrideMarks: options.record.overrideMarks,
    overridePassed: options.record.overridePassed,
    overrideReason: options.record.overrideReason,
    isFinalized: options.record.isFinalized,
    finalizedAt: options.record.finalizedAt?.toISOString() ?? null,
    finalizedByName: options.record.finalizedByUser?.name ?? null,
    feedbackVisibleToLearner: options.record.feedbackVisibleToLearner,
    requiresManualReview: options.record.requiresManualReview,
    access: options.access,
  };
}

function buildDetailQuestions(options: {
  questions: Array<{
    id: string;
    questionText: string;
    questionType: AssessmentReviewQuestionItem["questionType"];
    options: unknown;
    correctAnswer: unknown;
    isMandatory: boolean;
    marks: number;
    sortOrder: number;
  }>;
  answers: Array<{ questionId: string; answer: unknown }>;
  gradingReport: ReturnType<typeof parseAssessmentAttemptGradingReport>;
}): AssessmentReviewQuestionItem[] {
  const answerMap = new Map(options.answers.map((item) => [item.questionId, item.answer]));
  const resultMap = new Map((options.gradingReport?.results ?? []).map((item) => [item.questionId, item]));

  return options.questions
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((question) => {
      const result = resultMap.get(question.id) ?? null;
      const requiresManualReview = MANUAL_REVIEW_QUESTION_TYPES.has(question.questionType);

      return {
        questionId: question.id,
        questionText: question.questionText,
        questionType: question.questionType,
        options: question.options ?? null,
        correctAnswer: question.correctAnswer ?? null,
        isMandatory: question.isMandatory,
        submittedAnswer: answerMap.get(question.id) ?? null,
        maxMarks: question.marks,
        marksAwarded: result?.marksAwarded ?? (requiresManualReview ? null : 0),
        autoMarksAwarded: requiresManualReview ? 0 : result?.marksAwarded ?? 0,
        requiresManualReview,
        feedback: result?.feedback ?? null,
      };
    });
}

export async function listAssessmentReviewQueueService(options: {
  userId: string;
  filters: ListAssessmentReviewQueueInput;
}): Promise<AssessmentReviewQueueItem[]> {
  if (!isDatabaseConfigured) {
    return [];
  }

  const scope = await resolveAssessmentReviewScope(options.userId);
  if (!scope.hasGlobalAccess && !scope.trainerId) {
    return [];
  }

  const normalizedSearch = options.filters.search.trim();
  const where = {
    ...(options.filters.status !== "ALL" ? { status: options.filters.status } : { status: { not: "DRAFT" as const } }),
    ...(normalizedSearch
      ? {
          OR: [
            { learner: { is: { fullName: { contains: normalizedSearch, mode: "insensitive" as const } } } },
            { learner: { is: { learnerCode: { contains: normalizedSearch, mode: "insensitive" as const } } } },
            { batch: { is: { name: { contains: normalizedSearch, mode: "insensitive" as const } } } },
            { assessmentPool: { is: { title: { contains: normalizedSearch, mode: "insensitive" as const } } } },
            { assessmentPool: { is: { code: { contains: normalizedSearch, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
    ...(!scope.hasGlobalAccess && scope.trainerId
      ? {
          assessmentPool: {
            is: {
              trainerAssignments: {
                some: {
                  trainerId: scope.trainerId,
                  isActive: true,
                  OR: [
                    { canReviewSubmissions: true },
                    { canManageAttempts: true },
                    { canManualGrade: true },
                  ],
                },
              },
            },
          },
        }
      : {}),
  };

  const attempts = scope.hasGlobalAccess
    ? await prisma.assessmentAttempt.findMany({
        where,
        orderBy: [{ submittedAt: "desc" }],
        take: 200,
        select: {
          id: true,
          assessmentId: true,
          assessmentPoolId: true,
          status: true,
          submittedAt: true,
          reviewStartedAt: true,
          gradedAt: true,
          totalMarks: true,
          marksObtained: true,
          percentage: true,
          passed: true,
          overrideMarks: true,
          overridePassed: true,
          overrideReason: true,
          isFinalized: true,
          finalizedAt: true,
          feedbackVisibleToLearner: true,
          requiresManualReview: true,
          learner: {
            select: {
              id: true,
              learnerCode: true,
              fullName: true,
            },
          },
          batch: {
            select: {
              id: true,
              name: true,
            },
          },
          assessmentPool: {
            select: {
              id: true,
              code: true,
              title: true,
              questionType: true,
              difficultyLevel: true,
              trainerAssignments: {
                select: {
                  canReviewSubmissions: true,
                  canManageAttempts: true,
                  canManualGrade: true,
                },
                take: 1,
              },
            },
          },
          reviewedByUser: {
            select: {
              name: true,
            },
          },
          finalizedByUser: {
            select: {
              name: true,
            },
          },
        },
      })
    : await prisma.assessmentAttempt.findMany({
        where,
        orderBy: [{ submittedAt: "desc" }],
        take: 200,
        select: {
          id: true,
          assessmentId: true,
          assessmentPoolId: true,
          status: true,
          submittedAt: true,
          reviewStartedAt: true,
          gradedAt: true,
          totalMarks: true,
          marksObtained: true,
          percentage: true,
          passed: true,
          overrideMarks: true,
          overridePassed: true,
          overrideReason: true,
          isFinalized: true,
          finalizedAt: true,
          feedbackVisibleToLearner: true,
          requiresManualReview: true,
          learner: {
            select: {
              id: true,
              learnerCode: true,
              fullName: true,
            },
          },
          batch: {
            select: {
              id: true,
              name: true,
            },
          },
          assessmentPool: {
            select: {
              id: true,
              code: true,
              title: true,
              questionType: true,
              difficultyLevel: true,
              trainerAssignments: {
                where: {
                  trainerId: scope.trainerId ?? undefined,
                  isActive: true,
                },
                select: {
                  canReviewSubmissions: true,
                  canManageAttempts: true,
                  canManualGrade: true,
                },
                take: 1,
              },
            },
          },
          reviewedByUser: {
            select: {
              name: true,
            },
          },
          finalizedByUser: {
            select: {
              name: true,
            },
          },
        },
      });

  return attempts.map((attempt) => {
    const assignment = !scope.hasGlobalAccess ? attempt.assessmentPool.trainerAssignments?.[0] ?? null : null;
    const access = scope.hasGlobalAccess
      ? {
          canReviewResponses: true,
          canManageAttempts: true,
          canManualGrade: true,
          isGlobalAccess: true,
        }
      : {
          canReviewResponses: assignment?.canReviewSubmissions ?? false,
          canManageAttempts: assignment?.canManageAttempts ?? false,
          canManualGrade: assignment?.canManualGrade ?? false,
          isGlobalAccess: false,
        };

    return buildQueueItem({
      record: attempt,
      access,
    });
  });
}

export async function getAssessmentReviewDetailService(options: {
  attemptId: string;
  userId: string;
}): Promise<AssessmentReviewDetail | null> {
  if (!isDatabaseConfigured) {
    return null;
  }

  const scope = await resolveAssessmentReviewScope(options.userId);
  const attempt = await prisma.assessmentAttempt.findUnique({
    where: { id: options.attemptId },
    select: {
      id: true,
      assessmentId: true,
      assessmentPoolId: true,
      status: true,
      answers: true,
      gradingReport: true,
      submittedAt: true,
      reviewStartedAt: true,
      gradedAt: true,
      totalMarks: true,
      marksObtained: true,
      percentage: true,
      passed: true,
      overrideMarks: true,
      overridePassed: true,
      overrideReason: true,
      isFinalized: true,
      finalizedAt: true,
      feedbackVisibleToLearner: true,
      requiresManualReview: true,
      reviewerFeedback: true,
      learner: {
        select: {
          id: true,
          learnerCode: true,
          fullName: true,
        },
      },
      batch: {
        select: {
          id: true,
          name: true,
        },
      },
      assessmentPool: {
        select: {
          id: true,
          code: true,
          title: true,
          questionType: true,
          difficultyLevel: true,
          questions: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              questionText: true,
              questionType: true,
              options: true,
              correctAnswer: true,
              isMandatory: true,
              marks: true,
              sortOrder: true,
            },
          },
          trainerAssignments: !scope.hasGlobalAccess && scope.trainerId
            ? {
                where: {
                  trainerId: scope.trainerId,
                  isActive: true,
                },
                select: {
                  canReviewSubmissions: true,
                  canManageAttempts: true,
                  canManualGrade: true,
                },
                take: 1,
              }
            : false,
        },
      },
      reviewedByUser: {
        select: {
          name: true,
        },
      },
      finalizedByUser: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!attempt) {
    return null;
  }

  const assignment = !scope.hasGlobalAccess && scope.trainerId && Array.isArray(attempt.assessmentPool.trainerAssignments)
    ? attempt.assessmentPool.trainerAssignments[0] ?? null
    : null;
  const access = scope.hasGlobalAccess
    ? {
        canReviewResponses: true,
        canManageAttempts: true,
        canManualGrade: true,
        isGlobalAccess: true,
      }
    : {
        canReviewResponses: assignment?.canReviewSubmissions ?? false,
        canManageAttempts: assignment?.canManageAttempts ?? false,
        canManualGrade: assignment?.canManualGrade ?? false,
        isGlobalAccess: false,
      };

  if (!access.canReviewResponses && !access.canManageAttempts && !access.canManualGrade) {
    const directAccess = await resolveAssessmentReviewAccess(options.userId, attempt.assessmentPoolId);
    if (!directAccess.canReviewResponses && !directAccess.canManageAttempts && !directAccess.canManualGrade) {
      return null;
    }
  }

  const queueItem = buildQueueItem({
    record: attempt,
    access,
  });

  return {
    ...queueItem,
    reviewerFeedback: attempt.reviewerFeedback ?? null,
    questions: buildDetailQuestions({
      questions: attempt.assessmentPool.questions,
      answers: parseAssessmentAttemptAnswers(attempt.answers),
      gradingReport: parseAssessmentAttemptGradingReport(attempt.gradingReport),
    }),
  };
}

export async function listAssessmentReviewHistoryService(options: {
  attemptId: string;
  userId: string;
}): Promise<AssessmentReviewHistoryItem[]> {
  if (!isDatabaseConfigured) {
    return [];
  }

  const attempt = await prisma.assessmentAttempt.findUnique({
    where: { id: options.attemptId },
    select: { assessmentPoolId: true },
  });

  if (!attempt) {
    return [];
  }

  const access = await resolveAssessmentReviewAccess(options.userId, attempt.assessmentPoolId);
  if (!access.canReviewResponses && !access.canManageAttempts && !access.canManualGrade) {
    return [];
  }

  const rows = await prisma.assessmentReviewHistory.findMany({
    where: { attemptId: options.attemptId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      eventType: true,
      notes: true,
      scoreBefore: true,
      scoreAfter: true,
      passedBefore: true,
      passedAfter: true,
      createdAt: true,
      actor: {
        select: {
          name: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    eventType: row.eventType,
    notes: row.notes,
    scoreBefore: row.scoreBefore,
    scoreAfter: row.scoreAfter,
    passedBefore: row.passedBefore,
    passedAfter: row.passedAfter,
    createdAt: row.createdAt.toISOString(),
    actorName: row.actor?.name ?? null,
  }));
}