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
  buildCandidateCurriculumAssessmentContextMap,
  getCandidateCurriculaForBatchService,
  markCurriculumAssessmentCompletedForLearnerService,
  markCurriculumAssessmentInProgressForLearnerService,
  resolveCandidateAssessmentWindow,
  selectRelevantLinkedAssessmentEvent,
  type CandidateAssessmentDeadlineSource,
  type CandidateCurriculumAssessmentContext,
} from "@/services/curriculum-service";
import { parseAssessmentAttemptAnswers } from "@/services/assessment-reviews/internal";
import { getBatchCourseContext } from "@/services/lms/hierarchy";
import type {
  CandidateAssessmentAttemptSummary,
  CandidateAssessmentDraftSaveResult,
  CandidateAssessmentDetail,
  CandidateAssessmentQuestion,
  CandidateAssessmentSavedAnswer,
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
const DRAFT_FINALIZATION_TOLERANCE_MS = 30_000;

type ResolvedAttemptRecord = {
  id: string;
  assessmentId: string;
  status: AssessmentAttemptStatus;
  answers: Prisma.JsonValue;
  submittedAt: Date;
  startedAt: Date;
  lastSavedAt: Date;
  deadlineAt: Date | null;
  autoSubmittedAt: Date | null;
  gradedAt: Date | null;
  marksObtained: number | null;
  totalMarks: number;
  percentage: number | null;
  passed: boolean | null;
  requiresManualReview: boolean;
};

type CandidateAssessmentContext = {
  learnerId: string;
  batchId: string;
  batchMode: "ONLINE" | "OFFLINE";
  programId: string;
  assignmentId: string;
  scheduledAt: Date | null;
  opensAt: Date | null;
  hardClosesAt: Date | null;
  closesAt: Date | null;
  deadlineSource: CandidateAssessmentDeadlineSource;
  curriculumContext: CandidateCurriculumAssessmentContext | null;
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
  attemptRecord: ResolvedAttemptRecord | null;
  attempt: CandidateAssessmentAttemptSummary | null;
  supportsInAppAttempt: boolean;
};

function buildFallbackAssessmentTitle(mappingId: string, title: string) {
  return `${FALLBACK_ASSESSMENT_PREFIX}${mappingId}] ${title}`;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function resolveAttemptDeadline(options: {
  startedAt: Date;
  timeLimitMinutes: number | null;
  closesAt: Date | null;
  closesAtSource: CandidateAssessmentDeadlineSource;
}) {
  const timedDeadline = options.timeLimitMinutes ? addMinutes(options.startedAt, options.timeLimitMinutes) : null;

  if (timedDeadline && options.closesAt) {
    return timedDeadline.getTime() < options.closesAt.getTime()
      ? { deadlineAt: timedDeadline, deadlineSource: "TIME_LIMIT" as const }
      : { deadlineAt: options.closesAt, deadlineSource: options.closesAtSource };
  }

  if (timedDeadline) {
    return { deadlineAt: timedDeadline, deadlineSource: "TIME_LIMIT" as const };
  }

  return {
    deadlineAt: options.closesAt,
    deadlineSource: options.closesAt ? options.closesAtSource : "NONE",
  };
}

function isPastDeadline(deadlineAt: Date | null, now: number) {
  return Boolean(deadlineAt && deadlineAt.getTime() < now);
}

function buildAttemptSummary(options: {
  assessmentId: string;
  status: CandidateAssessmentAttemptSummary["status"];
  startedAt: Date;
  lastSavedAt: Date;
  deadlineAt: Date | null;
  autoSubmittedAt: Date | null;
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
    startedAt: options.startedAt,
    lastSavedAt: options.lastSavedAt,
    deadlineAt: options.deadlineAt,
    autoSubmittedAt: options.autoSubmittedAt,
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
  startedAt: Date;
  lastSavedAt: Date;
  deadlineAt: Date | null;
  autoSubmittedAt: Date | null;
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
    startedAt: options.startedAt,
    lastSavedAt: options.lastSavedAt,
    deadlineAt: options.deadlineAt,
    autoSubmittedAt: options.autoSubmittedAt,
    submittedAt: options.submittedAt,
    gradedAt: options.gradedAt,
    marksObtained: options.marksObtained,
    totalMarks: options.totalMarks,
    requiresManualReview: options.requiresManualReview,
  };
}

function normalizeCandidateAnswers(
  answers: GradeSubmissionInput["answers"],
  validQuestionIds: Set<string>,
): CandidateAssessmentSavedAnswer[] {
  const answerMap = new Map<string, unknown>();

  for (const item of answers) {
    const questionId = item.questionId.trim();
    if (!questionId || !validQuestionIds.has(questionId)) {
      continue;
    }

    answerMap.set(questionId, item.answer ?? null);
  }

  return Array.from(answerMap.entries()).map(([questionId, answer]) => ({ questionId, answer }));
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

function getDraftSavedAnswers(attemptRecord: ResolvedAttemptRecord | null) {
  return attemptRecord?.status === AssessmentAttemptStatus.DRAFT ? parseAssessmentAttemptAnswers(attemptRecord.answers) : [];
}

function resolveAvailabilityStatus(context: CandidateAssessmentContext, now: number): CandidateAssessmentDetail["availabilityStatus"] {
  if (context.attempt?.autoSubmittedAt) {
    return "EXPIRED";
  }

  if (context.curriculumContext?.availabilityStatus === "LOCKED") {
    return "LOCKED";
  }

  if (!context.opensAt || context.opensAt.getTime() > now) {
    return "SCHEDULED";
  }

  if (context.attemptRecord?.status === AssessmentAttemptStatus.DRAFT && isPastDeadline(context.attemptRecord.deadlineAt, now)) {
    return "EXPIRED";
  }

  if (context.closesAt && context.closesAt.getTime() < now) {
    return "CLOSED";
  }

  return "OPEN";
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

  const [mapping, courseLink, linkedEvents, curriculumWorkspace] = await Promise.all([
    prisma.batchAssessmentMapping.findUnique({
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
    }),
    prisma.courseAssessmentLink.findFirst({
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
    }),
    prisma.batchScheduleEvent.findMany({
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
    }),
    getCandidateCurriculaForBatchService({
      batchId,
      learnerId: learner.id,
    }),
  ]);

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

  const curriculumContext = buildCandidateCurriculumAssessmentContextMap(curriculumWorkspace).get(assessmentPoolId) ?? null;
  const linkedEvent = selectRelevantLinkedAssessmentEvent(linkedEvents);
  const resolvedWindow = resolveCandidateAssessmentWindow({
    mappedOpensAt: mapping?.scheduledAt,
    linkedOpensAt: linkedEvent?.startsAt,
    linkedClosesAt: linkedEvent?.endsAt,
    curriculumUnlockAt: curriculumContext?.unlockAt,
    curriculumDueAt: curriculumContext?.dueAt,
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
  const attemptRecord = assessmentId
    ? await prisma.assessmentAttempt.findUnique({
        where: {
          assessmentId_learnerId: {
            assessmentId,
            learnerId: learner.id,
          },
        },
        select: {
          id: true,
          assessmentId: true,
          status: true,
          answers: true,
          startedAt: true,
          lastSavedAt: true,
          deadlineAt: true,
          autoSubmittedAt: true,
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

  const legacyScore = assessmentId && !attemptRecord
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
    scheduledAt: resolvedWindow.scheduledAt,
    opensAt: resolvedWindow.opensAt,
    hardClosesAt: resolvedWindow.hardClosesAt,
    closesAt: resolvedWindow.closesAt,
    deadlineSource: resolvedWindow.deadlineSource,
    curriculumContext,
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
    attemptRecord,
    attempt: attemptRecord
      ? buildAttemptSummaryFromAttempt({
          assessmentId: attemptRecord.assessmentId,
          status: attemptRecord.status,
          startedAt: attemptRecord.startedAt,
          lastSavedAt: attemptRecord.lastSavedAt,
          deadlineAt: attemptRecord.deadlineAt,
          autoSubmittedAt: attemptRecord.autoSubmittedAt,
          submittedAt: attemptRecord.submittedAt,
          gradedAt: attemptRecord.gradedAt,
          marksObtained: attemptRecord.marksObtained,
          totalMarks: attemptRecord.totalMarks,
          percentage: attemptRecord.percentage,
          passed: attemptRecord.passed,
          requiresManualReview: attemptRecord.requiresManualReview,
        })
      : legacyScore
      ? buildAttemptSummary({
          assessmentId: legacyScore.assessmentId,
          status: "GRADED",
          startedAt: legacyScore.gradedAt,
          lastSavedAt: legacyScore.gradedAt,
          deadlineAt: null,
          autoSubmittedAt: null,
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
  if (context.attempt?.autoSubmittedAt) {
    return "Time expired and your saved answers were submitted automatically.";
  }

  if (context.curriculumContext?.availabilityStatus === "LOCKED") {
    return context.curriculumContext.availabilityReason.message;
  }

  if (!context.supportsInAppAttempt) {
    return "This assessment includes question types that are not supported in the candidate app yet.";
  }

  if (!context.opensAt) {
    return context.curriculumContext?.availabilityReason.message ?? "This assessment is mapped to your batch, but its start time has not been published yet.";
  }

  if (context.opensAt.getTime() > now) {
    return context.curriculumContext?.availabilityReason.message ?? "This assessment will unlock once the scheduled start time has been crossed.";
  }

  if (context.closesAt && context.closesAt.getTime() < now) {
    return context.deadlineSource === "CURRICULUM_DUE"
      ? "The curriculum deadline for this assessment has already passed."
      : "This assessment window has already closed.";
  }

  return null;
}

export async function getCandidateAssessmentDetailService(options: {
  userId: string;
  batchId: string;
  assessmentPoolId: string;
}): Promise<CandidateAssessmentDetail> {
  let context = await resolveCandidateAssessmentContext(options.userId, options.batchId, options.assessmentPoolId);
  let now = Date.now();

  if (context.attemptRecord?.status === AssessmentAttemptStatus.DRAFT && isPastDeadline(context.attemptRecord.deadlineAt, now)) {
    await finalizeCandidateAssessmentAttemptService({
      userId: options.userId,
      batchId: options.batchId,
      assessmentPoolId: options.assessmentPoolId,
      autoSubmit: true,
      resolvedContext: context,
    });

    context = await resolveCandidateAssessmentContext(options.userId, options.batchId, options.assessmentPoolId);
    now = Date.now();
  }

  const availabilityStatus = resolveAvailabilityStatus(context, now);
  const hasFinalAttempt = Boolean(context.attempt && context.attempt.status !== AssessmentAttemptStatus.DRAFT);
  const isClosed = availabilityStatus === "CLOSED" || availabilityStatus === "EXPIRED" || availabilityStatus === "LOCKED";
  const isOpen = availabilityStatus === "OPEN";
  const draftDeadline = context.attemptRecord?.status === AssessmentAttemptStatus.DRAFT
    ? resolveAttemptDeadline({
        startedAt: context.attemptRecord.startedAt,
        timeLimitMinutes: context.pool.timeLimitMinutes,
        closesAt: context.closesAt,
        closesAtSource: context.deadlineSource,
      })
    : { deadlineAt: null, deadlineSource: "NONE" as const };

  if (isOpen && context.supportsInAppAttempt && !hasFinalAttempt) {
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
    serverNow: new Date(now),
    scheduledAt: context.scheduledAt,
    opensAt: context.opensAt,
    hardClosesAt: context.hardClosesAt,
    closesAt: context.closesAt,
    deadlineSource: context.deadlineSource,
    attemptDeadlineAt: context.attemptRecord?.status === AssessmentAttemptStatus.DRAFT ? context.attemptRecord.deadlineAt : null,
    attemptDeadlineSource: draftDeadline.deadlineSource,
    curriculumContext: context.curriculumContext,
    availabilityStatus,
    isOpen,
    isClosed,
    supportsInAppAttempt: context.supportsInAppAttempt,
    availabilityMessage: getAvailabilityMessage(context, now),
    questionCount: context.questions.length,
    questions:
      context.supportsInAppAttempt && !hasFinalAttempt && (isOpen || context.attempt?.status === AssessmentAttemptStatus.DRAFT)
        ? context.questions.map(sanitizeQuestion)
        : [],
    savedAnswers: getDraftSavedAnswers(context.attemptRecord),
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

async function resolveAssessmentIdForContext(tx: Prisma.TransactionClient, context: CandidateAssessmentContext) {
  let resolvedAssessmentId = context.attemptRecord?.assessmentId ?? context.linkedAssessmentId ?? context.fallbackAssessmentId;

  if (!resolvedAssessmentId) {
    const fallbackTitle = buildFallbackAssessmentTitle(context.assignmentId, context.pool.title);
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
        title: buildFallbackAssessmentTitle(context.assignmentId, context.pool.title),
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

  return resolvedAssessmentId;
}

async function runCandidateSubmissionSideEffects(options: {
  context: CandidateAssessmentContext;
  submittedAt: Date;
  attemptId: string;
  requiresManualReview: boolean;
}) {
  if (options.requiresManualReview) {
    try {
      await markCurriculumAssessmentInProgressForLearnerService({
        learnerId: options.context.learnerId,
        batchId: options.context.batchId,
        assessmentPoolId: options.context.pool.id,
      });
    } catch (error) {
      console.warn("Candidate assessment submission saved, but curriculum in-progress sync failed", error);
    }
  } else {
    try {
      await markCurriculumAssessmentCompletedForLearnerService({
        learnerId: options.context.learnerId,
        batchId: options.context.batchId,
        assessmentPoolId: options.context.pool.id,
      });
    } catch (error) {
      console.warn("Candidate assessment submission saved, but curriculum completion sync failed", error);
    }

    try {
      await recomputeLearnerReadiness(options.context.learnerId);
    } catch (error) {
      console.warn("Candidate assessment submission saved, but readiness recomputation failed", error);
    }
  }

  try {
    const notificationSummary = await sendCandidateAssessmentCompletionNotification({
      learnerId: options.context.learnerId,
      batchId: options.context.batchId,
      assessmentTitle: options.context.pool.title,
      submittedAt: options.submittedAt,
      requiresManualReview: options.requiresManualReview,
    });

    if (notificationSummary.failedCount > 0) {
      console.warn("Candidate assessment completion email partially failed.", notificationSummary);
    }
  } catch (error) {
    console.warn("Candidate assessment completion email dispatch failed.", error);
  }

  if (!options.requiresManualReview) {
    try {
      const notificationSummary = await sendCandidateAssessmentResultNotification({
        attemptId: options.attemptId,
        reviewerNameFallback: "System auto-evaluation",
      });

      if (notificationSummary.failedCount > 0) {
        console.warn("Candidate assessment result email partially failed.", notificationSummary);
      }
    } catch (error) {
      console.warn("Candidate assessment result email dispatch failed.", error);
    }
  }
}

async function finalizeCandidateAssessmentAttemptService(options: {
  userId: string;
  batchId: string;
  assessmentPoolId: string;
  answers?: GradeSubmissionInput["answers"];
  autoSubmit?: boolean;
  resolvedContext?: CandidateAssessmentContext;
}): Promise<CandidateAssessmentSubmissionResult> {
  const context = options.resolvedContext ?? await resolveCandidateAssessmentContext(options.userId, options.batchId, options.assessmentPoolId);
  const existingDraft = context.attemptRecord?.status === AssessmentAttemptStatus.DRAFT ? context.attemptRecord : null;
  const hasFinalAttempt = Boolean(context.attempt && context.attempt.status !== AssessmentAttemptStatus.DRAFT);

  if (hasFinalAttempt) {
    throw new Error("Assessment already submitted.");
  }

  if (!context.supportsInAppAttempt) {
    throw new Error("Invalid request: this assessment cannot be submitted in the app yet.");
  }

  if (!existingDraft && context.curriculumContext?.availabilityStatus === "LOCKED") {
    throw new Error(context.curriculumContext.availabilityReason.message);
  }

  if (!context.opensAt) {
    throw new Error("Invalid request: assessment start time has not been published yet.");
  }

  const now = new Date();
  if (context.opensAt.getTime() > now.getTime()) {
    throw new Error("Invalid request: assessment is not open yet.");
  }

  const startedAt = existingDraft?.startedAt ?? now;
  const resolvedDeadline = existingDraft?.deadlineAt
    ? {
        deadlineAt: existingDraft.deadlineAt,
        deadlineSource: resolveAttemptDeadline({
          startedAt,
          timeLimitMinutes: context.pool.timeLimitMinutes,
          closesAt: context.closesAt,
          closesAtSource: context.deadlineSource,
        }).deadlineSource,
      }
    : resolveAttemptDeadline({
        startedAt,
        timeLimitMinutes: context.pool.timeLimitMinutes,
        closesAt: context.closesAt,
        closesAtSource: context.deadlineSource,
      });
  const deadlineAt = resolvedDeadline.deadlineAt;

  if (
    deadlineAt
    && deadlineAt.getTime() + DRAFT_FINALIZATION_TOLERANCE_MS < now.getTime()
    && !(options.autoSubmit && existingDraft)
  ) {
    throw new Error("Invalid request: assessment window has closed.");
  }

  const validQuestionIds = new Set(context.questions.map((question) => question.id));
  const sourceAnswers = options.answers ?? (existingDraft ? parseAssessmentAttemptAnswers(existingDraft.answers) : []);
  const normalizedAnswers = normalizeCandidateAnswers(sourceAnswers, validQuestionIds);
  const report = await gradeSubmissionService(
    context.pool.id,
    normalizedAnswers.map((answer) => ({
      questionId: answer.questionId,
      answer: answer.answer ?? null,
    })),
  );
  const submittedAt = new Date();
  const feedback = buildCandidateAttemptFeedback(report);

  try {
    const { attempt } = await prisma.$transaction(async (tx) => {
      const resolvedAssessmentId = await resolveAssessmentIdForContext(tx, context);

      if (!existingDraft) {
        const existingAttempt = await tx.assessmentAttempt.findUnique({
          where: {
            assessmentId_learnerId: {
              assessmentId: resolvedAssessmentId,
              learnerId: context.learnerId,
            },
          },
          select: {
            id: true,
            status: true,
          },
        });

        if (existingAttempt && existingAttempt.status !== AssessmentAttemptStatus.DRAFT) {
          throw new Error("Assessment already submitted.");
        }
      }

      const attempt = existingDraft
        ? await tx.assessmentAttempt.update({
            where: {
              id: existingDraft.id,
            },
            data: {
              status: report.requiresManualReview ? AssessmentAttemptStatus.PENDING_REVIEW : AssessmentAttemptStatus.GRADED,
              answers: normalizedAnswers as Prisma.InputJsonValue,
              gradingReport: report as Prisma.InputJsonValue,
              requiresManualReview: report.requiresManualReview,
              marksObtained: report.requiresManualReview ? null : report.marksObtained,
              totalMarks: report.totalMarks,
              percentage: report.requiresManualReview ? null : report.percentage,
              passed: report.requiresManualReview ? null : report.passed,
              lastSavedAt: submittedAt,
              submittedAt,
              gradedAt: report.requiresManualReview ? null : submittedAt,
              autoSubmittedAt: options.autoSubmit ? submittedAt : null,
            },
            select: {
              id: true,
              assessmentId: true,
              status: true,
              startedAt: true,
              lastSavedAt: true,
              deadlineAt: true,
              autoSubmittedAt: true,
              submittedAt: true,
              gradedAt: true,
              marksObtained: true,
              totalMarks: true,
              percentage: true,
              passed: true,
              requiresManualReview: true,
            },
          })
        : await tx.assessmentAttempt.create({
            data: {
              assessmentId: resolvedAssessmentId,
              assessmentPoolId: context.pool.id,
              learnerId: context.learnerId,
              batchId: context.batchId,
              status: report.requiresManualReview ? AssessmentAttemptStatus.PENDING_REVIEW : AssessmentAttemptStatus.GRADED,
              answers: normalizedAnswers as Prisma.InputJsonValue,
              gradingReport: report as Prisma.InputJsonValue,
              requiresManualReview: report.requiresManualReview,
              marksObtained: report.requiresManualReview ? null : report.marksObtained,
              totalMarks: report.totalMarks,
              percentage: report.requiresManualReview ? null : report.percentage,
              passed: report.requiresManualReview ? null : report.passed,
              startedAt,
              lastSavedAt: submittedAt,
              deadlineAt,
              autoSubmittedAt: options.autoSubmit ? submittedAt : null,
              submittedAt,
              gradedAt: report.requiresManualReview ? null : submittedAt,
            },
            select: {
              id: true,
              assessmentId: true,
              status: true,
              startedAt: true,
              lastSavedAt: true,
              deadlineAt: true,
              autoSubmittedAt: true,
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
        await tx.assessmentScore.upsert({
          where: {
            assessmentId_learnerId: {
              assessmentId: attempt.assessmentId,
              learnerId: context.learnerId,
            },
          },
          update: {
            score: report.percentage,
            feedback,
            gradedAt: submittedAt,
          },
          create: {
            assessmentId: attempt.assessmentId,
            learnerId: context.learnerId,
            score: report.percentage,
            feedback,
            gradedAt: submittedAt,
          },
        });
      }

      return { attempt };
    });

    await runCandidateSubmissionSideEffects({
      context,
      submittedAt,
      attemptId: attempt.id,
      requiresManualReview: report.requiresManualReview,
    });

    return {
      batchId: context.batchId,
      assessmentPoolId: context.pool.id,
      attempt: buildAttemptSummaryFromAttempt({
        assessmentId: attempt.assessmentId,
        status: attempt.status,
        startedAt: attempt.startedAt,
        lastSavedAt: attempt.lastSavedAt,
        deadlineAt: attempt.deadlineAt,
        autoSubmittedAt: attempt.autoSubmittedAt,
        submittedAt: attempt.submittedAt,
        gradedAt: attempt.gradedAt,
        marksObtained: attempt.marksObtained,
        totalMarks: attempt.totalMarks,
        percentage: attempt.percentage,
        passed: attempt.passed,
        requiresManualReview: attempt.requiresManualReview,
      }),
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("Assessment already submitted.");
    }

    throw error;
  }
}

export async function saveCandidateAssessmentDraftService(options: {
  userId: string;
  batchId: string;
  assessmentPoolId: string;
  answers: GradeSubmissionInput["answers"];
}): Promise<CandidateAssessmentDraftSaveResult> {
  const context = await resolveCandidateAssessmentContext(options.userId, options.batchId, options.assessmentPoolId);
  const hasFinalAttempt = Boolean(context.attempt && context.attempt.status !== AssessmentAttemptStatus.DRAFT);

  if (hasFinalAttempt) {
    throw new Error("Assessment already submitted.");
  }

  if (!context.supportsInAppAttempt) {
    throw new Error("Invalid request: this assessment cannot be saved in the app yet.");
  }

  if (context.curriculumContext?.availabilityStatus === "LOCKED" && context.attemptRecord?.status !== AssessmentAttemptStatus.DRAFT) {
    throw new Error(context.curriculumContext.availabilityReason.message);
  }

  if (!context.opensAt) {
    throw new Error("Invalid request: assessment start time has not been published yet.");
  }

  const now = new Date();
  if (context.opensAt.getTime() > now.getTime()) {
    throw new Error("Invalid request: assessment is not open yet.");
  }

  const startedAt = context.attemptRecord?.status === AssessmentAttemptStatus.DRAFT ? context.attemptRecord.startedAt : now;
  const resolvedDeadline = context.attemptRecord?.status === AssessmentAttemptStatus.DRAFT && context.attemptRecord.deadlineAt
    ? {
        deadlineAt: context.attemptRecord.deadlineAt,
        deadlineSource: resolveAttemptDeadline({
          startedAt,
          timeLimitMinutes: context.pool.timeLimitMinutes,
          closesAt: context.closesAt,
          closesAtSource: context.deadlineSource,
        }).deadlineSource,
      }
    : resolveAttemptDeadline({
        startedAt,
        timeLimitMinutes: context.pool.timeLimitMinutes,
        closesAt: context.closesAt,
        closesAtSource: context.deadlineSource,
      });
  const deadlineAt = resolvedDeadline.deadlineAt;

  if (deadlineAt && deadlineAt.getTime() + DRAFT_FINALIZATION_TOLERANCE_MS < now.getTime()) {
    throw new Error("Invalid request: assessment time has expired.");
  }

  const validQuestionIds = new Set(context.questions.map((question) => question.id));
  const normalizedAnswers = normalizeCandidateAnswers(options.answers, validQuestionIds);

  const attempt = await prisma.$transaction(async (tx) => {
    const resolvedAssessmentId = await resolveAssessmentIdForContext(tx, context);
    const existingAttempt = context.attemptRecord?.status === AssessmentAttemptStatus.DRAFT
      ? context.attemptRecord
      : await tx.assessmentAttempt.findUnique({
          where: {
            assessmentId_learnerId: {
              assessmentId: resolvedAssessmentId,
              learnerId: context.learnerId,
            },
          },
          select: {
            id: true,
            status: true,
            assessmentId: true,
            startedAt: true,
            deadlineAt: true,
          },
        });

    if (existingAttempt && existingAttempt.status !== AssessmentAttemptStatus.DRAFT) {
      throw new Error("Assessment already submitted.");
    }

    return existingAttempt
      ? tx.assessmentAttempt.update({
          where: {
            id: existingAttempt.id,
          },
          data: {
            answers: normalizedAnswers as Prisma.InputJsonValue,
            lastSavedAt: now,
            deadlineAt: existingAttempt.deadlineAt ?? deadlineAt,
          },
          select: {
            assessmentId: true,
            status: true,
            startedAt: true,
            lastSavedAt: true,
            deadlineAt: true,
            autoSubmittedAt: true,
            submittedAt: true,
            gradedAt: true,
            marksObtained: true,
            totalMarks: true,
            percentage: true,
            passed: true,
            requiresManualReview: true,
          },
        })
      : tx.assessmentAttempt.create({
          data: {
            assessmentId: resolvedAssessmentId,
            assessmentPoolId: context.pool.id,
            learnerId: context.learnerId,
            batchId: context.batchId,
            status: AssessmentAttemptStatus.DRAFT,
            answers: normalizedAnswers as Prisma.InputJsonValue,
            totalMarks: context.pool.totalMarks,
            startedAt,
            lastSavedAt: now,
            deadlineAt,
            submittedAt: now,
          },
          select: {
            assessmentId: true,
            status: true,
            startedAt: true,
            lastSavedAt: true,
            deadlineAt: true,
            autoSubmittedAt: true,
            submittedAt: true,
            gradedAt: true,
            marksObtained: true,
            totalMarks: true,
            percentage: true,
            passed: true,
            requiresManualReview: true,
          },
        });
  });

  return {
    batchId: context.batchId,
    assessmentPoolId: context.pool.id,
    serverNow: now,
    attemptDeadlineAt: attempt.deadlineAt,
    attemptDeadlineSource: resolvedDeadline.deadlineSource,
    savedAnswers: normalizedAnswers,
    attempt: buildAttemptSummaryFromAttempt({
      assessmentId: attempt.assessmentId,
      status: attempt.status,
      startedAt: attempt.startedAt,
      lastSavedAt: attempt.lastSavedAt,
      deadlineAt: attempt.deadlineAt,
      autoSubmittedAt: attempt.autoSubmittedAt,
      submittedAt: attempt.submittedAt,
      gradedAt: attempt.gradedAt,
      marksObtained: attempt.marksObtained,
      totalMarks: attempt.totalMarks,
      percentage: attempt.percentage,
      passed: attempt.passed,
      requiresManualReview: attempt.requiresManualReview,
    }),
  };
}

export async function submitCandidateAssessmentService(options: {
  userId: string;
  batchId: string;
  assessmentPoolId: string;
  answers: GradeSubmissionInput["answers"];
}): Promise<CandidateAssessmentSubmissionResult> {
  return finalizeCandidateAssessmentAttemptService({
    userId: options.userId,
    batchId: options.batchId,
    assessmentPoolId: options.assessmentPoolId,
    answers: options.answers,
  });
}