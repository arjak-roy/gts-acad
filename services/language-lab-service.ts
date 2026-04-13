import "server-only";

import { Prisma } from "@prisma/client";

import type {
  LanguageLabAnalyticsAppliedFilters,
  LanguageLabAnalyticsFilterOption,
  LanguageLabAnalyticsFilterOptions,
  LanguageLabPronunciationAnalytics,
  LanguageLabRoleplayAnalytics,
  LanguageLabWordItem,
  LanguageLabWordProgressAnalytics,
} from "@/lib/language-lab/types";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import type {
  CreateLanguageLabWordInput,
  CreatePronunciationAttemptInput,
  CreateRoleplaySummaryInput,
  LanguageLabAnalyticsFiltersInput,
  ListLanguageLabWordsInput,
  UpdateLanguageLabWordInput,
} from "@/lib/validation-schemas/language-lab";
import { createAuditLogEntry } from "@/services/logs-actions-service";
import { AUDIT_ACTION_TYPE, AUDIT_ENTITY_TYPE } from "@/services/logs-actions/constants";

const languageLabWordSelect = {
  id: true,
  word: true,
  normalizedWord: true,
  englishMeaning: true,
  phonetic: true,
  difficulty: true,
  source: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      pronunciationAttempts: true,
    },
  },
  pronunciationAttempts: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: {
      createdAt: true,
    },
  },
} satisfies Prisma.LanguageLabWordSelect;

type LanguageLabWordRecord = Prisma.LanguageLabWordGetPayload<{ select: typeof languageLabWordSelect }>;

export type LanguageLabAttemptReceipt = {
  id: string;
  learnerId: string;
  batchId: string;
  managedWordId: string | null;
  createdAt: Date;
};

export type RoleplaySummaryReceipt = {
  id: string;
  learnerId: string;
  batchId: string;
  occurredAt: Date;
};

type CandidateLanguageLabContext = {
  learnerId: string;
  learnerCode: string;
  batchId: string;
  batchCode: string;
  batchName: string;
};

function normalizeLanguageLabWord(value: string) {
  return value.trim().toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, "").trim();
}

function trimToNull(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function trimOrDefault(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : fallback;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function serializeDate(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function roundToSingleDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function buildAppliedAnalyticsFilters(
  input: LanguageLabAnalyticsFiltersInput,
): LanguageLabAnalyticsAppliedFilters {
  return {
    search: input.search.trim(),
    batchId: trimToNull(input.batchId),
    learnerId: trimToNull(input.learnerId),
  };
}

function getJsonObject(
  value: Prisma.JsonValue | null | undefined,
): Record<string, Prisma.JsonValue> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, Prisma.JsonValue>;
}

function getJsonStringArray(value: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function getJsonNumberFromRecord(
  record: Record<string, Prisma.JsonValue> | null,
  key: string,
) {
  const value = record?.[key];
  return typeof value === "number" ? value : 0;
}

function getJsonBooleanFromRecord(
  record: Record<string, Prisma.JsonValue> | null,
  key: string,
) {
  const value = record?.[key];
  return typeof value === "boolean" ? value : false;
}

function getJsonStringFromRecord(
  record: Record<string, Prisma.JsonValue> | null,
  key: string,
) {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

async function buildLanguageLabAnalyticsFilterOptions(
  filters: LanguageLabAnalyticsAppliedFilters,
): Promise<LanguageLabAnalyticsFilterOptions> {
  const [batches, learners] = await Promise.all([
    prisma.batch.findMany({
      where: {
        OR: [
          { pronunciationAttempts: { some: {} } },
          { roleplays: { some: {} } },
          { enrollments: { some: { status: "ACTIVE" } } },
        ],
      },
      orderBy: [{ startDate: "desc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
      },
    }),
    prisma.learner.findMany({
      where: {
        OR: [
          { pronunciationAttempts: { some: filters.batchId ? { batchId: filters.batchId } : {} } },
          { roleplays: { some: filters.batchId ? { batchId: filters.batchId } : {} } },
          {
            enrollments: {
              some: {
                status: "ACTIVE",
                ...(filters.batchId ? { batchId: filters.batchId } : {}),
              },
            },
          },
        ],
      },
      orderBy: [{ fullName: "asc" }, { learnerCode: "asc" }],
      select: {
        id: true,
        fullName: true,
        learnerCode: true,
      },
    }),
  ]);

  const batchOptions: LanguageLabAnalyticsFilterOption[] = batches.map((batch) => ({
    value: batch.id,
    label: batch.name,
    detail: batch.code,
  }));

  const learnerOptions: LanguageLabAnalyticsFilterOption[] = learners.map((learner) => ({
    value: learner.id,
    label: learner.fullName,
    detail: learner.learnerCode,
  }));

  if (filters.batchId && !batchOptions.some((option) => option.value === filters.batchId)) {
    const selectedBatch = await prisma.batch.findUnique({
      where: { id: filters.batchId },
      select: { id: true, name: true, code: true },
    });

    if (selectedBatch) {
      batchOptions.unshift({
        value: selectedBatch.id,
        label: selectedBatch.name,
        detail: selectedBatch.code,
      });
    }
  }

  if (filters.learnerId && !learnerOptions.some((option) => option.value === filters.learnerId)) {
    const selectedLearner = await prisma.learner.findUnique({
      where: { id: filters.learnerId },
      select: { id: true, fullName: true, learnerCode: true },
    });

    if (selectedLearner) {
      learnerOptions.unshift({
        value: selectedLearner.id,
        label: selectedLearner.fullName,
        detail: selectedLearner.learnerCode,
      });
    }
  }

  return {
    batches: batchOptions,
    learners: learnerOptions,
  };
}

function buildPronunciationAttemptWhere(filters: LanguageLabAnalyticsAppliedFilters): Prisma.PronunciationAttemptWhereInput {
  const search = filters.search.trim();

  return {
    ...(filters.batchId ? { batchId: filters.batchId } : {}),
    ...(filters.learnerId ? { learnerId: filters.learnerId } : {}),
    ...(search
      ? {
          OR: [
            { targetWord: { contains: search, mode: "insensitive" } },
            { targetEnglish: { contains: search, mode: "insensitive" } },
            { targetPhonetic: { contains: search, mode: "insensitive" } },
            { learner: { is: { fullName: { contains: search, mode: "insensitive" } } } },
            { learner: { is: { learnerCode: { contains: search, mode: "insensitive" } } } },
            { batch: { is: { name: { contains: search, mode: "insensitive" } } } },
            { batch: { is: { code: { contains: search, mode: "insensitive" } } } },
            { managedWord: { is: { word: { contains: search, mode: "insensitive" } } } },
            { managedWord: { is: { englishMeaning: { contains: search, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
}

function buildRoleplayWhere(filters: LanguageLabAnalyticsAppliedFilters): Prisma.RoleplayWhereInput {
  const search = filters.search.trim();

  return {
    ...(filters.batchId ? { batchId: filters.batchId } : {}),
    ...(filters.learnerId ? { learnerId: filters.learnerId } : {}),
    ...(search
      ? {
          OR: [
            { scenarioName: { contains: search, mode: "insensitive" } },
            { learner: { is: { fullName: { contains: search, mode: "insensitive" } } } },
            { learner: { is: { learnerCode: { contains: search, mode: "insensitive" } } } },
            { batch: { is: { name: { contains: search, mode: "insensitive" } } } },
            { batch: { is: { code: { contains: search, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
}

function mapLanguageLabWord(record: LanguageLabWordRecord): LanguageLabWordItem {
  return {
    id: record.id,
    word: record.word,
    normalizedWord: record.normalizedWord,
    englishMeaning: record.englishMeaning,
    phonetic: record.phonetic,
    difficulty: record.difficulty,
    source: record.source,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    pronunciationAttemptsCount: record._count.pronunciationAttempts,
    lastPracticedAt: serializeDate(record.pronunciationAttempts[0]?.createdAt),
  };
}

async function resolveCandidateLanguageLabContext(candidateUserId: string, requestedBatchId?: string | null) {
  const learner = await prisma.learner.findFirst({
    where: { userId: candidateUserId },
    select: {
      id: true,
      learnerCode: true,
      enrollments: {
        where: {
          status: "ACTIVE",
          ...(requestedBatchId ? { batchId: requestedBatchId } : {}),
        },
        orderBy: { joinedAt: "desc" },
        take: 1,
        select: {
          batchId: true,
          batch: {
            select: {
              code: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!learner) {
    throw new Error("Candidate profile not found.");
  }

  const enrollment = learner.enrollments[0] ?? null;

  if (!enrollment) {
    if (requestedBatchId) {
      throw new Error("Candidate is not actively enrolled in the requested batch.");
    }

    throw new Error("Candidate has no active batch enrollment.");
  }

  return {
    learnerId: learner.id,
    learnerCode: learner.learnerCode,
    batchId: enrollment.batchId,
    batchCode: enrollment.batch.code,
    batchName: enrollment.batch.name,
  } satisfies CandidateLanguageLabContext;
}

async function ensureManagedWordForSubmission(input: {
  targetWord: string;
  targetEnglish?: string;
  targetPhonetic?: string;
  difficulty?: number;
}) {
  const normalizedWord = normalizeLanguageLabWord(input.targetWord);

  if (!normalizedWord) {
    return null;
  }

  const existing = await prisma.languageLabWord.findUnique({
    where: { normalizedWord },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  try {
    return await prisma.languageLabWord.create({
      data: {
        word: input.targetWord.trim(),
        normalizedWord,
        englishMeaning: trimToNull(input.targetEnglish),
        phonetic: trimToNull(input.targetPhonetic),
        difficulty: input.difficulty ?? 1,
        source: "candidate_submission",
        isActive: true,
      },
      select: { id: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return prisma.languageLabWord.findUnique({
        where: { normalizedWord },
        select: { id: true },
      });
    }

    throw error;
  }
}

function buildRoleplayScores(
  input: CreateRoleplaySummaryInput,
  context: CandidateLanguageLabContext,
) {
  const acceptedDeals = input.transactions.filter((transaction) => transaction.dealAccepted).length;
  const budgetRemainingEur = Number((input.budgetEur - input.totalSpentEur).toFixed(2));

  return {
    scenarioName: input.scenarioName,
    budgetEur: input.budgetEur,
    totalSpentEur: input.totalSpentEur,
    budgetRemainingEur,
    bagItems: input.bagItems,
    acceptedDeals,
    transactionCount: input.transactions.length,
    turnCount: input.conversationHistory.length,
    dealComplete: input.dealComplete,
    missionFailed: input.missionFailed,
    finalMessage: trimToNull(input.finalMessage),
    modelId: trimToNull(input.modelId),
    batchCode: context.batchCode,
    batchName: context.batchName,
    learnerCode: context.learnerCode,
    transactions: input.transactions,
    conversationHistory: input.conversationHistory,
    metadata: input.metadata ?? {},
  };
}

export async function listLanguageLabWordsService(
  filters: ListLanguageLabWordsInput = { search: "" },
): Promise<LanguageLabWordItem[]> {
  if (!isDatabaseConfigured) {
    return [];
  }

  const search = filters.search.trim();
  const where: Prisma.LanguageLabWordWhereInput = {
    ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
    ...(search
      ? {
          OR: [
            { word: { contains: search, mode: "insensitive" } },
            { englishMeaning: { contains: search, mode: "insensitive" } },
            { phonetic: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const words = await prisma.languageLabWord.findMany({
    where,
    orderBy: [{ isActive: "desc" }, { word: "asc" }],
    select: languageLabWordSelect,
  });

  return words.map(mapLanguageLabWord);
}

export async function getLanguageLabWordByIdService(wordId: string): Promise<LanguageLabWordItem | null> {
  if (!isDatabaseConfigured) {
    return null;
  }

  const word = await prisma.languageLabWord.findUnique({
    where: { id: wordId },
    select: languageLabWordSelect,
  });

  return word ? mapLanguageLabWord(word) : null;
}

export async function createLanguageLabWordService(
  input: CreateLanguageLabWordInput,
  options?: { actorUserId?: string | null },
): Promise<LanguageLabWordItem> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const word = input.word.trim();
  const normalizedWord = normalizeLanguageLabWord(word);

  if (!normalizedWord) {
    throw new Error("Word is invalid.");
  }

  const existing = await prisma.languageLabWord.findUnique({
    where: { normalizedWord },
    select: { id: true },
  });

  if (existing) {
    throw new Error("Language Lab word already exists.");
  }

  const created = await prisma.languageLabWord.create({
    data: {
      word,
      normalizedWord,
      englishMeaning: trimToNull(input.englishMeaning),
      phonetic: trimToNull(input.phonetic),
      difficulty: input.difficulty,
      source: trimOrDefault(input.source, "manual"),
      isActive: input.isActive,
    },
    select: languageLabWordSelect,
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.SYSTEM,
    entityId: created.id,
    action: AUDIT_ACTION_TYPE.CREATED,
    actorUserId: options?.actorUserId ?? null,
    message: `Language Lab word ${created.word} created.`,
    metadata: {
      domain: "LANGUAGE_LAB",
      normalizedWord: created.normalizedWord,
      source: created.source,
    },
  });

  return mapLanguageLabWord(created);
}

export async function updateLanguageLabWordService(
  wordId: string,
  input: UpdateLanguageLabWordInput,
  options?: { actorUserId?: string | null },
): Promise<LanguageLabWordItem> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  let nextWord: string | undefined;
  let nextNormalizedWord: string | undefined;

  if (input.word !== undefined) {
    nextWord = input.word.trim();
    nextNormalizedWord = normalizeLanguageLabWord(nextWord);

    if (!nextNormalizedWord) {
      throw new Error("Word is invalid.");
    }

    const existing = await prisma.languageLabWord.findFirst({
      where: {
        normalizedWord: nextNormalizedWord,
        NOT: { id: wordId },
      },
      select: { id: true },
    });

    if (existing) {
      throw new Error("Language Lab word already exists.");
    }
  }

  try {
    const updated = await prisma.languageLabWord.update({
      where: { id: wordId },
      data: {
        ...(nextWord !== undefined && nextNormalizedWord !== undefined
          ? { word: nextWord, normalizedWord: nextNormalizedWord }
          : {}),
        ...(input.englishMeaning !== undefined ? { englishMeaning: trimToNull(input.englishMeaning) } : {}),
        ...(input.phonetic !== undefined ? { phonetic: trimToNull(input.phonetic) } : {}),
        ...(input.difficulty !== undefined ? { difficulty: input.difficulty } : {}),
        ...(input.source !== undefined ? { source: trimOrDefault(input.source, "manual") } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      select: languageLabWordSelect,
    });

    await createAuditLogEntry({
      entityType: AUDIT_ENTITY_TYPE.SYSTEM,
      entityId: updated.id,
      action: AUDIT_ACTION_TYPE.UPDATED,
      actorUserId: options?.actorUserId ?? null,
      message: `Language Lab word ${updated.word} updated.`,
      metadata: {
        domain: "LANGUAGE_LAB",
        normalizedWord: updated.normalizedWord,
        source: updated.source,
        isActive: updated.isActive,
      },
    });

    return mapLanguageLabWord(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new Error("Language Lab word not found.");
    }

    throw error;
  }
}

export async function getLanguageLabWordProgressAnalyticsService(
  input: LanguageLabAnalyticsFiltersInput,
): Promise<LanguageLabWordProgressAnalytics> {
  const filters = buildAppliedAnalyticsFilters(input);

  if (!isDatabaseConfigured) {
    return {
      filters,
      filterOptions: { batches: [], learners: [] },
      overview: {
        catalogWordsCount: 0,
        activeWordsCount: 0,
        practicedWordsCount: 0,
        uniqueLearnersCount: 0,
        averageScore: null,
        lastPracticedAt: null,
      },
      rows: [],
    };
  }

  const search = filters.search;
  const wordWhere: Prisma.LanguageLabWordWhereInput = {
    ...(search
      ? {
          OR: [
            { word: { contains: search, mode: "insensitive" } },
            { englishMeaning: { contains: search, mode: "insensitive" } },
            { phonetic: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [filterOptions, words] = await Promise.all([
    buildLanguageLabAnalyticsFilterOptions(filters),
    prisma.languageLabWord.findMany({
      where: wordWhere,
      orderBy: [{ isActive: "desc" }, { word: "asc" }],
      select: {
        id: true,
        word: true,
        englishMeaning: true,
        phonetic: true,
        difficulty: true,
        source: true,
        isActive: true,
      },
    }),
  ]);

  if (words.length === 0) {
    return {
      filters,
      filterOptions,
      overview: {
        catalogWordsCount: 0,
        activeWordsCount: 0,
        practicedWordsCount: 0,
        uniqueLearnersCount: 0,
        averageScore: null,
        lastPracticedAt: null,
      },
      rows: [],
    };
  }

  const wordIds = words.map((word) => word.id);
  const attempts = await prisma.pronunciationAttempt.findMany({
    where: {
      ...(filters.batchId ? { batchId: filters.batchId } : {}),
      ...(filters.learnerId ? { learnerId: filters.learnerId } : {}),
      managedWordId: { in: wordIds },
    },
    orderBy: { createdAt: "desc" },
    select: {
      managedWordId: true,
      learnerId: true,
      overallScore: true,
      createdAt: true,
    },
  });

  const attemptsByWord = new Map<string, Array<{ learnerId: string; overallScore: number; createdAt: Date }>>();
  for (const attempt of attempts) {
    if (!attempt.managedWordId) {
      continue;
    }

    const current = attemptsByWord.get(attempt.managedWordId) ?? [];
    current.push({
      learnerId: attempt.learnerId,
      overallScore: attempt.overallScore,
      createdAt: attempt.createdAt,
    });
    attemptsByWord.set(attempt.managedWordId, current);
  }

  let totalScore = 0;
  let totalAttempts = 0;
  let lastPracticedAt: Date | null = null;
  const uniqueLearners = new Set<string>();

  const rows = words.map((word) => {
    const wordAttempts = attemptsByWord.get(word.id) ?? [];
    const attemptCount = wordAttempts.length;
    const learners = new Set<string>();
    let rowTotalScore = 0;
    let rowBestScore: number | null = null;
    let rowLatestScore: number | null = null;
    let rowLastPracticedAt: Date | null = null;

    for (const attempt of wordAttempts) {
      learners.add(attempt.learnerId);
      uniqueLearners.add(attempt.learnerId);
      rowTotalScore += attempt.overallScore;
      totalScore += attempt.overallScore;
      totalAttempts += 1;

      if (rowBestScore === null || attempt.overallScore > rowBestScore) {
        rowBestScore = attempt.overallScore;
      }

      if (!rowLastPracticedAt || attempt.createdAt > rowLastPracticedAt) {
        rowLastPracticedAt = attempt.createdAt;
        rowLatestScore = attempt.overallScore;
      }

      if (!lastPracticedAt || attempt.createdAt > lastPracticedAt) {
        lastPracticedAt = attempt.createdAt;
      }
    }

    return {
      wordId: word.id,
      word: word.word,
      englishMeaning: word.englishMeaning,
      phonetic: word.phonetic,
      difficulty: word.difficulty,
      source: word.source,
      isActive: word.isActive,
      attemptsCount: attemptCount,
      uniqueLearnersCount: learners.size,
      averageScore: attemptCount > 0 ? roundToSingleDecimal(rowTotalScore / attemptCount) : null,
      bestScore: rowBestScore,
      latestScore: rowLatestScore,
      lastPracticedAt: serializeDate(rowLastPracticedAt),
    };
  });

  rows.sort((left, right) => {
    if (left.isActive !== right.isActive) {
      return left.isActive ? -1 : 1;
    }

    if (right.attemptsCount !== left.attemptsCount) {
      return right.attemptsCount - left.attemptsCount;
    }

    if ((right.averageScore ?? -1) !== (left.averageScore ?? -1)) {
      return (right.averageScore ?? -1) - (left.averageScore ?? -1);
    }

    return left.word.localeCompare(right.word);
  });

  return {
    filters,
    filterOptions,
    overview: {
      catalogWordsCount: words.length,
      activeWordsCount: words.filter((word) => word.isActive).length,
      practicedWordsCount: rows.filter((row) => row.attemptsCount > 0).length,
      uniqueLearnersCount: uniqueLearners.size,
      averageScore: totalAttempts > 0 ? roundToSingleDecimal(totalScore / totalAttempts) : null,
      lastPracticedAt: serializeDate(lastPracticedAt),
    },
    rows,
  };
}

export async function getLanguageLabPronunciationAnalyticsService(
  input: LanguageLabAnalyticsFiltersInput,
): Promise<LanguageLabPronunciationAnalytics> {
  const filters = buildAppliedAnalyticsFilters(input);

  if (!isDatabaseConfigured) {
    return {
      filters,
      filterOptions: { batches: [], learners: [] },
      overview: {
        totalAttempts: 0,
        averageScore: null,
        lowScoreAttemptsCount: 0,
        uniqueLearnersCount: 0,
        uniqueWordsCount: 0,
        lastAttemptAt: null,
      },
      weakestWords: [],
      latestAttempts: [],
      priorityThemes: [],
      phonemeHotspots: [],
    };
  }

  const where = buildPronunciationAttemptWhere(filters);
  const [filterOptions, attempts] = await Promise.all([
    buildLanguageLabAnalyticsFilterOptions(filters),
    prisma.pronunciationAttempt.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        targetWord: true,
        targetEnglish: true,
        targetPhonetic: true,
        overallScore: true,
        heardText: true,
        strengths: true,
        priorities: true,
        nextTryInstruction: true,
        createdAt: true,
        learner: {
          select: {
            id: true,
            fullName: true,
            learnerCode: true,
          },
        },
        batch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        phonemeBreakdown: {
          select: {
            phoneme: true,
            status: true,
          },
        },
      },
    }),
  ]);

  const uniqueLearners = new Set<string>();
  const uniqueWords = new Set<string>();
  const priorityCounts = new Map<string, number>();
  const phonemeCounts = new Map<string, { incorrectCount: number; partialCount: number; correctCount: number }>();
  const wordStats = new Map<
    string,
    {
      word: string;
      englishMeaning: string | null;
      attemptsCount: number;
      totalScore: number;
      latestAttemptAt: Date | null;
      priorityCounts: Map<string, number>;
    }
  >();

  let totalScore = 0;
  let lowScoreAttemptsCount = 0;
  let lastAttemptAt: Date | null = null;

  for (const attempt of attempts) {
    uniqueLearners.add(attempt.learner.id);
    totalScore += attempt.overallScore;
    if (attempt.overallScore < 60) {
      lowScoreAttemptsCount += 1;
    }

    if (!lastAttemptAt || attempt.createdAt > lastAttemptAt) {
      lastAttemptAt = attempt.createdAt;
    }

    const normalizedWord = normalizeLanguageLabWord(attempt.targetWord);
    const wordKey = normalizedWord || `${attempt.id}:unknown`;
    uniqueWords.add(wordKey);

    const existingWord = wordStats.get(wordKey) ?? {
      word: attempt.targetWord,
      englishMeaning: trimToNull(attempt.targetEnglish),
      attemptsCount: 0,
      totalScore: 0,
      latestAttemptAt: null,
      priorityCounts: new Map<string, number>(),
    };

    existingWord.attemptsCount += 1;
    existingWord.totalScore += attempt.overallScore;
    if (!existingWord.latestAttemptAt || attempt.createdAt > existingWord.latestAttemptAt) {
      existingWord.latestAttemptAt = attempt.createdAt;
    }

    const priorities = getJsonStringArray(attempt.priorities);
    for (const priority of priorities) {
      priorityCounts.set(priority, (priorityCounts.get(priority) ?? 0) + 1);
      existingWord.priorityCounts.set(priority, (existingWord.priorityCounts.get(priority) ?? 0) + 1);
    }

    wordStats.set(wordKey, existingWord);

    for (const phoneme of attempt.phonemeBreakdown) {
      const key = phoneme.phoneme.trim();
      if (!key) {
        continue;
      }

      const current = phonemeCounts.get(key) ?? { incorrectCount: 0, partialCount: 0, correctCount: 0 };
      if (phoneme.status === "incorrect") {
        current.incorrectCount += 1;
      } else if (phoneme.status === "partial") {
        current.partialCount += 1;
      } else {
        current.correctCount += 1;
      }
      phonemeCounts.set(key, current);
    }
  }

  const weakestWords = Array.from(wordStats.values())
    .map((entry) => {
      const topPriority = Array.from(entry.priorityCounts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
      return {
        word: entry.word,
        englishMeaning: entry.englishMeaning,
        attemptsCount: entry.attemptsCount,
        averageScore: roundToSingleDecimal(entry.totalScore / entry.attemptsCount),
        latestAttemptAt: serializeDate(entry.latestAttemptAt),
        topPriority,
      };
    })
    .sort((left, right) => {
      if (left.averageScore !== right.averageScore) {
        return left.averageScore - right.averageScore;
      }

      return right.attemptsCount - left.attemptsCount;
    })
    .slice(0, 8);

  const latestAttempts = attempts.slice(0, 10).map((attempt) => ({
    id: attempt.id,
    learnerName: attempt.learner.fullName,
    learnerCode: attempt.learner.learnerCode,
    batchName: attempt.batch.name,
    batchCode: attempt.batch.code,
    word: attempt.targetWord,
    englishMeaning: trimToNull(attempt.targetEnglish),
    phonetic: trimToNull(attempt.targetPhonetic),
    score: attempt.overallScore,
    heardText: trimToNull(attempt.heardText),
    priorities: getJsonStringArray(attempt.priorities),
    strengths: getJsonStringArray(attempt.strengths),
    nextTryInstruction: trimToNull(attempt.nextTryInstruction),
    createdAt: attempt.createdAt.toISOString(),
  }));

  const priorityThemes = Array.from(priorityCounts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);

  const phonemeHotspots = Array.from(phonemeCounts.entries())
    .map(([phoneme, counts]) => ({ phoneme, ...counts }))
    .sort((left, right) => {
      const leftIssueCount = left.incorrectCount + left.partialCount;
      const rightIssueCount = right.incorrectCount + right.partialCount;
      return rightIssueCount - leftIssueCount;
    })
    .slice(0, 8);

  return {
    filters,
    filterOptions,
    overview: {
      totalAttempts: attempts.length,
      averageScore: attempts.length > 0 ? roundToSingleDecimal(totalScore / attempts.length) : null,
      lowScoreAttemptsCount,
      uniqueLearnersCount: uniqueLearners.size,
      uniqueWordsCount: uniqueWords.size,
      lastAttemptAt: serializeDate(lastAttemptAt),
    },
    weakestWords,
    latestAttempts,
    priorityThemes,
    phonemeHotspots,
  };
}

export async function getLanguageLabRoleplayAnalyticsService(
  input: LanguageLabAnalyticsFiltersInput,
): Promise<LanguageLabRoleplayAnalytics> {
  const filters = buildAppliedAnalyticsFilters(input);

  if (!isDatabaseConfigured) {
    return {
      filters,
      filterOptions: { batches: [], learners: [] },
      overview: {
        totalSessions: 0,
        completionRate: 0,
        averageSpendEur: 0,
        averageTurns: 0,
        uniqueLearnersCount: 0,
        lastOccurredAt: null,
      },
      scenarioBreakdown: [],
      learnerHighlights: [],
      latestSessions: [],
    };
  }

  const where = buildRoleplayWhere(filters);
  const [filterOptions, roleplays] = await Promise.all([
    buildLanguageLabAnalyticsFilterOptions(filters),
    prisma.roleplay.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      select: {
        id: true,
        scenarioName: true,
        occurredAt: true,
        scores: true,
        learner: {
          select: {
            id: true,
            fullName: true,
            learnerCode: true,
          },
        },
        batch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    }),
  ]);

  const uniqueLearners = new Set<string>();
  const scenarioStats = new Map<
    string,
    { sessionsCount: number; completedCount: number; totalSpendEur: number; totalTurns: number; lastOccurredAt: Date | null }
  >();
  const learnerStats = new Map<
    string,
    {
      learnerId: string;
      learnerName: string;
      learnerCode: string;
      batchName: string;
      batchCode: string;
      sessionsCount: number;
      completedCount: number;
      totalSpendEur: number;
      lastOccurredAt: Date | null;
    }
  >();

  let completedCount = 0;
  let totalSpendEur = 0;
  let totalTurns = 0;
  let lastOccurredAt: Date | null = null;

  const latestSessions: LanguageLabRoleplayAnalytics["latestSessions"] = [];

  for (const roleplay of roleplays) {
    const scoreRecord = getJsonObject(roleplay.scores);
    const session = {
      id: roleplay.id,
      scenarioName:
        trimToNull(roleplay.scenarioName) ??
        getJsonStringFromRecord(scoreRecord, "scenarioName") ??
        "Bread Shop",
      learnerName: roleplay.learner.fullName,
      learnerCode: roleplay.learner.learnerCode,
      batchName: roleplay.batch.name,
      batchCode: roleplay.batch.code,
      budgetEur: getJsonNumberFromRecord(scoreRecord, "budgetEur"),
      totalSpentEur: getJsonNumberFromRecord(scoreRecord, "totalSpentEur"),
      acceptedDeals: getJsonNumberFromRecord(scoreRecord, "acceptedDeals"),
      transactionCount: getJsonNumberFromRecord(scoreRecord, "transactionCount"),
      turnCount: getJsonNumberFromRecord(scoreRecord, "turnCount"),
      dealComplete: getJsonBooleanFromRecord(scoreRecord, "dealComplete"),
      missionFailed: getJsonBooleanFromRecord(scoreRecord, "missionFailed"),
      occurredAt: roleplay.occurredAt.toISOString(),
    };

    if (latestSessions.length < 10) {
      latestSessions.push(session);
    }

    uniqueLearners.add(roleplay.learner.id);
    totalSpendEur += session.totalSpentEur;
    totalTurns += session.turnCount;
    if (session.dealComplete) {
      completedCount += 1;
    }

    if (!lastOccurredAt || roleplay.occurredAt > lastOccurredAt) {
      lastOccurredAt = roleplay.occurredAt;
    }

    const currentScenario = scenarioStats.get(session.scenarioName) ?? {
      sessionsCount: 0,
      completedCount: 0,
      totalSpendEur: 0,
      totalTurns: 0,
      lastOccurredAt: null,
    };
    currentScenario.sessionsCount += 1;
    currentScenario.completedCount += session.dealComplete ? 1 : 0;
    currentScenario.totalSpendEur += session.totalSpentEur;
    currentScenario.totalTurns += session.turnCount;
    if (!currentScenario.lastOccurredAt || roleplay.occurredAt > currentScenario.lastOccurredAt) {
      currentScenario.lastOccurredAt = roleplay.occurredAt;
    }
    scenarioStats.set(session.scenarioName, currentScenario);

    const learnerKey = `${roleplay.learner.id}:${roleplay.batch.id}`;
    const currentLearner = learnerStats.get(learnerKey) ?? {
      learnerId: roleplay.learner.id,
      learnerName: roleplay.learner.fullName,
      learnerCode: roleplay.learner.learnerCode,
      batchName: roleplay.batch.name,
      batchCode: roleplay.batch.code,
      sessionsCount: 0,
      completedCount: 0,
      totalSpendEur: 0,
      lastOccurredAt: null,
    };
    currentLearner.sessionsCount += 1;
    currentLearner.completedCount += session.dealComplete ? 1 : 0;
    currentLearner.totalSpendEur += session.totalSpentEur;
    if (!currentLearner.lastOccurredAt || roleplay.occurredAt > currentLearner.lastOccurredAt) {
      currentLearner.lastOccurredAt = roleplay.occurredAt;
    }
    learnerStats.set(learnerKey, currentLearner);
  }

  const scenarioBreakdown = Array.from(scenarioStats.entries())
    .map(([scenarioName, entry]) => ({
      scenarioName,
      sessionsCount: entry.sessionsCount,
      completionRate: roundToSingleDecimal((entry.completedCount / entry.sessionsCount) * 100),
      averageSpendEur: roundToSingleDecimal(entry.totalSpendEur / entry.sessionsCount),
      averageTurns: roundToSingleDecimal(entry.totalTurns / entry.sessionsCount),
      lastOccurredAt: serializeDate(entry.lastOccurredAt),
    }))
    .sort((left, right) => right.sessionsCount - left.sessionsCount)
    .slice(0, 8);

  const learnerHighlights = Array.from(learnerStats.values())
    .map((entry) => ({
      learnerId: entry.learnerId,
      learnerName: entry.learnerName,
      learnerCode: entry.learnerCode,
      batchName: entry.batchName,
      batchCode: entry.batchCode,
      sessionsCount: entry.sessionsCount,
      completionRate: roundToSingleDecimal((entry.completedCount / entry.sessionsCount) * 100),
      averageSpendEur: roundToSingleDecimal(entry.totalSpendEur / entry.sessionsCount),
      latestOccurredAt: serializeDate(entry.lastOccurredAt),
    }))
    .sort((left, right) => {
      if (right.sessionsCount !== left.sessionsCount) {
        return right.sessionsCount - left.sessionsCount;
      }

      return right.completionRate - left.completionRate;
    })
    .slice(0, 8);

  return {
    filters,
    filterOptions,
    overview: {
      totalSessions: roleplays.length,
      completionRate: roleplays.length > 0 ? roundToSingleDecimal((completedCount / roleplays.length) * 100) : 0,
      averageSpendEur: roleplays.length > 0 ? roundToSingleDecimal(totalSpendEur / roleplays.length) : 0,
      averageTurns: roleplays.length > 0 ? roundToSingleDecimal(totalTurns / roleplays.length) : 0,
      uniqueLearnersCount: uniqueLearners.size,
      lastOccurredAt: serializeDate(lastOccurredAt),
    },
    scenarioBreakdown,
    learnerHighlights,
    latestSessions,
  };
}

export async function recordPronunciationAttemptService(
  candidateUserId: string,
  input: CreatePronunciationAttemptInput,
): Promise<LanguageLabAttemptReceipt> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const context = await resolveCandidateLanguageLabContext(candidateUserId, input.batchId ?? null);
  const managedWord = await ensureManagedWordForSubmission({
    targetWord: input.targetWord,
    targetEnglish: input.targetEnglish,
    targetPhonetic: input.targetPhonetic,
    difficulty: input.difficulty,
  });

  const attempt = await prisma.pronunciationAttempt.create({
    data: {
      managedWordId: managedWord?.id ?? null,
      learnerId: context.learnerId,
      batchId: context.batchId,
      source: trimOrDefault(input.source, "pronunciation_lesson"),
      modelId: trimToNull(input.modelId),
      targetWord: input.targetWord.trim(),
      targetEnglish: trimToNull(input.targetEnglish),
      targetPhonetic: trimToNull(input.targetPhonetic),
      overallScore: input.overallScore,
      heardText: trimToNull(input.heardText),
      strengths: toJsonValue(input.strengths),
      priorities: toJsonValue(input.priorities),
      nextTryInstruction: trimToNull(input.nextTryInstruction),
      metadata: toJsonValue({
        ...(input.metadata ?? {}),
        batchCode: context.batchCode,
        batchName: context.batchName,
        learnerCode: context.learnerCode,
      }),
      phonemeBreakdown: {
        create: input.phonemeBreakdown.map((phoneme, index) => ({
          sortOrder: index,
          phoneme: phoneme.phoneme,
          status: phoneme.status,
          observed: trimToNull(phoneme.observed),
          lipShape: trimToNull(phoneme.lipShape),
          tip: trimToNull(phoneme.tip),
          startMs: phoneme.startMs,
          endMs: phoneme.endMs,
        })),
      },
    },
    select: {
      id: true,
      learnerId: true,
      batchId: true,
      managedWordId: true,
      createdAt: true,
    },
  });

  return attempt;
}

export async function recordRoleplaySummaryService(
  candidateUserId: string,
  input: CreateRoleplaySummaryInput,
): Promise<RoleplaySummaryReceipt> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const context = await resolveCandidateLanguageLabContext(candidateUserId, input.batchId ?? null);
  const roleplay = await prisma.roleplay.create({
    data: {
      batchId: context.batchId,
      learnerId: context.learnerId,
      scenarioName: trimOrDefault(input.scenarioName, "Bread Shop"),
      scores: toJsonValue(buildRoleplayScores(input, context)),
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined,
    },
    select: {
      id: true,
      learnerId: true,
      batchId: true,
      occurredAt: true,
    },
  });

  return roleplay;
}