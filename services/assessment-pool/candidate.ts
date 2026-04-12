import "server-only";

import { AssessmentAttemptStatus, AssessmentMode, AssessmentType, EvaluationStatus, Prisma, QuestionType } from "@prisma/client";

import type { GradeSubmissionInput } from "@/lib/validation-schemas/assessment-pool";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { buildCandidateAttemptFeedback, parseCandidateAttemptFeedback } from "@/services/assessment-pool/candidate-attempt-feedback";
import { gradeSubmissionService } from "@/services/assessment-pool/grading";
import {
  sendCandidateAssessmentCompletionNotification,
  sendCandidateAssessmentResultNotification,
} from "@/services/candidate-notifications";
import {
  markCurriculumAssessmentCompletedForLearnerService,
  markCurriculumAssessmentInProgressForLearnerService,
} from "@/services/curriculum/progress";
import { getBatchCourseContext } from "@/services/lms/hierarchy";
import type {
  CandidateAssessmentAttemptSummary,
  CandidateAssessmentDetail,
  CandidateAssessmentQuestion,
  CandidateAssessmentSubmissionResult,
  QuestionDetail,
} from "@/services/assessment-pool/types";
import { recomputeLearnerReadiness } from "@/services/readiness-service";

const SUPPORTED_IN_APP_QUESTION_TYPES = new Set<QuestionType>([
  "MCQ",
  "TRUE_FALSE",
  "NUMERIC",
  "ESSAY",
  "FILL_IN_THE_BLANK",
  "MULTI_INPUT_REASONING",
  "TWO_PART_ANALYSIS",
]);

const FALLBACK_ASSESSMENT_PREFIX = "[BATCH-ASSESSMENT:";

type CandidateAssessmentContext = {
  learnerId: string;
  batchId: string;
  batchMode: "ONLINE" | "OFFLINE";
  programId: string;
  assignmentId: string;
  opensAt: Date | null;
  closesAt: Date | null;
  pool: {
    id: string;
    code: string;
    title: string;
    description: string | null;
    questionType: QuestionType;
    difficultyLevel: "EASY" | "MEDIUM" | "HARD";
    totalMarks: number;
    passingMarks: number;
    timeLimitMinutes: number | null;
  };
  questions: QuestionDetail[];
  linkedAssessmentId: string | null;
  linkedEventType: "TEST" | "QUIZ" | null;
  linkedClassMode: "ONLINE" | "OFFLINE" | null;
  fallbackAssessmentId: string | null;
  attempt: CandidateAssessmentAttemptSummary | null;
  supportsInAppAttempt: boolean;
};

function buildFallbackAssessmentTitle(mappingId: string, title: string) {
  return `${FALLBACK_ASSESSMENT_PREFIX}${mappingId}] ${title}`;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function resolveAssessmentWindow(options: {
  mappedOpensAt: Date | null | undefined;
  linkedOpensAt: Date | null | undefined;
  linkedClosesAt: Date | null | undefined;
  timeLimitMinutes: number | null | undefined;
}) {
  const opensAt = options.linkedOpensAt ?? options.mappedOpensAt ?? null;
  const closesAt = options.linkedClosesAt ?? (opensAt && options.timeLimitMinutes ? addMinutes(opensAt, options.timeLimitMinutes) : null);

  return {
    opensAt,
    closesAt,
  };
}

function buildAttemptSummary(options: {
  assessmentId: string;
  status: CandidateAssessmentAttemptSummary["status"];
  submittedAt: Date;
  gradedAt: Date;
  storedScore: number | null;
  storedFeedback: string | null;
  passingMarks: number;
  totalMarks: number;
  requiresManualReview: boolean;
  passed?: boolean | null;
  marksObtained?: number | null;
}): CandidateAssessmentAttemptSummary {
  const parsedFeedback = parseCandidateAttemptFeedback(options.storedFeedback);
  const fallbackPassedThreshold = options.totalMarks > 0 ? Math.round((options.passingMarks / options.totalMarks) * 100) : 0;
  const resolvedPercentage = parsedFeedback?.percentage ?? options.storedScore;
  const resolvedPassed = parsedFeedback?.passed ?? options.passed ?? (typeof resolvedPercentage === "number" ? resolvedPercentage >= fallbackPassedThreshold : null);

  return {
    assessmentId: options.assessmentId,
    status: options.status,
    percentage: resolvedPercentage,
    passed: resolvedPassed,
    submittedAt: options.submittedAt,
    gradedAt: options.status === "GRADED" ? options.gradedAt : null,
    marksObtained: parsedFeedback?.marksObtained ?? options.marksObtained ?? null,
    totalMarks: parsedFeedback?.totalMarks ?? options.totalMarks,
    requiresManualReview: options.requiresManualReview,
  };
}

function buildAttemptSummaryFromAttempt(options: {
  assessmentId: string;
  status: AssessmentAttemptStatus;
  submittedAt: Date;
  gradedAt: Date | null;
  marksObtained: number | null;
  totalMarks: number;
  percentage: number | null;
  passed: boolean | null;
  requiresManualReview: boolean;
}): CandidateAssessmentAttemptSummary {
  return {
    assessmentId: options.assessmentId,
    status: options.status,
    percentage: options.percentage,
    passed: options.passed,
    submittedAt: options.submittedAt,
    gradedAt: options.gradedAt,
    marksObtained: options.marksObtained,
    totalMarks: options.totalMarks,
    requiresManualReview: options.requiresManualReview,
  };
}

function sanitizeQuestionOptions(question: QuestionDetail): unknown {
  if (question.questionType === "MCQ") {
    return Array.isArray(question.options) ? question.options : [];
  }

  if (question.questionType === "TRUE_FALSE") {
    return [
      { label: "True", value: true },
      { label: "False", value: false },
    ];
  }

  if (question.questionType === "TWO_PART_ANALYSIS") {
    return Array.isArray(question.options) ? question.options : [];
  }

  if (question.questionType === "MULTI_INPUT_REASONING") {
    const fields =
      typeof question.options === "object" &&
      question.options !== null &&
      Array.isArray((question.options as { fields?: Array<{ label?: unknown }> }).fields)
        ? (question.options as { fields: Array<{ label?: unknown }> }).fields
        : [];

    return {
      fields: fields.map((field) => ({
        label: typeof field.label === "string" ? field.label : "",
      })),
    };
  }

  if (question.questionType === "ESSAY") {
    const options = typeof question.options === "object" && question.options !== null
      ? (question.options as { maxWordCount?: unknown })
      : null;

    return {
      maxWordCount: typeof options?.maxWordCount === "number" ? options.maxWordCount : null,
    };
  }

  return question.options ?? null;
}

function sanitizeQuestion(question: QuestionDetail): CandidateAssessmentQuestion {
  return {
    id: question.id,
    questionText: question.questionText,
    questionType: question.questionType,
    options: sanitizeQuestionOptions(question),
    marks: question.marks,
    sortOrder: question.sortOrder,
  };
}

async function resolveCandidateAssessmentContext(userId: string, batchId: string, assessmentPoolId: string): Promise<CandidateAssessmentContext> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const learner = await prisma.learner.findFirst({
    where: {
      userId,
      enrollments: {
        some: {
          batchId,
          status: "ACTIVE",
        },
      },
    },
    select: {
      id: true,
    },
  });

  if (!learner) {
    throw new Error("Assessment not found.");
  }

  const batch = await getBatchCourseContext(batchId);

  if (!batch) {
    throw new Error("Assessment not found.");
  }

  const mapping = await prisma.batchAssessmentMapping.findUnique({
    where: {
      batchId_assessmentPoolId: {
        batchId,
        assessmentPoolId,
      },
    },
    select: {
      id: true,
      scheduledAt: true,
      batch: {
        select: {
          id: true,
          mode: true,
          programId: true,
        },
      },
      assessmentPool: {
        select: {
          id: true,
          code: true,
          title: true,
          description: true,
          questionType: true,
          difficultyLevel: true,
          totalMarks: true,
          passingMarks: true,
          timeLimitMinutes: true,
          status: true,
          questions: {
            orderBy: {
              sortOrder: "asc",
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
          },
        },
      },
    },
  });

  const courseLink = await prisma.courseAssessmentLink.findFirst({
    where: {
      courseId: batch.courseId,
      assessmentPoolId,
      assessmentPool: {
        is: {
          status: "PUBLISHED",
        },
      },
    },
    select: {
      id: true,
      createdAt: true,
      assessmentPool: {
        select: {
          id: true,
          code: true,
          title: true,
          description: true,
          questionType: true,
          difficultyLevel: true,
          totalMarks: true,
          passingMarks: true,
          timeLimitMinutes: true,
          questions: {
            orderBy: {
              sortOrder: "asc",
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
          },
        },
      },
    },
  });

  const pool = mapping?.assessmentPool.status === "PUBLISHED"
    ? mapping.assessmentPool
    : courseLink?.assessmentPool ?? null;

  if (!pool) {
    throw new Error("Assessment not found.");
  }

  const assignmentId = mapping?.id ?? courseLink?.id;

  if (!assignmentId) {
    throw new Error("Assessment not found.");
  }

  const linkedEvent = await prisma.batchScheduleEvent.findFirst({
    where: {
      batchId,
      linkedAssessmentPoolId: assessmentPoolId,
      status: {
        not: "CANCELLED",
      },
    },
    orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
    select: {
      linkedAssessmentId: true,
      type: true,
      classMode: true,
      startsAt: true,
      endsAt: true,
    },
  });

  const { opensAt, closesAt } = resolveAssessmentWindow({
    mappedOpensAt: mapping?.scheduledAt,
    linkedOpensAt: linkedEvent?.startsAt,
    linkedClosesAt: linkedEvent?.endsAt,
    timeLimitMinutes: pool.timeLimitMinutes,
  });
  const fallbackAssessment = !linkedEvent?.linkedAssessmentId
    ? await prisma.assessment.findFirst({
        where: {
          batchId,
          title: buildFallbackAssessmentTitle(assignmentId, pool.title),
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
        },
      })
    : null;

  const assessmentId = linkedEvent?.linkedAssessmentId ?? fallbackAssessment?.id ?? null;
  const score = assessmentId
    ? await prisma.assessmentAttempt.findUnique({
        where: {
          assessmentId_learnerId: {
            assessmentId,
            learnerId: learner.id,
          },
        },
        select: {
          assessmentId: true,
          status: true,
          submittedAt: true,
          gradedAt: true,
          marksObtained: true,
          totalMarks: true,
          percentage: true,
          passed: true,
          requiresManualReview: true,
        },
      })
    : null;

  const legacyScore = assessmentId && !score
    ? await prisma.assessmentScore.findUnique({
        where: {
          assessmentId_learnerId: {
            assessmentId,
            learnerId: learner.id,
          },
        },
        select: {
          assessmentId: true,
          score: true,
          feedback: true,
          gradedAt: true,
        },
      })
    : null;

  return {
    learnerId: learner.id,
    batchId,
    batchMode: batch.batchMode,
    programId: batch.programId,
    assignmentId,
    opensAt,
    closesAt,
    pool: {
      id: pool.id,
      code: pool.code,
      title: pool.title,
      description: pool.description,
      questionType: pool.questionType,
      difficultyLevel: pool.difficultyLevel,
      totalMarks: pool.totalMarks,
      passingMarks: pool.passingMarks,
      timeLimitMinutes: pool.timeLimitMinutes,
    },
    questions: pool.questions as QuestionDetail[],
    linkedAssessmentId: linkedEvent?.linkedAssessmentId ?? null,
    linkedEventType: linkedEvent?.type === "TEST" || linkedEvent?.type === "QUIZ" ? linkedEvent.type : null,
    linkedClassMode: linkedEvent?.classMode ?? null,
    fallbackAssessmentId: fallbackAssessment?.id ?? null,
    attempt: score
      ? buildAttemptSummaryFromAttempt({
          assessmentId: score.assessmentId,
          status: score.status,
          submittedAt: score.submittedAt,
          gradedAt: score.gradedAt,
          marksObtained: score.marksObtained,
          totalMarks: score.totalMarks,
          percentage: score.percentage,
          passed: score.passed,
          requiresManualReview: score.requiresManualReview,
        })
      : legacyScore
      ? buildAttemptSummary({
          assessmentId: legacyScore.assessmentId,
          status: "GRADED",
          submittedAt: legacyScore.gradedAt,
          gradedAt: legacyScore.gradedAt,
          storedScore: legacyScore.score,
          storedFeedback: legacyScore.feedback,
          passingMarks: pool.passingMarks,
          totalMarks: pool.totalMarks,
          requiresManualReview: false,
        })
      : null,
    supportsInAppAttempt: pool.questions.every((question) => SUPPORTED_IN_APP_QUESTION_TYPES.has(question.questionType)),
  };
}

function getAvailabilityMessage(context: CandidateAssessmentContext, now: number) {
  if (!context.supportsInAppAttempt) {
    return "This assessment includes question types that are not supported in the candidate app yet.";
  }

  if (!context.opensAt) {
    return "This assessment is mapped to your batch, but its start time has not been published yet.";
  }

  if (context.opensAt.getTime() > now) {
    return "This assessment will unlock once the scheduled start time has been crossed.";
  }

  if (context.closesAt && context.closesAt.getTime() < now) {
    return "This assessment window has already closed.";
  }

  return null;
}

export async function getCandidateAssessmentDetailService(options: {
  userId: string;
  batchId: string;
  assessmentPoolId: string;
}): Promise<CandidateAssessmentDetail> {
  const context = await resolveCandidateAssessmentContext(options.userId, options.batchId, options.assessmentPoolId);
  const now = Date.now();
  const isClosed = Boolean(context.closesAt && context.closesAt.getTime() < now);
  const isOpen = Boolean(context.opensAt && context.opensAt.getTime() <= now && !isClosed);

  if (isOpen && context.supportsInAppAttempt && !context.attempt) {
    try {
      await markCurriculumAssessmentInProgressForLearnerService({
        learnerId: context.learnerId,
        batchId: context.batchId,
        assessmentPoolId: context.pool.id,
      });
    } catch (error) {
      console.warn("Candidate assessment detail loaded, but curriculum progress sync failed", error);
    }
  }

  return {
    batchId: context.batchId,
    assessmentPoolId: context.pool.id,
    mappingId: context.assignmentId,
    assessmentTitle: context.pool.title,
    assessmentCode: context.pool.code,
    description: context.pool.description,
    questionType: context.pool.questionType,
    difficultyLevel: context.pool.difficultyLevel,
    totalMarks: context.pool.totalMarks,
    passingMarks: context.pool.passingMarks,
    timeLimitMinutes: context.pool.timeLimitMinutes,
    scheduledAt: context.opensAt,
    opensAt: context.opensAt,
    closesAt: context.closesAt,
    isOpen,
    isClosed,
    supportsInAppAttempt: context.supportsInAppAttempt,
    availabilityMessage: getAvailabilityMessage(context, now),
    questionCount: context.questions.length,
    questions: isOpen && context.supportsInAppAttempt && !context.attempt ? context.questions.map(sanitizeQuestion) : [],
    attempt: context.attempt,
  };
}

function resolveAssessmentTypeFromEventType(eventType: "TEST" | "QUIZ" | null) {
  if (eventType === "QUIZ") {
    return AssessmentType.DIAGNOSTIC;
  }

  return AssessmentType.MODULE;
}

function resolveAssessmentMode(batchMode: "ONLINE" | "OFFLINE", classMode: "ONLINE" | "OFFLINE" | null) {
  if (classMode === "ONLINE" || batchMode === "ONLINE") {
    return AssessmentMode.ONLINE;
  }

  return AssessmentMode.PAPER_BASED;
}

export async function submitCandidateAssessmentService(options: {
  userId: string;
  batchId: string;
  assessmentPoolId: string;
  answers: GradeSubmissionInput["answers"];
}): Promise<CandidateAssessmentSubmissionResult> {
  const context = await resolveCandidateAssessmentContext(options.userId, options.batchId, options.assessmentPoolId);

  if (context.attempt) {
    throw new Error("Assessment already submitted.");
  }

  if (!context.supportsInAppAttempt) {
    throw new Error("Invalid request: this assessment cannot be submitted in the app yet.");
  }

  if (!context.opensAt) {
    throw new Error("Invalid request: assessment start time has not been published yet.");
  }

  if (context.opensAt.getTime() > Date.now()) {
    throw new Error("Invalid request: assessment is not open yet.");
  }

  if (context.closesAt && context.closesAt.getTime() < Date.now()) {
    throw new Error("Invalid request: assessment window has closed.");
  }

  const report = await gradeSubmissionService(
    options.assessmentPoolId,
    options.answers.map((answer) => ({
      questionId: answer.questionId,
      answer: answer.answer ?? null,
    })),
  );

  const fallbackTitle = buildFallbackAssessmentTitle(context.assignmentId, context.pool.title);
  const submittedAt = new Date();
  const feedback = buildCandidateAttemptFeedback(report);

  try {
    const { assessmentId, attempt } = await prisma.$transaction(async (tx) => {
      let resolvedAssessmentId = context.linkedAssessmentId ?? context.fallbackAssessmentId;

      if (!resolvedAssessmentId) {
        const existingFallback = await tx.assessment.findFirst({
          where: {
            batchId: context.batchId,
            title: fallbackTitle,
          },
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
          },
        });

        resolvedAssessmentId = existingFallback?.id ?? null;
      }

      if (!resolvedAssessmentId) {
        const createdAssessment = await tx.assessment.create({
          data: {
            title: fallbackTitle,
            type: resolveAssessmentTypeFromEventType(context.linkedEventType),
            mode: resolveAssessmentMode(context.batchMode, context.linkedClassMode),
            status: EvaluationStatus.SCHEDULED,
            batchId: context.batchId,
            programId: context.programId,
            scheduledAt: context.opensAt,
          },
          select: {
            id: true,
          },
        });

        resolvedAssessmentId = createdAssessment.id;
      }

      const existingAttempt = await tx.assessmentAttempt.findUnique({
        where: {
          assessmentId_learnerId: {
            assessmentId: resolvedAssessmentId,
            learnerId: context.learnerId,
          },
        },
        select: {
          assessmentId: true,
        },
      });

      if (existingAttempt) {
        throw new Error("Assessment already submitted.");
      }

      const attempt = await tx.assessmentAttempt.create({
        data: {
          assessmentId: resolvedAssessmentId,
          assessmentPoolId: context.pool.id,
          learnerId: context.learnerId,
          batchId: context.batchId,
          status: report.requiresManualReview ? AssessmentAttemptStatus.PENDING_REVIEW : AssessmentAttemptStatus.GRADED,
          answers: options.answers as Prisma.InputJsonValue,
          gradingReport: report as Prisma.InputJsonValue,
          requiresManualReview: report.requiresManualReview,
          marksObtained: report.requiresManualReview ? null : report.marksObtained,
          totalMarks: report.totalMarks,
          percentage: report.requiresManualReview ? null : report.percentage,
          passed: report.requiresManualReview ? null : report.passed,
          submittedAt,
          gradedAt: report.requiresManualReview ? null : submittedAt,
        },
        select: {
          id: true,
          assessmentId: true,
          status: true,
          submittedAt: true,
          gradedAt: true,
          marksObtained: true,
          totalMarks: true,
          percentage: true,
          passed: true,
          requiresManualReview: true,
        },
      });

      if (!report.requiresManualReview) {
        await tx.assessmentScore.create({
          data: {
            assessmentId: resolvedAssessmentId,
            learnerId: context.learnerId,
            score: report.percentage,
            feedback,
            gradedAt: submittedAt,
          },
        });
      }

      return {
        assessmentId: resolvedAssessmentId,
        attempt,
      };
    });

    if (report.requiresManualReview) {
      try {
        await markCurriculumAssessmentInProgressForLearnerService({
          learnerId: context.learnerId,
          batchId: context.batchId,
          assessmentPoolId: context.pool.id,
        });
      } catch (error) {
        console.warn("Candidate assessment submission saved, but curriculum in-progress sync failed", error);
      }
    } else {
      try {
        await markCurriculumAssessmentCompletedForLearnerService({
          learnerId: context.learnerId,
          batchId: context.batchId,
          assessmentPoolId: context.pool.id,
        });
      } catch (error) {
        console.warn("Candidate assessment submission saved, but curriculum completion sync failed", error);
      }

      try {
        await recomputeLearnerReadiness(context.learnerId);
      } catch (error) {
        console.warn("Candidate assessment submission saved, but readiness recomputation failed", error);
      }
    }

    try {
      const notificationSummary = await sendCandidateAssessmentCompletionNotification({
        learnerId: context.learnerId,
        batchId: context.batchId,
        assessmentTitle: context.pool.title,
        submittedAt,
        requiresManualReview: report.requiresManualReview,
      });

      if (notificationSummary.failedCount > 0) {
        console.warn("Candidate assessment completion email partially failed.", notificationSummary);
      }
    } catch (error) {
      console.warn("Candidate assessment completion email dispatch failed.", error);
    }

    if (!report.requiresManualReview) {
      try {
        const notificationSummary = await sendCandidateAssessmentResultNotification({
          attemptId: attempt.id,
          reviewerNameFallback: "System auto-evaluation",
        });

        if (notificationSummary.failedCount > 0) {
          console.warn("Candidate assessment result email partially failed.", notificationSummary);
        }
      } catch (error) {
        console.warn("Candidate assessment result email dispatch failed.", error);
      }
    }

    return {
      batchId: context.batchId,
      assessmentPoolId: context.pool.id,
      attempt: report.requiresManualReview
        ? buildAttemptSummaryFromAttempt({
            assessmentId: attempt.assessmentId,
            status: attempt.status,
            submittedAt: attempt.submittedAt,
            gradedAt: attempt.gradedAt,
            marksObtained: attempt.marksObtained,
            totalMarks: attempt.totalMarks,
            percentage: attempt.percentage,
            passed: attempt.passed,
            requiresManualReview: attempt.requiresManualReview,
          })
        : buildAttemptSummary({
            assessmentId,
            status: "GRADED",
            submittedAt,
            gradedAt: submittedAt,
            storedScore: report.percentage,
            storedFeedback: feedback,
            passingMarks: context.pool.passingMarks,
            totalMarks: context.pool.totalMarks,
            requiresManualReview: false,
          }),
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("Assessment already submitted.");
    }

    throw error;
  }
}