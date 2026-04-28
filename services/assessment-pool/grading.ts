import "server-only";

import { prisma, isDatabaseConfigured } from "@/lib/prisma-client";
import type { QuestionDetail, GradeResult, GradingReport } from "@/services/assessment-pool/types";

type PassCriteriaConfig = {
  minPercentageScore?: number;
  minMarks?: number;
  mandatoryQuestionIds?: string[];
  minCompletionRequirement?: number;
};

function normalizeTrueFalseValue(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  if (typeof value === "number") {
    if (value === 1) {
      return true;
    }

    if (value === 0) {
      return false;
    }
  }

  return null;
}

function clampAttemptScore(marksObtained: number, totalMarks: number) {
  const normalizedTotalMarks = Math.max(0, totalMarks);
  const normalizedMarksObtained = Math.min(Math.max(0, marksObtained), normalizedTotalMarks);
  const rawPercentage = normalizedTotalMarks > 0
    ? Math.round((normalizedMarksObtained / normalizedTotalMarks) * 100)
    : 0;
  const normalizedPercentage = Math.min(Math.max(0, rawPercentage), 100);

  return {
    marksObtained: normalizedMarksObtained,
    percentage: normalizedPercentage,
  };
}

/**
 * Auto-grade objective question types where the correct answer can be resolved immediately.
 * Returns null for question types that require manual review.
 */
function gradeQuestion(question: QuestionDetail, answer: unknown): GradeResult | null {
  const base = {
    questionId: question.id,
    maxMarks: question.marks,
    correctAnswer: question.correctAnswer,
  };

  switch (question.questionType) {
    case "MCQ": {
      const correct = question.correctAnswer as string | number;
      const isCorrect = String(answer).trim().toLowerCase() === String(correct).trim().toLowerCase();
      return { ...base, isCorrect, marksAwarded: isCorrect ? question.marks : 0 };
    }

    case "TRUE_FALSE": {
      const submitted = normalizeTrueFalseValue(answer);
      const correct = normalizeTrueFalseValue(question.correctAnswer);
      const isCorrect = submitted !== null && correct !== null && submitted === correct;

      return { ...base, isCorrect, marksAwarded: isCorrect ? question.marks : 0 };
    }

    case "NUMERIC": {
      const correctNum = question.correctAnswer as { value: number; tolerance?: number } | number;
      const answerNum = Number(answer);
      if (Number.isNaN(answerNum)) {
        return { ...base, isCorrect: false, marksAwarded: 0 };
      }

      let targetValue: number;
      let tolerance = 0;

      if (typeof correctNum === "object" && correctNum !== null) {
        targetValue = correctNum.value;
        tolerance = correctNum.tolerance ?? 0;
      } else {
        targetValue = Number(correctNum);
      }

      const isCorrect = Math.abs(answerNum - targetValue) <= tolerance;
      return { ...base, isCorrect, marksAwarded: isCorrect ? question.marks : 0 };
    }

    case "FILL_IN_THE_BLANK": {
      const correctAnswers = question.correctAnswer as string | string[];
      const normalizedAnswer = String(answer).trim().toLowerCase();

      let isCorrect = false;
      if (Array.isArray(correctAnswers)) {
        isCorrect = correctAnswers.some((ca) => String(ca).trim().toLowerCase() === normalizedAnswer);
      } else {
        isCorrect = String(correctAnswers).trim().toLowerCase() === normalizedAnswer;
      }

      return { ...base, isCorrect, marksAwarded: isCorrect ? question.marks : 0 };
    }

    case "TWO_PART_ANALYSIS": {
      const correct = question.correctAnswer as { partA: string; partB: string };
      const submitted = answer as { partA?: string; partB?: string };

      if (!correct || !submitted) {
        return { ...base, isCorrect: false, marksAwarded: 0 };
      }

      const partACorrect = String(submitted.partA ?? "").trim().toLowerCase() === String(correct.partA).trim().toLowerCase();
      const partBCorrect = String(submitted.partB ?? "").trim().toLowerCase() === String(correct.partB).trim().toLowerCase();
      const isCorrect = partACorrect && partBCorrect;
      const partial = partACorrect || partBCorrect ? Math.floor(question.marks / 2) : 0;

      return { ...base, isCorrect, marksAwarded: isCorrect ? question.marks : partial };
    }

    case "ESSAY":
    case "MULTI_INPUT_REASONING":
      // These require manual grading
      return null;

    default:
      return null;
  }
}

export async function gradeSubmissionService(
  poolId: string,
  answers: { questionId: string; answer: unknown }[],
): Promise<GradingReport> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const pool = await prisma.assessmentPool.findUnique({
    where: { id: poolId },
    select: {
      totalMarks: true,
      passingMarks: true,
      passCriteriaConfig: true,
      questions: {
        select: {
          id: true,
          questionText: true,
          questionType: true,
          options: true,
          correctAnswer: true,
          explanation: true,
          marks: true,
          isMandatory: true,
          sortOrder: true,
        },
      },
    },
  });

  if (!pool) {
    throw new Error("Assessment pool not found.");
  }

  const questionMap = new Map(pool.questions.map((q) => [q.id, q as QuestionDetail]));
  const submittedQuestionIds = new Set(answers.map((item) => item.questionId));
  const results: GradeResult[] = [];
  let marksObtained = 0;
  let requiresManualReview = false;

  for (const submission of answers) {
    const question = questionMap.get(submission.questionId);
    if (!question) continue;

    const result = gradeQuestion(question, submission.answer);
    if (result) {
      results.push(result);
      marksObtained += result.marksAwarded;
    } else {
      requiresManualReview = true;
      results.push({
        questionId: submission.questionId,
        isCorrect: null,
        marksAwarded: 0,
        maxMarks: question.marks,
        correctAnswer: null,
        requiresManualReview: true,
        feedback: null,
      });
    }
  }

  const normalizedScore = clampAttemptScore(marksObtained, pool.totalMarks);
  const criteria = (pool.passCriteriaConfig as PassCriteriaConfig | null) ?? null;
  const mandatoryIds = new Set([
    ...pool.questions.filter((question) => question.isMandatory).map((question) => question.id),
    ...(criteria?.mandatoryQuestionIds ?? []),
  ]);
  const resultByQuestionId = new Map(results.map((item) => [item.questionId, item]));

  const meetsMandatoryQuestionRule = Array.from(mandatoryIds).every((questionId) => {
    const result = resultByQuestionId.get(questionId);
    if (!result) {
      return false;
    }

    return result.isCorrect === true;
  });

  const completionRequirement = criteria?.minCompletionRequirement;
  const completionRatio = pool.questions.length > 0 ? (submittedQuestionIds.size / pool.questions.length) * 100 : 100;
  const meetsCompletionRule = completionRequirement === undefined || completionRatio >= completionRequirement;

  const minMarksThreshold = criteria?.minMarks ?? pool.passingMarks;
  const meetsMarksRule = normalizedScore.marksObtained >= minMarksThreshold;

  const meetsPercentageRule = criteria?.minPercentageScore === undefined
    || normalizedScore.percentage >= criteria.minPercentageScore;

  const passed = meetsMarksRule && meetsPercentageRule && meetsMandatoryQuestionRule && meetsCompletionRule;

  return {
    totalMarks: pool.totalMarks,
    marksObtained: normalizedScore.marksObtained,
    percentage: normalizedScore.percentage,
    passed,
    requiresManualReview,
    results,
  };
}
