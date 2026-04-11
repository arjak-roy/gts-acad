import "server-only";

import { AssessmentAttemptStatus, Prisma } from "@prisma/client";

import type { GradeAssessmentAttemptInput, UpdateAssessmentAttemptStatusInput } from "@/lib/validation-schemas/assessment-reviews";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { buildCandidateAttemptFeedback } from "@/services/assessment-pool/candidate-attempt-feedback";
import { gradeSubmissionService } from "@/services/assessment-pool/grading";
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
}) {
  const manualQuestionMap = new Map(options.manualQuestions.map((question) => [question.id, question]));
  const manualScores = normalizeQuestionScores(options.questionScores);
  const manualScoreMap = new Map(manualScores.map((score) => [score.questionId, score]));

  if (manualScores.length !== options.manualQuestions.length) {
    throw new Error("Provide scores for every manual-review question before grading this attempt.");
  }

  options.manualQuestions.forEach((question) => {
    const score = manualScoreMap.get(question.id);
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
    if (!manualScore) {
      return result;
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
    },
  });

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
    },
  });

  if (!attempt) {
    throw new Error("Assessment attempt not found.");
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
  });
  const marksObtained = results.reduce((total, result) => total + result.marksAwarded, 0);
  const percentage = attempt.totalMarks > 0 ? Math.round((marksObtained / attempt.totalMarks) * 100) : 0;
  const passed = marksObtained >= attempt.assessmentPool.passingMarks;
  const gradedAt = new Date();
  const reviewerFeedback = options.input.reviewerFeedback.trim() || null;
  const gradingReport = {
    ...existingReport,
    marksObtained,
    percentage,
    passed,
    requiresManualReview: false,
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
        status: AssessmentAttemptStatus.GRADED,
        gradingReport: gradingReport as Prisma.InputJsonValue,
        requiresManualReview: false,
        marksObtained,
        percentage,
        passed,
        reviewerFeedback,
        reviewStartedAt: new Date(),
        reviewedByUserId: options.userId,
        gradedAt,
      },
    });

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
  });

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

  return getAssessmentReviewDetailService({
    attemptId: options.attemptId,
    userId: options.userId,
  });
}