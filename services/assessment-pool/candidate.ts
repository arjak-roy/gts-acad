import "server-only";

import { AssessmentMode, AssessmentType, EvaluationStatus, Prisma, QuestionType } from "@prisma/client";

import type { GradeSubmissionInput } from "@/lib/validation-schemas/assessment-pool";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { gradeSubmissionService } from "@/services/assessment-pool/grading";
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

const AUTO_GRADABLE_QUESTION_TYPES = new Set<QuestionType>([
  "MCQ",
  "NUMERIC",
  "FILL_IN_THE_BLANK",
  "TWO_PART_ANALYSIS",
]);

const CANDIDATE_ATTEMPT_FEEDBACK_TYPE = "candidate-assessment-submission";
const FALLBACK_ASSESSMENT_PREFIX = "[BATCH-ASSESSMENT:";

type CandidateAttemptFeedback = {
  type: typeof CANDIDATE_ATTEMPT_FEEDBACK_TYPE;
  marksObtained: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
};

type CandidateAssessmentContext = {
  learnerId: string;
  batchId: string;
  batchMode: "ONLINE" | "OFFLINE";
  programId: string;
  assignmentId: string;
  opensAt: Date | null;
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

function parseCandidateAttemptFeedback(feedback: string | null) {
  if (!feedback) {
    return null;
  }

  try {
    const parsed = JSON.parse(feedback) as CandidateAttemptFeedback;

    if (parsed?.type !== CANDIDATE_ATTEMPT_FEEDBACK_TYPE) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function buildCandidateAttemptFeedback(report: { marksObtained: number; totalMarks: number; percentage: number; passed: boolean }) {
  return JSON.stringify({
    type: CANDIDATE_ATTEMPT_FEEDBACK_TYPE,
    marksObtained: report.marksObtained,
    totalMarks: report.totalMarks,
    percentage: report.percentage,
    passed: report.passed,
  } satisfies CandidateAttemptFeedback);
}

function buildAttemptSummary(options: {
  assessmentId: string;
  gradedAt: Date;
  storedScore: number;
  storedFeedback: string | null;
  passingMarks: number;
  totalMarks: number;
}): CandidateAssessmentAttemptSummary {
  const parsedFeedback = parseCandidateAttemptFeedback(options.storedFeedback);
  const fallbackPassedThreshold = options.totalMarks > 0 ? Math.round((options.passingMarks / options.totalMarks) * 100) : 0;

  return {
    assessmentId: options.assessmentId,
    percentage: parsedFeedback?.percentage ?? options.storedScore,
    passed: parsedFeedback?.passed ?? options.storedScore >= fallbackPassedThreshold,
    gradedAt: options.gradedAt,
    marksObtained: parsedFeedback?.marksObtained ?? null,
    totalMarks: parsedFeedback?.totalMarks ?? options.totalMarks,
  };
}

function sanitizeQuestionOptions(question: QuestionDetail): unknown {
  if (question.questionType === "MCQ") {
    return Array.isArray(question.options) ? question.options : [];
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
    },
  });

  const opensAt = mapping?.scheduledAt ?? linkedEvent?.startsAt ?? null;
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
      ? buildAttemptSummary({
          assessmentId: score.assessmentId,
          gradedAt: score.gradedAt,
          storedScore: score.score,
          storedFeedback: score.feedback,
          passingMarks: pool.passingMarks,
          totalMarks: pool.totalMarks,
        })
      : null,
    supportsInAppAttempt: pool.questions.every((question) => AUTO_GRADABLE_QUESTION_TYPES.has(question.questionType)),
  };
}

function getAvailabilityMessage(context: CandidateAssessmentContext, now: number) {
  if (!context.supportsInAppAttempt) {
    return "This assessment includes question types that still need manual evaluation, so it cannot be taken in the app yet.";
  }

  if (!context.opensAt) {
    return "This assessment is mapped to your batch, but its start time has not been published yet.";
  }

  if (context.opensAt.getTime() > now) {
    return "This assessment will unlock once the scheduled start time has been crossed.";
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
  const isOpen = Boolean(context.opensAt && context.opensAt.getTime() <= now);

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
    isOpen,
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

  const report = await gradeSubmissionService(
    options.assessmentPoolId,
    options.answers.map((answer) => ({
      questionId: answer.questionId,
      answer: answer.answer ?? null,
    })),
  );

  const feedback = buildCandidateAttemptFeedback(report);
  const fallbackTitle = buildFallbackAssessmentTitle(context.assignmentId, context.pool.title);
  const gradedAt = new Date();

  try {
    const assessmentId = await prisma.$transaction(async (tx) => {
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

      const existingScore = await tx.assessmentScore.findUnique({
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

      if (existingScore) {
        throw new Error("Assessment already submitted.");
      }

      await tx.assessmentScore.create({
        data: {
          assessmentId: resolvedAssessmentId,
          learnerId: context.learnerId,
          score: report.percentage,
          feedback,
          gradedAt,
        },
      });

      return resolvedAssessmentId;
    });

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

    return {
      batchId: context.batchId,
      assessmentPoolId: context.pool.id,
      attempt: buildAttemptSummary({
        assessmentId,
        gradedAt,
        storedScore: report.percentage,
        storedFeedback: feedback,
        passingMarks: context.pool.passingMarks,
        totalMarks: context.pool.totalMarks,
      }),
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("Assessment already submitted.");
    }

    throw error;
  }
}