/**
 * Backfill script: populate attempt_question_results from existing assessment_attempts.
 *
 * Existing attempts already have `attempt_number = 1` (migration default).
 * This script parses the answers + grading_report JSON from each submitted attempt,
 * then inserts normalized rows into attempt_question_results.
 *
 * Run once after migration:
 *   node scripts/backfill-question-results.mjs
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BATCH_SIZE = 100;

function parseAnswers(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    if (typeof item.questionId !== "string") return [];
    return [{ questionId: item.questionId, answer: item.answer ?? null }];
  });
}

function parseGradingReport(value) {
  if (!value || typeof value !== "object") return null;
  return value;
}

async function run() {
  console.log("Starting backfill of attempt_question_results...");

  const totalAttempts = await prisma.assessmentAttempt.count({
    where: { status: { not: "DRAFT" } },
  });
  console.log(`Found ${totalAttempts} non-draft attempts to process.`);

  let processed = 0;
  let inserted = 0;
  let cursor = undefined;

  while (true) {
    const attempts = await prisma.assessmentAttempt.findMany({
      where: { status: { not: "DRAFT" } },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        assessmentPoolId: true,
        learnerId: true,
        answers: true,
        gradingReport: true,
      },
    });

    if (attempts.length === 0) break;

    for (const attempt of attempts) {
      const answers = parseAnswers(attempt.answers);
      const report = parseGradingReport(attempt.gradingReport);
      const resultMap = new Map(
        (report?.results ?? []).map((r) => [r.questionId, r]),
      );

      // Look up questions for this pool to get question type and marks
      const questions = await prisma.assessmentQuestion.findMany({
        where: { assessmentPoolId: attempt.assessmentPoolId },
        select: {
          id: true,
          questionType: true,
          marks: true,
        },
      });
      const questionMap = new Map(questions.map((q) => [q.id, q]));
      const answerMap = new Map(answers.map((a) => [a.questionId, a.answer]));

      const rows = [];
      for (const question of questions) {
        const gradeResult = resultMap.get(question.id);
        const submittedAnswer = answerMap.get(question.id) ?? null;
        const hasAnswer = submittedAnswer !== null && submittedAnswer !== undefined;
        const isSkipped = !hasAnswer;

        rows.push({
          attemptId: attempt.id,
          questionId: question.id,
          assessmentPoolId: attempt.assessmentPoolId,
          learnerId: attempt.learnerId,
          questionType: question.questionType,
          submittedAnswer: submittedAnswer ?? undefined,
          isCorrect: gradeResult?.isCorrect ?? null,
          isSkipped,
          marksAwarded: gradeResult?.marksAwarded ?? 0,
          maxMarks: question.marks,
          requiresManualReview: gradeResult?.requiresManualReview ?? false,
          gradedAt: gradeResult ? new Date() : null,
        });
      }

      if (rows.length > 0) {
        try {
          await prisma.attemptQuestionResult.createMany({
            data: rows,
            skipDuplicates: true,
          });
          inserted += rows.length;
        } catch (error) {
          console.error(`Failed to insert results for attempt ${attempt.id}:`, error.message);
        }
      }

      processed += 1;
    }

    cursor = attempts[attempts.length - 1].id;
    console.log(`Processed ${processed}/${totalAttempts} attempts (${inserted} question results inserted)...`);
  }

  console.log(`\nBackfill complete. ${processed} attempts processed, ${inserted} question results inserted.`);
}

run()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
