import "server-only";

import { prisma, isDatabaseConfigured } from "@/lib/prisma-client";
import type { QuestionDetail, GradeResult, GradingReport } from "@/services/assessment-pool/types";

/**
 * Auto-grade objective question types: MCQ, NUMERIC, FILL_IN_THE_BLANK.
 * Returns null for subjective types (ESSAY, MULTI_INPUT_REASONING, TWO_PART_ANALYSIS).
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
      questions: {
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
  });

  if (!pool) {
    throw new Error("Assessment pool not found.");
  }

  const questionMap = new Map(pool.questions.map((q) => [q.id, q as QuestionDetail]));
  const results: GradeResult[] = [];
  let marksObtained = 0;

  for (const submission of answers) {
    const question = questionMap.get(submission.questionId);
    if (!question) continue;

    const result = gradeQuestion(question, submission.answer);
    if (result) {
      results.push(result);
      marksObtained += result.marksAwarded;
    } else {
      // Subjective — mark as 0 pending manual review
      results.push({
        questionId: submission.questionId,
        isCorrect: false,
        marksAwarded: 0,
        maxMarks: question.marks,
        correctAnswer: null,
      });
    }
  }

  const percentage = pool.totalMarks > 0 ? Math.round((marksObtained / pool.totalMarks) * 100) : 0;

  return {
    totalMarks: pool.totalMarks,
    marksObtained,
    percentage,
    passed: marksObtained >= pool.passingMarks,
    results,
  };
}
