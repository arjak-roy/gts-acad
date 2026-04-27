import "server-only";

import { AssessmentAttemptStatus, Prisma, ProgramType } from "@prisma/client";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import type {
  AssessmentAnalyticsFilters,
  LearnerPerformanceRequest,
  QuestionAnalyticsRequest,
  TrendAnalysisRequest,
  LearnerComparisonRequest,
} from "@/lib/validation-schemas/assessment-analytics";
import type {
  AssessmentSummaryReport,
  DashboardAnalyticsWidgets,
  DifficultQuestion,
  LearnerComparisonRow,
  LearnerPerformanceReport,
  LearnerPerformanceRow,
  PassFailStats,
  QuestionAnalyticsRow,
  TrendDataPoint,
} from "@/services/assessment-analytics/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildDateFilter(dateFrom?: string, dateTo?: string) {
  const filter: { gte?: Date; lte?: Date } = {};
  if (dateFrom) filter.gte = new Date(dateFrom);
  if (dateTo) filter.lte = new Date(dateTo);
  return Object.keys(filter).length > 0 ? filter : undefined;
}

function buildAttemptWhere(filters: AssessmentAnalyticsFilters): Prisma.AssessmentAttemptWhereInput {
  const dateFilter = buildDateFilter(filters.dateFrom, filters.dateTo);

  return {
    ...(filters.assessmentPoolId ? { assessmentPoolId: filters.assessmentPoolId } : {}),
    ...(filters.batchId ? { batchId: filters.batchId } : {}),
    ...(filters.learnerId ? { learnerId: filters.learnerId } : {}),
    ...(filters.status && filters.status !== "ALL" ? { status: filters.status as AssessmentAttemptStatus } : { status: { not: AssessmentAttemptStatus.DRAFT } }),
    ...(dateFilter ? { submittedAt: dateFilter } : {}),
    ...(filters.courseId
      ? {
          batch: {
            program: {
              courseId: filters.courseId,
              ...(filters.programType ? { type: filters.programType as ProgramType } : {}),
            },
            ...(filters.programId ? { programId: filters.programId } : {}),
          },
        }
      : filters.programId
        ? { batch: { programId: filters.programId } }
        : filters.programType
          ? { batch: { program: { type: filters.programType as ProgramType } } }
          : {}),
  };
}

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function safePercentage(numerator: number, denominator: number) {
  return denominator > 0 ? roundToOneDecimal((numerator / denominator) * 100) : 0;
}

// ── 1. Assessment Summary Report ─────────────────────────────────────────────

export async function getAssessmentSummaryReport(
  filters: AssessmentAnalyticsFilters,
): Promise<AssessmentSummaryReport[]> {
  if (!isDatabaseConfigured) return [];

  const where = buildAttemptWhere(filters);

  const attempts = await prisma.assessmentAttempt.findMany({
    where,
    select: {
      assessmentPoolId: true,
      status: true,
      percentage: true,
      passed: true,
      learnerId: true,
      assessmentPool: {
        select: {
          id: true,
          code: true,
          title: true,
          questionType: true,
          difficultyLevel: true,
        },
      },
    },
  });

  const poolMap = new Map<string, {
    pool: (typeof attempts)[0]["assessmentPool"];
    learnerIds: Set<string>;
    attempts: typeof attempts;
  }>();

  for (const attempt of attempts) {
    const poolId = attempt.assessmentPoolId;
    if (!poolMap.has(poolId)) {
      poolMap.set(poolId, {
        pool: attempt.assessmentPool,
        learnerIds: new Set(),
        attempts: [],
      });
    }
    const entry = poolMap.get(poolId)!;
    entry.learnerIds.add(attempt.learnerId);
    entry.attempts.push(attempt);
  }

  // Get total assigned learners per pool
  const poolIds = Array.from(poolMap.keys());
  const assignedCounts = poolIds.length > 0
    ? await prisma.batchEnrollment.groupBy({
        by: ["batchId"],
        where: {
          status: "ACTIVE",
          batch: {
            batchAssessmentMappings: {
              some: {
                assessmentPoolId: { in: poolIds },
              },
            },
          },
        },
        _count: { learnerId: true },
      })
    : [];

  const totalAssignedByPool = new Map<string, number>();
  if (poolIds.length > 0) {
    for (const poolId of poolIds) {
      const mappings = await prisma.batchAssessmentMapping.findMany({
        where: { assessmentPoolId: poolId },
        select: { batchId: true },
      });
      let totalAssigned = 0;
      for (const mapping of mappings) {
        const count = await prisma.batchEnrollment.count({
          where: { batchId: mapping.batchId, status: "ACTIVE" },
        });
        totalAssigned += count;
      }
      totalAssignedByPool.set(poolId, totalAssigned);
    }
  }

  return Array.from(poolMap.entries()).map(([poolId, entry]) => {
    const graded = entry.attempts.filter((a) => a.status === "GRADED");
    const scores = graded.map((a) => a.percentage ?? 0);
    const passed = graded.filter((a) => a.passed === true).length;
    const failed = graded.filter((a) => a.passed === false).length;
    const pendingReview = entry.attempts.filter(
      (a) => a.status === "PENDING_REVIEW" || a.status === "IN_REVIEW",
    ).length;

    return {
      assessmentPoolId: poolId,
      assessmentCode: entry.pool.code,
      assessmentTitle: entry.pool.title,
      questionType: entry.pool.questionType,
      difficultyLevel: entry.pool.difficultyLevel,
      totalAssignedLearners: totalAssignedByPool.get(poolId) ?? 0,
      totalAttempts: entry.attempts.length,
      completedAttempts: graded.length,
      passRate: safePercentage(passed, graded.length),
      failRate: safePercentage(failed, graded.length),
      averageScore: scores.length > 0 ? roundToOneDecimal(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      highestScore: scores.length > 0 ? Math.max(...scores) : 0,
      lowestScore: scores.length > 0 ? Math.min(...scores) : 0,
      pendingReviewCount: pendingReview,
    };
  });
}

// ── 2. Learner Performance Report ────────────────────────────────────────────

export async function getLearnerPerformanceReport(
  filters: LearnerPerformanceRequest,
): Promise<LearnerPerformanceReport> {
  if (!isDatabaseConfigured) {
    return { rows: [], totalCount: 0, page: filters.page, pageSize: filters.pageSize, pageCount: 0 };
  }

  const where = buildAttemptWhere(filters);

  const attempts = await prisma.assessmentAttempt.findMany({
    where,
    select: {
      learnerId: true,
      assessmentPoolId: true,
      status: true,
      percentage: true,
      passed: true,
      gradedAt: true,
      submittedAt: true,
      attemptNumber: true,
      learner: {
        select: {
          id: true,
          learnerCode: true,
          fullName: true,
        },
      },
      assessmentPool: {
        select: {
          id: true,
          title: true,
        },
      },
    },
    orderBy: { submittedAt: "desc" },
  });

  // Group by learner + pool
  type GroupKey = string;
  const groups = new Map<GroupKey, typeof attempts>();
  for (const attempt of attempts) {
    const key = `${attempt.learnerId}:${attempt.assessmentPoolId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(attempt);
  }

  const allRows: LearnerPerformanceRow[] = Array.from(groups.entries()).map(([, groupAttempts]) => {
    const latest = groupAttempts[0];
    const scores = groupAttempts.filter((a) => a.percentage !== null).map((a) => a.percentage!);
    const gradedAttempts = groupAttempts.filter((a) => a.status === "GRADED");
    const latestGraded = gradedAttempts[0] ?? null;
    const lastPassed = gradedAttempts.find((a) => a.passed !== null);

    return {
      learnerId: latest.learner.id,
      learnerCode: latest.learner.learnerCode,
      learnerName: latest.learner.fullName,
      assessmentPoolId: latest.assessmentPool.id,
      assessmentTitle: latest.assessmentPool.title,
      attemptCount: groupAttempts.length,
      latestScore: latestGraded?.percentage ?? null,
      highestScore: scores.length > 0 ? Math.max(...scores) : null,
      passed: lastPassed?.passed ?? null,
      completionDate: latestGraded?.gradedAt?.toISOString() ?? null,
      status: latest.status,
    };
  });

  // Sort
  const sortKey = filters.sortBy;
  const sortDir = filters.sortDirection === "asc" ? 1 : -1;
  allRows.sort((a, b) => {
    switch (sortKey) {
      case "learnerName":
        return sortDir * a.learnerName.localeCompare(b.learnerName);
      case "latestScore":
        return sortDir * ((a.latestScore ?? -1) - (b.latestScore ?? -1));
      case "highestScore":
        return sortDir * ((a.highestScore ?? -1) - (b.highestScore ?? -1));
      case "attemptCount":
        return sortDir * (a.attemptCount - b.attemptCount);
      case "completionDate":
        return sortDir * ((a.completionDate ?? "").localeCompare(b.completionDate ?? ""));
      default:
        return 0;
    }
  });

  const totalCount = allRows.length;
  const pageCount = Math.ceil(totalCount / filters.pageSize);
  const start = (filters.page - 1) * filters.pageSize;
  const rows = allRows.slice(start, start + filters.pageSize);

  return { rows, totalCount, page: filters.page, pageSize: filters.pageSize, pageCount };
}

// ── 3. Question-Level Analytics ──────────────────────────────────────────────

export async function getQuestionAnalytics(
  filters: QuestionAnalyticsRequest,
): Promise<QuestionAnalyticsRow[]> {
  if (!isDatabaseConfigured) return [];

  const questions = await prisma.assessmentQuestion.findMany({
    where: {
      assessmentPoolId: filters.assessmentPoolId,
      ...(filters.questionType ? { questionType: filters.questionType as any } : {}),
    },
    select: {
      id: true,
      questionText: true,
      questionType: true,
      marks: true,
    },
    orderBy: { sortOrder: "asc" },
  });

  const results = await prisma.attemptQuestionResult.findMany({
    where: {
      assessmentPoolId: filters.assessmentPoolId,
      ...(filters.learnerId ? { learnerId: filters.learnerId } : {}),
    },
    select: {
      questionId: true,
      isCorrect: true,
      isSkipped: true,
      marksAwarded: true,
      submittedAnswer: true,
    },
  });

  const resultsByQuestion = new Map<string, typeof results>();
  for (const result of results) {
    if (!resultsByQuestion.has(result.questionId)) {
      resultsByQuestion.set(result.questionId, []);
    }
    resultsByQuestion.get(result.questionId)!.push(result);
  }

  return questions.map((question) => {
    const qResults = resultsByQuestion.get(question.id) ?? [];
    const answered = qResults.filter((r) => !r.isSkipped);
    const correct = answered.filter((r) => r.isCorrect === true).length;
    const incorrect = answered.filter((r) => r.isCorrect === false).length;
    const skipped = qResults.filter((r) => r.isSkipped).length;
    const totalMarks = answered.reduce((sum, r) => sum + r.marksAwarded, 0);
    const correctRate = safePercentage(correct, answered.length);
    const incorrectRate = safePercentage(incorrect, answered.length);

    // Find most selected wrong answer
    const wrongAnswers = answered.filter((r) => r.isCorrect === false);
    const answerCounts = new Map<string, number>();
    for (const wa of wrongAnswers) {
      const key = JSON.stringify(wa.submittedAnswer);
      answerCounts.set(key, (answerCounts.get(key) ?? 0) + 1);
    }
    let mostSelectedWrongAnswer: unknown = null;
    let maxCount = 0;
    for (const [answerKey, count] of answerCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        try {
          mostSelectedWrongAnswer = JSON.parse(answerKey);
        } catch {
          mostSelectedWrongAnswer = answerKey;
        }
      }
    }

    return {
      questionId: question.id,
      questionText: question.questionText,
      questionType: question.questionType,
      marks: question.marks,
      timesAnswered: answered.length,
      correctRate,
      incorrectRate,
      skippedCount: skipped,
      averageMarksEarned: answered.length > 0 ? roundToOneDecimal(totalMarks / answered.length) : 0,
      mostSelectedWrongAnswer,
      isLowSuccess: correctRate < filters.lowSuccessThreshold,
    };
  });
}

// ── 4. Pass / Fail Statistics ────────────────────────────────────────────────

export async function getPassFailStats(
  filters: AssessmentAnalyticsFilters,
): Promise<PassFailStats> {
  if (!isDatabaseConfigured) {
    return { passed: 0, failed: 0, pendingReview: 0, passedPercentage: 0, failedPercentage: 0, pendingPercentage: 0 };
  }

  const where = buildAttemptWhere(filters);

  const [passed, failed, pendingReview] = await Promise.all([
    prisma.assessmentAttempt.count({ where: { ...where, status: AssessmentAttemptStatus.GRADED, passed: true } }),
    prisma.assessmentAttempt.count({ where: { ...where, status: AssessmentAttemptStatus.GRADED, passed: false } }),
    prisma.assessmentAttempt.count({
      where: {
        ...where,
        status: { in: [AssessmentAttemptStatus.PENDING_REVIEW, AssessmentAttemptStatus.IN_REVIEW] },
      },
    }),
  ]);

  const total = passed + failed + pendingReview;

  return {
    passed,
    failed,
    pendingReview,
    passedPercentage: safePercentage(passed, total),
    failedPercentage: safePercentage(failed, total),
    pendingPercentage: safePercentage(pendingReview, total),
  };
}

// ── 5. Attempt Trend Analysis ────────────────────────────────────────────────

export async function getAttemptTrends(
  filters: TrendAnalysisRequest,
): Promise<TrendDataPoint[]> {
  if (!isDatabaseConfigured) return [];

  const where = buildAttemptWhere(filters);

  const attempts = await prisma.assessmentAttempt.findMany({
    where,
    select: {
      submittedAt: true,
      percentage: true,
      passed: true,
      status: true,
    },
    orderBy: { submittedAt: "asc" },
  });

  if (attempts.length === 0) return [];

  const buckets = new Map<string, { label: string; attempts: typeof attempts }>();

  for (const attempt of attempts) {
    const date = attempt.submittedAt;
    let key: string;
    let label: string;

    if (filters.granularity === "daily") {
      key = date.toISOString().slice(0, 10);
      label = date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    } else if (filters.granularity === "weekly") {
      const weekStart = new Date(date);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      key = weekStart.toISOString().slice(0, 10);
      label = `Week of ${weekStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
    } else {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      label = date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    }

    if (!buckets.has(key)) {
      buckets.set(key, { label, attempts: [] });
    }
    buckets.get(key)!.attempts.push(attempt);
  }

  return Array.from(buckets.entries()).map(([period, bucket]) => {
    const graded = bucket.attempts.filter((a) => a.status === "GRADED");
    const scores = graded.filter((a) => a.percentage !== null).map((a) => a.percentage!);
    const passed = graded.filter((a) => a.passed === true).length;

    return {
      period,
      label: bucket.label,
      attempts: bucket.attempts.length,
      averageScore: scores.length > 0 ? roundToOneDecimal(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      passRate: safePercentage(passed, graded.length),
    };
  });
}

// ── 6. Most Difficult Questions ──────────────────────────────────────────────

export async function getMostDifficultQuestions(
  filters: AssessmentAnalyticsFilters & { limit?: number },
): Promise<DifficultQuestion[]> {
  if (!isDatabaseConfigured) return [];

  const limit = filters.limit ?? 10;

  const results = await prisma.attemptQuestionResult.groupBy({
    by: ["questionId", "assessmentPoolId"],
    where: {
      ...(filters.assessmentPoolId ? { assessmentPoolId: filters.assessmentPoolId } : {}),
    },
    _count: { id: true },
  });

  // Get details for each question
  const questionIds = results.map((r) => r.questionId);
  if (questionIds.length === 0) return [];

  const questions = await prisma.assessmentQuestion.findMany({
    where: { id: { in: questionIds } },
    select: {
      id: true,
      questionText: true,
      questionType: true,
      assessmentPoolId: true,
      assessmentPool: {
        select: { title: true },
      },
    },
  });
  const questionMap = new Map(questions.map((q) => [q.id, q]));

  // Calculate stats per question
  const questionResults = await prisma.attemptQuestionResult.findMany({
    where: { questionId: { in: questionIds } },
    select: {
      questionId: true,
      isCorrect: true,
      isSkipped: true,
    },
  });

  const statsByQuestion = new Map<string, { correct: number; incorrect: number; skipped: number; total: number }>();
  for (const r of questionResults) {
    if (!statsByQuestion.has(r.questionId)) {
      statsByQuestion.set(r.questionId, { correct: 0, incorrect: 0, skipped: 0, total: 0 });
    }
    const stats = statsByQuestion.get(r.questionId)!;
    stats.total += 1;
    if (r.isSkipped) stats.skipped += 1;
    else if (r.isCorrect === true) stats.correct += 1;
    else if (r.isCorrect === false) stats.incorrect += 1;
  }

  const rows: DifficultQuestion[] = [];
  for (const [questionId, stats] of statsByQuestion.entries()) {
    const question = questionMap.get(questionId);
    if (!question) continue;

    const answered = stats.total - stats.skipped;
    rows.push({
      questionId,
      questionText: question.questionText,
      questionType: question.questionType,
      correctRate: safePercentage(stats.correct, answered),
      failRate: safePercentage(stats.incorrect, answered),
      skippedCount: stats.skipped,
      assessmentPoolId: question.assessmentPoolId,
      assessmentTitle: question.assessmentPool.title,
    });
  }

  // Sort by lowest correct rate
  rows.sort((a, b) => a.correctRate - b.correctRate);
  return rows.slice(0, limit);
}

// ── 7. Learner Comparison ────────────────────────────────────────────────────

export async function getLearnerComparison(
  filters: LearnerComparisonRequest,
): Promise<LearnerComparisonRow[]> {
  if (!isDatabaseConfigured) return [];

  const where: Prisma.AssessmentAttemptWhereInput = {
    learnerId: { in: filters.learnerIds },
    status: { not: AssessmentAttemptStatus.DRAFT },
    ...(filters.assessmentPoolId ? { assessmentPoolId: filters.assessmentPoolId } : {}),
    ...(filters.batchId ? { batchId: filters.batchId } : {}),
  };

  const attempts = await prisma.assessmentAttempt.findMany({
    where,
    select: {
      learnerId: true,
      percentage: true,
      passed: true,
      status: true,
      learner: {
        select: {
          id: true,
          learnerCode: true,
          fullName: true,
        },
      },
    },
  });

  const byLearner = new Map<string, typeof attempts>();
  for (const a of attempts) {
    if (!byLearner.has(a.learnerId)) byLearner.set(a.learnerId, []);
    byLearner.get(a.learnerId)!.push(a);
  }

  return filters.learnerIds.map((learnerId) => {
    const la = byLearner.get(learnerId) ?? [];
    const learner = la[0]?.learner ?? { id: learnerId, learnerCode: "", fullName: "" };
    const graded = la.filter((a) => a.status === "GRADED");
    const scores = graded.filter((a) => a.percentage !== null).map((a) => a.percentage!);

    return {
      learnerId: learner.id,
      learnerCode: learner.learnerCode,
      learnerName: learner.fullName,
      averageScore: scores.length > 0 ? roundToOneDecimal(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      totalAttempts: la.length,
      passedCount: graded.filter((a) => a.passed === true).length,
      failedCount: graded.filter((a) => a.passed === false).length,
    };
  });
}

// ── 8. Dashboard Widgets ─────────────────────────────────────────────────────

export async function getDashboardAnalyticsWidgets(
  filters: AssessmentAnalyticsFilters,
): Promise<DashboardAnalyticsWidgets> {
  if (!isDatabaseConfigured) {
    return { averageQuizScore: 0, passRate: 0, totalQuizAttempts: 0, pendingReviewCount: 0 };
  }

  const where = buildAttemptWhere(filters);

  const [allAttempts, gradedAttempts, passedCount, pendingReviewCount] = await Promise.all([
    prisma.assessmentAttempt.count({ where }),
    prisma.assessmentAttempt.findMany({
      where: { ...where, status: AssessmentAttemptStatus.GRADED },
      select: { percentage: true, passed: true },
    }),
    prisma.assessmentAttempt.count({ where: { ...where, status: AssessmentAttemptStatus.GRADED, passed: true } }),
    prisma.assessmentAttempt.count({
      where: {
        ...where,
        status: { in: [AssessmentAttemptStatus.PENDING_REVIEW, AssessmentAttemptStatus.IN_REVIEW] },
      },
    }),
  ]);

  const scores = gradedAttempts.filter((a) => a.percentage !== null).map((a) => a.percentage!);
  const averageQuizScore = scores.length > 0
    ? roundToOneDecimal(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  return {
    averageQuizScore,
    passRate: safePercentage(passedCount, gradedAttempts.length),
    totalQuizAttempts: allAttempts,
    pendingReviewCount,
  };
}
