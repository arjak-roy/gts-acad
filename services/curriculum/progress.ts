import "server-only";

import { CurriculumProgressStatus } from "@prisma/client";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { getBatchCourseContext } from "@/services/lms/hierarchy";

type ProgressMutationRow = {
  learnerId: string;
  batchId: string;
  stageItemId: string;
  status: CurriculumProgressStatus;
  progressPercent?: number | null;
};

type ExistingProgressRecord = {
  id: string;
  learnerId: string;
  batchId: string;
  stageItemId: string;
  status: CurriculumProgressStatus;
  progressPercent: number;
  startedAt: Date | null;
  completedAt: Date | null;
};

type CurriculumItemProgressSnapshot = {
  stageItemId: string;
  status: CurriculumProgressStatus;
  progressPercent: number;
  startedAt: Date | null;
  completedAt: Date | null;
  lastActivityAt: Date;
};

function buildProgressKey(row: Pick<ProgressMutationRow, "learnerId" | "batchId" | "stageItemId">) {
  return `${row.learnerId}:${row.batchId}:${row.stageItemId}`;
}

function normalizeProgressPercent(value: number | null | undefined, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

function resolveProgressPayload(
  existing: ExistingProgressRecord | undefined,
  targetStatus: CurriculumProgressStatus,
  requestedProgressPercent: number | null | undefined,
  timestamp: Date,
) {
  if (existing?.status === "COMPLETED" && targetStatus !== "COMPLETED") {
    return {
      status: "COMPLETED" as const,
      progressPercent: 100,
      startedAt: existing.startedAt ?? existing.completedAt ?? timestamp,
      completedAt: existing.completedAt ?? timestamp,
      lastActivityAt: timestamp,
    };
  }

  if (targetStatus === "COMPLETED") {
    return {
      status: "COMPLETED" as const,
      progressPercent: 100,
      startedAt: existing?.startedAt ?? timestamp,
      completedAt: existing?.completedAt ?? timestamp,
      lastActivityAt: timestamp,
    };
  }

  if (targetStatus === "SKIPPED") {
    return {
      status: "SKIPPED" as const,
      progressPercent: normalizeProgressPercent(requestedProgressPercent, existing?.progressPercent ?? 0),
      startedAt: existing?.startedAt ?? null,
      completedAt: null,
      lastActivityAt: timestamp,
    };
  }

  if (targetStatus === "IN_PROGRESS") {
    return {
      status: "IN_PROGRESS" as const,
      progressPercent: normalizeProgressPercent(requestedProgressPercent, Math.max(existing?.progressPercent ?? 0, 50)),
      startedAt: existing?.startedAt ?? timestamp,
      completedAt: null,
      lastActivityAt: timestamp,
    };
  }

  return {
    status: "NOT_STARTED" as const,
    progressPercent: 0,
    startedAt: null,
    completedAt: null,
    lastActivityAt: timestamp,
  };
}

async function writeCurriculumProgressRows(rows: ProgressMutationRow[]): Promise<number> {
  if (!isDatabaseConfigured || rows.length === 0) {
    return 0;
  }

  const uniqueRows = Array.from(
    new Map(rows.map((row) => [buildProgressKey(row), row])).values(),
  );

  if (uniqueRows.length === 0) {
    return 0;
  }

  const existingRows = await prisma.learnerCurriculumItemProgress.findMany({
    where: {
      OR: uniqueRows.map((row) => ({
        learnerId: row.learnerId,
        batchId: row.batchId,
        stageItemId: row.stageItemId,
      })),
    },
    select: {
      id: true,
      learnerId: true,
      batchId: true,
      stageItemId: true,
      status: true,
      progressPercent: true,
      startedAt: true,
      completedAt: true,
    },
  });

  const existingByKey = new Map(existingRows.map((row) => [buildProgressKey(row), row]));
  const timestamp = new Date();

  await Promise.all(uniqueRows.map((row) => {
    const existing = existingByKey.get(buildProgressKey(row));
    const payload = resolveProgressPayload(existing, row.status, row.progressPercent, timestamp);

    if (existing) {
      return prisma.learnerCurriculumItemProgress.update({
        where: { id: existing.id },
        data: payload,
      });
    }

    return prisma.learnerCurriculumItemProgress.create({
      data: {
        learnerId: row.learnerId,
        batchId: row.batchId,
        stageItemId: row.stageItemId,
        ...payload,
      },
    });
  }));

  return uniqueRows.length;
}

export async function listCurriculumItemProgressForLearnerService(options: {
  learnerId: string;
  batchId: string;
  stageItemIds: string[];
}): Promise<CurriculumItemProgressSnapshot[]> {
  if (!isDatabaseConfigured || options.stageItemIds.length === 0) {
    return [];
  }

  return prisma.learnerCurriculumItemProgress.findMany({
    where: {
      learnerId: options.learnerId,
      batchId: options.batchId,
      stageItemId: {
        in: options.stageItemIds,
      },
    },
    select: {
      stageItemId: true,
      status: true,
      progressPercent: true,
      startedAt: true,
      completedAt: true,
      lastActivityAt: true,
    },
  });
}

export async function markCurriculumContentInProgressForLearnerService(options: {
  learnerId: string;
  batchIds: string[];
  contentId: string;
}): Promise<number> {
  if (!isDatabaseConfigured || options.batchIds.length === 0) {
    return 0;
  }

  const [batches, stageItems] = await Promise.all([
    prisma.batch.findMany({
      where: {
        id: {
          in: options.batchIds,
        },
      },
      select: {
        id: true,
        program: {
          select: {
            courseId: true,
          },
        },
      },
    }),
    prisma.curriculumStageItem.findMany({
      where: {
        contentId: options.contentId,
        stage: {
          module: {
            curriculum: {
              status: "PUBLISHED",
            },
          },
        },
      },
      select: {
        id: true,
        stage: {
          select: {
            module: {
              select: {
                curriculum: {
                  select: {
                    courseId: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const batchIdsByCourseId = new Map<string, string[]>();

  for (const batch of batches) {
    const current = batchIdsByCourseId.get(batch.program.courseId) ?? [];
    current.push(batch.id);
    batchIdsByCourseId.set(batch.program.courseId, current);
  }

  const rows = stageItems.flatMap((stageItem) => {
    const matchingBatchIds = batchIdsByCourseId.get(stageItem.stage.module.curriculum.courseId) ?? [];

    return matchingBatchIds.map<ProgressMutationRow>((batchId) => ({
      learnerId: options.learnerId,
      batchId,
      stageItemId: stageItem.id,
      status: "IN_PROGRESS",
      progressPercent: 50,
    }));
  });

  return writeCurriculumProgressRows(rows);
}

export async function markCurriculumAssessmentInProgressForLearnerService(options: {
  learnerId: string;
  batchId: string;
  assessmentPoolId: string;
}): Promise<number> {
  if (!isDatabaseConfigured) {
    return 0;
  }

  const batch = await getBatchCourseContext(options.batchId);

  if (!batch) {
    return 0;
  }

  const stageItems = await prisma.curriculumStageItem.findMany({
    where: {
      assessmentPoolId: options.assessmentPoolId,
      stage: {
        module: {
          curriculum: {
            courseId: batch.courseId,
            status: "PUBLISHED",
          },
        },
      },
    },
    select: {
      id: true,
    },
  });

  return writeCurriculumProgressRows(
    stageItems.map((stageItem) => ({
      learnerId: options.learnerId,
      batchId: options.batchId,
      stageItemId: stageItem.id,
      status: "IN_PROGRESS",
      progressPercent: 50,
    })),
  );
}

export async function markCurriculumAssessmentCompletedForLearnerService(options: {
  learnerId: string;
  batchId: string;
  assessmentPoolId: string;
}): Promise<number> {
  if (!isDatabaseConfigured) {
    return 0;
  }

  const batch = await getBatchCourseContext(options.batchId);

  if (!batch) {
    return 0;
  }

  const stageItems = await prisma.curriculumStageItem.findMany({
    where: {
      assessmentPoolId: options.assessmentPoolId,
      stage: {
        module: {
          curriculum: {
            courseId: batch.courseId,
            status: "PUBLISHED",
          },
        },
      },
    },
    select: {
      id: true,
    },
  });

  return writeCurriculumProgressRows(
    stageItems.map((stageItem) => ({
      learnerId: options.learnerId,
      batchId: options.batchId,
      stageItemId: stageItem.id,
      status: "COMPLETED",
      progressPercent: 100,
    })),
  );
}