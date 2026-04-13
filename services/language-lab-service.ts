import "server-only";

import { Prisma } from "@prisma/client";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import type {
  CreateLanguageLabWordInput,
  CreatePronunciationAttemptInput,
  CreateRoleplaySummaryInput,
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

export type LanguageLabWordItem = {
  id: string;
  word: string;
  normalizedWord: string;
  englishMeaning: string | null;
  phonetic: string | null;
  difficulty: number;
  source: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  pronunciationAttemptsCount: number;
  lastPracticedAt: Date | null;
};

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
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    pronunciationAttemptsCount: record._count.pronunciationAttempts,
    lastPracticedAt: record.pronunciationAttempts[0]?.createdAt ?? null,
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