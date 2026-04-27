import "server-only";

import { AssessmentAttemptStatus, AssessmentReviewHistoryEvent, Prisma } from "@prisma/client";

import type {
  GradeAssessmentAttemptInput,
  OverrideAssessmentAttemptInput,
  ReopenAssessmentAttemptInput,
  UpdateAssessmentAttemptStatusInput,
} from "@/lib/validation-schemas/assessment-reviews";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { buildCandidateAttemptFeedback } from "@/services/assessment-pool/candidate-attempt-feedback";
import { gradeSubmissionService } from "@/services/assessment-pool/grading";
import { sendCandidateAssessmentResultNotification } from "@/services/candidate-notifications";
import type { GradeResult } from "@/services/assessment-pool/types";
import {
  markCurriculumAssessmentCompletedForLearnerService,
  markCurriculumAssessmentInProgressForLearnerService,
} from "@/services/curriculum/progress";
import {
  parseAssessmentAttemptAnswers,
  parseAssessmentAttemptGradingReport,
  resolveAssessmentReviewAccess,
} from "@/services/assessment-reviews/internal";
import { getAssessmentReviewDetailService } from "@/services/assessment-reviews/queries";
import { recomputeLearnerReadiness } from "@/services/readiness-service";

const MANUAL_REVIEW_QUESTION_TYPES = new Set(["ESSAY", "MULTI_INPUT_REASONING"]);

function normalizeQuestionScores(questionScores: GradeAssessmentAttemptInput["questionScores"]) {
  const deduplicatedScores = new Map<string, GradeAssessmentAttemptInput["questionScores"][number]>();

  questionScores.forEach((score) => {
    deduplicatedScores.set(score.questionId, score);
  });

  return Array.from(deduplicatedScores.values());
}

function buildManualGradingResults(options: {
  existingResults: GradeResult[];
  manualQuestions: Array<{ id: string; marks: number }>;
  questionScores: GradeAssessmentAttemptInput["questionScores"];
  requireAllManualScores: boolean;
}) {
  const manualQuestionMap = new Map(options.manualQuestions.map((question) => [question.id, question]));
  const manualScores = normalizeQuestionScores(options.questionScores);
  const manualScoreMap = new Map(manualScores.map((score) => [score.questionId, score]));

  if (options.requireAllManualScores && manualScores.length !== options.manualQuestions.length) {
    throw new Error("Provide scores for every manual-review question before grading this attempt.");
  }

  options.manualQuestions.forEach((question) => {
    const score = manualScoreMap.get(question.id);
    if (!score && !options.requireAllManualScores) {
      return;
    }

    if (!score) {
      throw new Error("Provide scores for every manual-review question before grading this attempt.");
    }

    if (score.marksAwarded > question.marks) {
      throw new Error("Manual marks cannot exceed the question maximum.");
    }
  });

  return options.existingResults.map((result) => {
    const manualQuestion = manualQuestionMap.get(result.questionId);
    if (!manualQuestion) {
      return {
        ...result,
        requiresManualReview: false,
        feedback: result.feedback ?? null,
      };
    }

    const manualScore = manualScoreMap.get(result.questionId);
    if (!manualScore && options.requireAllManualScores) {
      return result;
    }

    if (!manualScore) {
      return {
        ...result,
        isCorrect: null,
        marksAwarded: result.marksAwarded ?? 0,
        maxMarks: manualQuestion.marks,
        requiresManualReview: true,
        feedback: result.feedback ?? null,
      } satisfies GradeResult;
    }

    return {
      ...result,
      isCorrect: null,
      marksAwarded: manualScore.marksAwarded,
      maxMarks: manualQuestion.marks,
      requiresManualReview: false,
      feedback: manualScore.feedback.trim() || null,
    } satisfies GradeResult;
  });
}

async function writeAssessmentReviewHistory(options: {
  tx: Prisma.TransactionClient;
  attemptId: string;
  actorUserId: string;
  eventType: AssessmentReviewHistoryEvent;
  scoreBefore?: number | null;
  scoreAfter?: number | null;
  passedBefore?: boolean | null;
  passedAfter?: boolean | null;
  notes?: string | null;
  snapshot?: Prisma.InputJsonValue;
}) {
  await options.tx.assessmentReviewHistory.create({
    data: {
      attemptId: options.attemptId,
      actorUserId: options.actorUserId,
      eventType: options.eventType,
      scoreBefore: options.scoreBefore ?? null,
      scoreAfter: options.scoreAfter ?? null,
      passedBefore: options.passedBefore ?? null,
      passedAfter: options.passedAfter ?? null,
      notes: options.notes ?? null,
      snapshot: options.snapshot ?? {},
    },
  });
}

export async function updateAssessmentAttemptStatusService(options: {
  attemptId: string;
  userId: string;
  input: UpdateAssessmentAttemptStatusInput;
}) {
  if (!isDatabaseConfigured) {
    return null;
  }

  const attempt = await prisma.assessmentAttempt.findUnique({
    where: { id: options.attemptId },
    select: {
      id: true,
      assessmentPoolId: true,
      status: true,
      learnerId: true,
      batchId: true,
    },
  });

  if (!attempt) {
    throw new Error("Assessment attempt not found.");
  }

  if (attempt.status === AssessmentAttemptStatus.GRADED) {
    throw new Error("This assessment attempt has already been graded.");
  }

  const access = await resolveAssessmentReviewAccess(options.userId, attempt.assessmentPoolId);
  if (options.input.status === "IN_REVIEW") {
    if (!access.canManageAttempts && !access.canManualGrade) {
      throw new Error("You do not have permission to start review for this attempt.");
    }
  } else if (!access.canManageAttempts) {
    throw new Error("You do not have permission to return this attempt to the queue.");
  }

  await prisma.assessmentAttempt.update({
    where: { id: options.attemptId },
    data: {
      status: options.input.status,
      reviewStartedAt: options.input.status === "IN_REVIEW" ? new Date() : null,
      reviewedByUserId: options.input.status === "IN_REVIEW" ? options.userId : null,
      isFinalized: false,
      finalizedAt: null,
      finalizedByUserId: null,
    },
  });

  if (options.input.status === "IN_REVIEW") {
    await prisma.assessmentReviewHistory.create({
      data: {
        attemptId: options.attemptId,
        actorUserId: options.userId,
        eventType: AssessmentReviewHistoryEvent.REVIEW_STARTED,
        notes: "Review started.",
      },
    });
  }

  if (options.input.status === "IN_REVIEW") {
    try {
      await markCurriculumAssessmentInProgressForLearnerService({
        learnerId: attempt.learnerId,
        batchId: attempt.batchId,
        assessmentPoolId: attempt.assessmentPoolId,
      });
    } catch (error) {
      console.warn("Assessment review started, but curriculum in-progress sync failed", error);
    }
  }

  return getAssessmentReviewDetailService({
    attemptId: options.attemptId,
    userId: options.userId,
  });
}

export async function gradeAssessmentAttemptService(options: {
  attemptId: string;
  userId: string;
  input: GradeAssessmentAttemptInput;
}) {
  if (!isDatabaseConfigured) {
    return null;
  }

  const attempt = await prisma.assessmentAttempt.findUnique({
    where: { id: options.attemptId },
    select: {
      id: true,
      assessmentId: true,
      assessmentPoolId: true,
      learnerId: true,
      batchId: true,
      answers: true,
      gradingReport: true,
      totalMarks: true,
      assessmentPool: {
        select: {
          passingMarks: true,
          questions: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              questionType: true,
              marks: true,
            },
          },
        },
      },
      marksObtained: true,
      passed: true,
      isFinalized: true,
    },
  });

  if (!attempt) {
    throw new Error("Assessment attempt not found.");
  }

  if (attempt.isFinalized) {
    throw new Error("This assessment attempt is finalized and must be reopened before changes.");
  }

  const access = await resolveAssessmentReviewAccess(options.userId, attempt.assessmentPoolId);
  if (!access.canManualGrade) {
    throw new Error("You do not have permission to grade this attempt.");
  }

  const manualQuestions = attempt.assessmentPool.questions.filter((question) => MANUAL_REVIEW_QUESTION_TYPES.has(question.questionType));
  if (manualQuestions.length === 0) {
    throw new Error("This assessment attempt does not require manual grading.");
  }

  const existingReport = parseAssessmentAttemptGradingReport(attempt.gradingReport)
    ?? await gradeSubmissionService(attempt.assessmentPoolId, parseAssessmentAttemptAnswers(attempt.answers));

  const results = buildManualGradingResults({
    existingResults: existingReport.results,
    manualQuestions,
    questionScores: options.input.questionScores,
    requireAllManualScores: !options.input.draft,
  });
  const marksObtained = results.reduce((total, result) => total + result.marksAwarded, 0);
  const percentage = attempt.totalMarks > 0 ? Math.round((marksObtained / attempt.totalMarks) * 100) : 0;
  const passed = marksObtained >= attempt.assessmentPool.passingMarks;
  const gradedAt = new Date();
  const reviewerFeedback = options.input.reviewerFeedback.trim() || null;
  const requiresManualReview = results.some((result) => result.requiresManualReview === true);
  const gradingReport = {
    ...existingReport,
    marksObtained,
    percentage,
    passed,
    requiresManualReview,
    results,
  };
  const feedback = buildCandidateAttemptFeedback({
    marksObtained,
    totalMarks: attempt.totalMarks,
    percentage,
    passed,
  });

  await prisma.$transaction(async (tx) => {
    await tx.assessmentAttempt.update({
      where: { id: options.attemptId },
      data: {
        status: options.input.draft ? AssessmentAttemptStatus.IN_REVIEW : AssessmentAttemptStatus.GRADED,
        gradingReport: gradingReport as Prisma.InputJsonValue,
        requiresManualReview,
        marksObtained,
        percentage,
        passed,
        reviewerFeedback,
        reviewStartedAt: new Date(),
        reviewedByUserId: options.userId,
        gradedAt: options.input.draft ? null : gradedAt,
        isFinalized: false,
        finalizedAt: null,
        finalizedByUserId: null,
      },
    });

    if (!options.input.draft) {
      await tx.assessmentScore.upsert({
        where: {
          assessmentId_learnerId: {
            assessmentId: attempt.assessmentId,
            learnerId: attempt.learnerId,
          },
        },
        update: {
          score: percentage,
          feedback,
          gradedAt,
        },
        create: {
          assessmentId: attempt.assessmentId,
          learnerId: attempt.learnerId,
          score: percentage,
          feedback,
          gradedAt,
        },
      });
    }

    await writeAssessmentReviewHistory({
      tx,
      attemptId: options.attemptId,
      actorUserId: options.userId,
      eventType: options.input.draft ? AssessmentReviewHistoryEvent.DRAFT_SAVED : AssessmentReviewHistoryEvent.GRADED,
      scoreBefore: attempt.marksObtained,
      scoreAfter: marksObtained,
      passedBefore: attempt.passed,
      passedAfter: passed,
      notes: options.input.draft ? "Review draft saved." : "Assessment graded.",
      snapshot: {
        reviewerFeedback,
        requiresManualReview,
      },
    });
  });

  if (options.input.draft) {
    return getAssessmentReviewDetailService({
      attemptId: options.attemptId,
      userId: options.userId,
    });
  }

  try {
    await markCurriculumAssessmentCompletedForLearnerService({
      learnerId: attempt.learnerId,
      batchId: attempt.batchId,
      assessmentPoolId: attempt.assessmentPoolId,
    });
  } catch (error) {
    console.warn("Assessment graded, but curriculum completion sync failed", error);
  }

  try {
    await recomputeLearnerReadiness(attempt.learnerId);
  } catch (error) {
    console.warn("Assessment graded, but readiness recomputation failed", error);
  }

  try {
    const notificationSummary = await sendCandidateAssessmentResultNotification({
      attemptId: options.attemptId,
      actorUserId: options.userId,
    });

    if (notificationSummary.failedCount > 0) {
      console.warn("Candidate assessment result email partially failed.", notificationSummary);
    }
  } catch (error) {
    console.warn("Candidate assessment result email dispatch failed.", error);
  }

  return getAssessmentReviewDetailService({
    attemptId: options.attemptId,
    userId: options.userId,
  });
}

export async function overrideAssessmentAttemptService(options: {
  attemptId: string;
  userId: string;
  input: OverrideAssessmentAttemptInput;
}) {
  if (!isDatabaseConfigured) {
    return null;
  }

  const attempt = await prisma.assessmentAttempt.findUnique({
    where: { id: options.attemptId },
    select: {
      id: true,
      assessmentPoolId: true,
      status: true,
      isFinalized: true,
      marksObtained: true,
      passed: true,
    },
  });

  if (!attempt) {
    throw new Error("Assessment attempt not found.");
  }

  if (attempt.isFinalized) {
    throw new Error("Finalized reviews cannot be overridden. Reopen first.");
  }

  const access = await resolveAssessmentReviewAccess(options.userId, attempt.assessmentPoolId);
  if (!access.canManualGrade) {
    throw new Error("You do not have permission to override this attempt.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.assessmentAttempt.update({
      where: { id: options.attemptId },
      data: {
        overrideMarks: options.input.overrideMarks,
        overridePassed: options.input.overridePassed,
        overrideReason: options.input.overrideReason.trim(),
        overriddenByUserId: options.userId,
        overriddenAt: new Date(),
      },
    });

    await writeAssessmentReviewHistory({
      tx,
      attemptId: options.attemptId,
      actorUserId: options.userId,
      eventType: AssessmentReviewHistoryEvent.OVERRIDE_APPLIED,
      scoreBefore: attempt.marksObtained,
      scoreAfter: options.input.overrideMarks,
      passedBefore: attempt.passed,
      passedAfter: options.input.overridePassed,
      notes: options.input.overrideReason.trim(),
      snapshot: {
        status: attempt.status,
      },
    });
  });

  return getAssessmentReviewDetailService({
    attemptId: options.attemptId,
    userId: options.userId,
  });
}

export async function finalizeAssessmentAttemptService(options: {
  attemptId: string;
  userId: string;
}) {
  if (!isDatabaseConfigured) {
    return null;
  }

  const attempt = await prisma.assessmentAttempt.findUnique({
    where: { id: options.attemptId },
    select: {
      id: true,
      assessmentPoolId: true,
      status: true,
      isFinalized: true,
      marksObtained: true,
      passed: true,
      overrideMarks: true,
      overridePassed: true,
    },
  });

  if (!attempt) {
    throw new Error("Assessment attempt not found.");
  }

  if (attempt.status !== AssessmentAttemptStatus.GRADED) {
    throw new Error("Only graded assessments can be finalized.");
  }

  if (attempt.isFinalized) {
    throw new Error("Assessment review is already finalized.");
  }

  const access = await resolveAssessmentReviewAccess(options.userId, attempt.assessmentPoolId);
  if (!access.canManualGrade && !access.canManageAttempts) {
    throw new Error("You do not have permission to finalize this attempt.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.assessmentAttempt.update({
      where: { id: options.attemptId },
      data: {
        isFinalized: true,
        finalizedAt: new Date(),
        finalizedByUserId: options.userId,
      },
    });

    await writeAssessmentReviewHistory({
      tx,
      attemptId: options.attemptId,
      actorUserId: options.userId,
      eventType: AssessmentReviewHistoryEvent.FINALIZED,
      scoreBefore: attempt.overrideMarks ?? attempt.marksObtained,
      scoreAfter: attempt.overrideMarks ?? attempt.marksObtained,
      passedBefore: attempt.overridePassed ?? attempt.passed,
      passedAfter: attempt.overridePassed ?? attempt.passed,
      notes: "Review finalized.",
    });
  });

  return getAssessmentReviewDetailService({
    attemptId: options.attemptId,
    userId: options.userId,
  });
}

export async function reopenAssessmentAttemptService(options: {
  attemptId: string;
  userId: string;
  input: ReopenAssessmentAttemptInput;
}) {
  if (!isDatabaseConfigured) {
    return null;
  }

  const attempt = await prisma.assessmentAttempt.findUnique({
    where: { id: options.attemptId },
    select: {
      id: true,
      assessmentPoolId: true,
      isFinalized: true,
      marksObtained: true,
      passed: true,
      overrideMarks: true,
      overridePassed: true,
    },
  });

  if (!attempt) {
    throw new Error("Assessment attempt not found.");
  }

  const access = await resolveAssessmentReviewAccess(options.userId, attempt.assessmentPoolId);
  if (!access.canManageAttempts) {
    throw new Error("You do not have permission to reopen this attempt.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.assessmentAttempt.update({
      where: { id: options.attemptId },
      data: {
        status: AssessmentAttemptStatus.IN_REVIEW,
        isFinalized: false,
        finalizedAt: null,
        finalizedByUserId: null,
        reviewStartedAt: new Date(),
        reviewedByUserId: options.userId,
      },
    });

    await writeAssessmentReviewHistory({
      tx,
      attemptId: options.attemptId,
      actorUserId: options.userId,
      eventType: AssessmentReviewHistoryEvent.REOPENED,
      scoreBefore: attempt.overrideMarks ?? attempt.marksObtained,
      scoreAfter: attempt.overrideMarks ?? attempt.marksObtained,
      passedBefore: attempt.overridePassed ?? attempt.passed,
      passedAfter: attempt.overridePassed ?? attempt.passed,
      notes: options.input.reason.trim(),
    });
  });

  return getAssessmentReviewDetailService({
    attemptId: options.attemptId,
    userId: options.userId,
  });
}