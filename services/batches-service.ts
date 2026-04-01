import "server-only";

import { BatchMode, BatchStatus } from "@prisma/client";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { CreateBatchInput, UpdateBatchInput } from "@/lib/validation-schemas/batches";

type TrainerSummary = {
  id: string;
  fullName: string;
};

type BatchRecord = {
  id: string;
  code: string;
  name: string;
  campus: string | null;
  status: BatchStatus;
  startDate: Date;
  endDate: Date | null;
  capacity: number;
  mode: BatchMode;
  schedule: string[];
  program: { name: string };
  trainer: { id: string; user: { name: string } } | null;
  trainers: Array<{ id: string; user: { name: string } }>;
};

export type BatchOption = {
  id: string;
  code: string;
  name: string;
  programName: string;
  campus: string | null;
  status: BatchStatus;
  trainerIds: string[];
  trainerNames: string[];
  startDate?: string;
  endDate?: string | null;
  capacity?: number;
  mode?: BatchMode;
  schedule?: string[];
};

export type BatchCreateResult = {
  id: string;
  code: string;
  name: string;
  programName: string;
  campus: string | null;
  startDate: string;
  endDate: string | null;
  capacity: number;
  mode: BatchMode;
  status: BatchStatus;
  trainerIds: string[];
  trainerNames: string[];
};

const MOCK_TRAINERS: TrainerSummary[] = [
  { id: "mock-trainer-1", fullName: "Dr. Markus Stein" },
  { id: "mock-trainer-2", fullName: "Dr. Leena Pillai" },
];

const MOCK_BATCHES: BatchOption[] = [
  {
    id: "mock-batch-1",
    code: "B-GER-NOV",
    name: "German B1 November Cohort",
    programName: "German Language B1",
    campus: "Main Campus",
    status: "IN_SESSION",
    trainerIds: ["mock-trainer-1", "mock-trainer-2"],
    trainerNames: ["Dr. Markus Stein", "Dr. Leena Pillai"],
    startDate: new Date("2026-01-05T08:00:00Z").toISOString(),
    endDate: new Date("2026-06-05T08:00:00Z").toISOString(),
    capacity: 25,
    mode: "OFFLINE",
    schedule: ["MON", "TUE", "WED", "THU", "FRI"],
  },
  {
    id: "mock-batch-2",
    code: "B-CLI-OCT",
    name: "Clinical Bridging October Cohort",
    programName: "Clinical Bridging",
    campus: "South Wing",
    status: "IN_SESSION",
    trainerIds: [],
    trainerNames: [],
    startDate: new Date("2026-02-01T09:00:00Z").toISOString(),
    endDate: new Date("2026-06-01T09:00:00Z").toISOString(),
    capacity: 20,
    mode: "OFFLINE",
    schedule: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
  },
];

function normalizeTrainerIds(trainerIds: string[]) {
  return Array.from(new Set(trainerIds.map((trainerId) => trainerId.trim()).filter(Boolean)));
}

function normalizeProgramKey(programName: string) {
  return programName.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeTrainerSummaries(trainers: TrainerSummary[]) {
  const unique = new Map<string, TrainerSummary>();

  for (const trainer of trainers) {
    unique.set(trainer.id, trainer);
  }

  return Array.from(unique.values()).sort((left, right) => left.fullName.localeCompare(right.fullName));
}

function mapBatchRecord(batch: BatchRecord): BatchOption {
  const trainerSummaries = normalizeTrainerSummaries(batch.trainers.map((trainer) => ({ id: trainer.id, fullName: trainer.user.name })));

  return {
    id: batch.id,
    code: batch.code,
    name: batch.name,
    programName: batch.program.name,
    campus: batch.campus,
    status: batch.status,
    trainerIds: trainerSummaries.map((trainer) => trainer.id),
    trainerNames: trainerSummaries.map((trainer) => trainer.fullName),
    startDate: batch.startDate.toISOString(),
    endDate: batch.endDate?.toISOString() ?? null,
    capacity: batch.capacity,
    mode: batch.mode,
    schedule: batch.schedule,
  };
}

function formatMockTrainerNames(trainerIds: string[]) {
  const trainerLookup = new Map(MOCK_TRAINERS.map((trainer) => [trainer.id, trainer.fullName]));
  return trainerIds.map((trainerId) => trainerLookup.get(trainerId)).filter((trainerName): trainerName is string => Boolean(trainerName));
}

async function resolveProgramAndTrainers(programName: string, trainerIds: string[]) {
  const normalizedTrainerIds = normalizeTrainerIds(trainerIds);

  const [program, trainers] = await Promise.all([
    prisma.program.findFirst({
      where: { name: { equals: programName, mode: "insensitive" } },
      select: { id: true, name: true, slug: true },
    }),
    normalizedTrainerIds.length > 0
      ? prisma.trainerProfile.findMany({
          where: {
            id: {
              in: normalizedTrainerIds,
            },
          },
          include: { user: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);

  if (!program) {
    throw new Error("Invalid program name.");
  }

  if (trainers.length !== normalizedTrainerIds.length) {
    throw new Error("Invalid trainer selection.");
  }

  const allowedProgramKeys = new Set(
    [program.name, program.slug, program.id]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value))
      .map((value) => normalizeProgramKey(value)),
  );

  if (
    trainers.some(
      (trainer) =>
        !trainer.programs.some((assignedProgram) => {
          const normalizedAssignedProgram = normalizeProgramKey(assignedProgram);
          return allowedProgramKeys.has(normalizedAssignedProgram);
        }),
    )
  ) {
    throw new Error("One or more selected trainers are not assigned to the selected program.");
  }

  return {
    program,
    trainerIds: normalizedTrainerIds,
  };
}

/**
 * Resolves program and trainers, automatically mapping trainers to the program if needed.
 * Unlike resolveProgramAndTrainers, this allows trainers not yet assigned to the program.
 */
async function resolveProgramAndTrainersWithAutoMapping(programName: string, trainerIds: string[]) {
  const normalizedTrainerIds = normalizeTrainerIds(trainerIds);

  const [program, trainers] = await Promise.all([
    prisma.program.findFirst({
      where: { name: { equals: programName, mode: "insensitive" } },
      select: { id: true, name: true, slug: true },
    }),
    normalizedTrainerIds.length > 0
      ? prisma.trainerProfile.findMany({
          where: { id: { in: normalizedTrainerIds } },
          include: { user: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);

  if (!program) {
    throw new Error("Invalid program name.");
  }

  if (trainers.length !== normalizedTrainerIds.length) {
    throw new Error("Invalid trainer selection.");
  }

  const allowedProgramKeys = new Set(
    [program.name, program.slug, program.id]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value))
      .map((value) => normalizeProgramKey(value)),
  );

  // Identify trainers that need to be added to the program
  const trainersToAddToProgram = trainers.filter(
    (trainer) =>
      !trainer.programs.some((assignedProgram) => {
        const normalizedAssignedProgram = normalizeProgramKey(assignedProgram);
        return allowedProgramKeys.has(normalizedAssignedProgram);
      }),
  );

  return {
    program,
    trainerIds: normalizedTrainerIds,
    trainersToAddToProgram: trainersToAddToProgram.map((t) => t.id),
  };
}

export async function listBatchesService(programName?: string): Promise<BatchOption[]> {
  const normalizedProgramName = programName?.trim();

  if (!isDatabaseConfigured) {
    return MOCK_BATCHES.filter((batch) =>
      normalizedProgramName ? batch.programName.toLowerCase() === normalizedProgramName.toLowerCase() : true,
    );
  }

  try {
    return await prisma.batch
      .findMany({
        where: normalizedProgramName
          ? {
              program: {
                name: {
                  equals: normalizedProgramName,
                  mode: "insensitive",
                },
              },
            }
          : undefined,
        orderBy: [{ startDate: "desc" }, { code: "asc" }],
        select: {
          id: true,
          code: true,
          name: true,
          campus: true,
          status: true,
          startDate: true,
          endDate: true,
          capacity: true,
          mode: true,
          schedule: true,
          trainer: {
            select: {
              id: true,
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
          trainers: {
            select: {
              id: true,
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
          program: {
            select: {
              name: true,
            },
          },
        },
      })
      .then((batches) => batches.map(mapBatchRecord));
  } catch (error) {
    console.warn("Batch list fallback activated", error);
    return MOCK_BATCHES.filter((batch) =>
      normalizedProgramName ? batch.programName.toLowerCase() === normalizedProgramName.toLowerCase() : true,
    );
  }
}

const BATCH_SEARCH_SELECT = {
  id: true,
  code: true,
  name: true,
  campus: true,
  status: true,
  startDate: true,
  endDate: true,
  capacity: true,
  mode: true,
  schedule: true,
  trainer: { select: { id: true, user: { select: { name: true } } } },
  trainers: { select: { id: true, user: { select: { name: true } } } },
  program: { select: { name: true } },
} as const;

export async function searchBatchesService(query: string, limit: number): Promise<BatchOption[]> {
  const normalizedQuery = query.trim().toLowerCase();

  if (!isDatabaseConfigured) {
    return MOCK_BATCHES.filter(
      (batch) =>
        batch.code.toLowerCase().includes(normalizedQuery) ||
        batch.name.toLowerCase().includes(normalizedQuery) ||
        (batch.campus ?? "").toLowerCase().includes(normalizedQuery) ||
        batch.programName.toLowerCase().includes(normalizedQuery) ||
        batch.trainerNames.some((name) => name.toLowerCase().includes(normalizedQuery)),
    ).slice(0, limit);
  }

  try {
    return await prisma.batch
      .findMany({
        where: {
          OR: [
            { code: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
            { campus: { contains: query, mode: "insensitive" } },
            { program: { name: { contains: query, mode: "insensitive" } } },
            { trainer: { user: { name: { contains: query, mode: "insensitive" } } } },
            { trainers: { some: { user: { name: { contains: query, mode: "insensitive" } } } } },
          ],
        },
        orderBy: [{ startDate: "desc" }, { code: "asc" }],
        take: limit,
        select: BATCH_SEARCH_SELECT,
      })
      .then((batches) => batches.map(mapBatchRecord));
  } catch (error) {
    console.warn("Batch search fallback activated", error);
    return MOCK_BATCHES.filter(
      (batch) =>
        batch.code.toLowerCase().includes(normalizedQuery) ||
        batch.name.toLowerCase().includes(normalizedQuery) ||
        (batch.campus ?? "").toLowerCase().includes(normalizedQuery) ||
        batch.programName.toLowerCase().includes(normalizedQuery) ||
        batch.trainerNames.some((name) => name.toLowerCase().includes(normalizedQuery)),
    ).slice(0, limit);
  }
}

export async function getBatchByIdService(batchId: string): Promise<BatchOption | null> {
  if (!isDatabaseConfigured) {
    return MOCK_BATCHES.find((batch) => batch.id === batchId) ?? null;
  }

  try {
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: {
        program: { select: { name: true } },
        trainer: {
          select: {
            id: true,
            user: { select: { name: true } },
          },
        },
        trainers: {
          select: {
            id: true,
            user: { select: { name: true } },
          },
        },
      },
    });

    return batch ? mapBatchRecord(batch) : null;
  } catch (error) {
    console.warn("Batch detail fallback activated", error);
    return MOCK_BATCHES.find((batch) => batch.id === batchId) ?? null;
  }
}

export async function generateBatchCode(programName: string): Promise<string> {
  // Extract 3-letter prefix from program name (e.g., "German" -> "GER")
  const prefix = programName.substring(0, 3).toUpperCase();

  if (!isDatabaseConfigured) {
    // Mock generation for non-database environments
    return `B-${prefix}-001`;
  }

  // Find the last batch with this prefix
  const lastBatch = await prisma.batch.findFirst({
    where: { code: { startsWith: `B-${prefix}-` } },
    orderBy: { code: "desc" },
    select: { code: true },
  });

  // Increment counter
  let number = 1;
  if (lastBatch) {
    const match = lastBatch.code.match(/-(\d+)$/);
    number = match ? parseInt(match[1], 10) + 1 : 1;
  }

  // Return formatted code: B-GER-001, B-GER-002, etc.
  return `B-${prefix}-${String(number).padStart(3, "0")}`;
}

export async function createBatchService(input: CreateBatchInput): Promise<BatchCreateResult> {
  const normalizedName = input.name.trim();
  const normalizedProgramName = input.programName.trim();
  const normalizedTrainerIds = normalizeTrainerIds(input.trainerIds);
  const normalizedCampus = input.campus.trim() || null;
  const startDate = new Date(input.startDate);
  const endDate = input.endDate.trim() ? new Date(input.endDate) : null;

  // Auto-generate batch code if empty
  let normalizedCode = input.code.trim().toUpperCase();
  if (!normalizedCode || normalizedCode.length === 0) {
    normalizedCode = await generateBatchCode(normalizedProgramName);
  }

  if (Number.isNaN(startDate.getTime())) {
    throw new Error("Invalid start date.");
  }

  if (endDate && Number.isNaN(endDate.getTime())) {
    throw new Error("Invalid end date.");
  }

  if (!isDatabaseConfigured) {
    return {
      id: `mock-${Date.now()}`,
      code: normalizedCode,
      name: normalizedName,
      programName: normalizedProgramName,
      campus: normalizedCampus,
      startDate: startDate.toISOString(),
      endDate: endDate?.toISOString() ?? null,
      capacity: input.capacity,
      mode: input.mode,
      status: input.status,
      trainerIds: normalizedTrainerIds,
      trainerNames: formatMockTrainerNames(normalizedTrainerIds),
    };
  }

  const [existingCode, resolved] = await Promise.all([
    prisma.batch.findUnique({ where: { code: normalizedCode }, select: { id: true } }),
    resolveProgramAndTrainersWithAutoMapping(normalizedProgramName, normalizedTrainerIds),
  ]);

  if (existingCode) {
    throw new Error("Batch code already exists.");
  }

  // AUTO-MAP TRAINERS TO PROGRAM if needed
  if (resolved.trainersToAddToProgram.length > 0) {
    await Promise.all(
      resolved.trainersToAddToProgram.map((trainerId) =>
        prisma.trainerProfile.update({
          where: { id: trainerId },
          data: {
            programs: {
              push: normalizedProgramName,
            },
          },
        }),
      ),
    );
  }

  const batch = await prisma.batch.create({
    data: {
      code: normalizedCode,
      name: normalizedName,
      programId: resolved.program.id,
      campus: normalizedCampus,
      startDate,
      endDate,
      capacity: input.capacity,
      mode: input.mode,
      schedule: input.schedule,
      status: input.status,
      trainerId: resolved.trainerIds[0] ?? null,
      trainers: resolved.trainerIds.length > 0 ? { connect: resolved.trainerIds.map((trainerId) => ({ id: trainerId })) } : undefined,
    },
    include: {
      program: { select: { name: true } },
      trainer: {
        select: {
          id: true,
          user: { select: { name: true } },
        },
      },
      trainers: {
        select: {
          id: true,
          user: { select: { name: true } },
        },
      },
    },
  });

  const mapped = mapBatchRecord(batch);

  return {
    id: mapped.id,
    code: mapped.code,
    name: mapped.name,
    programName: mapped.programName,
    campus: mapped.campus,
    startDate: mapped.startDate ?? startDate.toISOString(),
    endDate: mapped.endDate ?? null,
    capacity: mapped.capacity ?? input.capacity,
    mode: mapped.mode ?? input.mode,
    status: mapped.status,
    trainerIds: mapped.trainerIds,
    trainerNames: mapped.trainerNames,
  };
}

export async function updateBatchService(input: UpdateBatchInput): Promise<BatchCreateResult> {
  const normalizedBatchId = input.batchId.trim();
  const normalizedCode = input.code.trim().toUpperCase();
  const normalizedName = input.name.trim();
  const normalizedProgramName = input.programName.trim();
  const normalizedTrainerIds = normalizeTrainerIds(input.trainerIds);
  const normalizedCampus = input.campus.trim() || null;
  const startDate = new Date(input.startDate);
  const endDate = input.endDate.trim() ? new Date(input.endDate) : null;

  if (Number.isNaN(startDate.getTime())) {
    throw new Error("Invalid start date.");
  }

  if (endDate && Number.isNaN(endDate.getTime())) {
    throw new Error("Invalid end date.");
  }

  if (!isDatabaseConfigured) {
    return {
      id: normalizedBatchId,
      code: normalizedCode,
      name: normalizedName,
      programName: normalizedProgramName,
      campus: normalizedCampus,
      startDate: startDate.toISOString(),
      endDate: endDate?.toISOString() ?? null,
      capacity: input.capacity,
      mode: input.mode,
      status: input.status,
      trainerIds: normalizedTrainerIds,
      trainerNames: formatMockTrainerNames(normalizedTrainerIds),
    };
  }

  const existingBatch = await prisma.batch.findUnique({ where: { id: normalizedBatchId }, select: { id: true } });
  if (!existingBatch) {
    throw new Error("Batch not found.");
  }

  const [duplicateCode, resolved] = await Promise.all([
    prisma.batch.findFirst({ where: { code: normalizedCode, NOT: { id: normalizedBatchId } }, select: { id: true } }),
    resolveProgramAndTrainersWithAutoMapping(normalizedProgramName, normalizedTrainerIds),
  ]);

  if (duplicateCode) {
    throw new Error("Batch code already exists.");
  }

  // AUTO-MAP TRAINERS TO PROGRAM if needed
  if (resolved.trainersToAddToProgram.length > 0) {
    await Promise.all(
      resolved.trainersToAddToProgram.map((trainerId) =>
        prisma.trainerProfile.update({
          where: { id: trainerId },
          data: {
            programs: {
              push: normalizedProgramName,
            },
          },
        }),
      ),
    );
  }

  const batch = await prisma.batch.update({
    where: { id: normalizedBatchId },
    data: {
      code: normalizedCode,
      name: normalizedName,
      programId: resolved.program.id,
      trainerId: resolved.trainerIds[0] ?? null,
      trainers: { set: resolved.trainerIds.map((trainerId) => ({ id: trainerId })) },
      campus: normalizedCampus,
      startDate,
      endDate,
      mode: input.mode,
      status: input.status,
      capacity: input.capacity,
      schedule: input.schedule,
    },
    include: {
      program: { select: { name: true } },
      trainer: {
        select: {
          id: true,
          user: { select: { name: true } },
        },
      },
      trainers: {
        select: {
          id: true,
          user: { select: { name: true } },
        },
      },
    },
  });

  const mapped = mapBatchRecord(batch);

  return {
    id: mapped.id,
    code: mapped.code,
    name: mapped.name,
    programName: mapped.programName,
    campus: mapped.campus,
    startDate: mapped.startDate ?? startDate.toISOString(),
    endDate: mapped.endDate ?? null,
    capacity: mapped.capacity ?? input.capacity,
    mode: mapped.mode ?? input.mode,
    status: mapped.status,
    trainerIds: mapped.trainerIds,
    trainerNames: mapped.trainerNames,
  };
}

export async function archiveBatchService(batchId: string): Promise<BatchOption> {
  const normalizedBatchId = batchId.trim();

  if (!isDatabaseConfigured) {
    const batch = MOCK_BATCHES.find((item) => item.id === normalizedBatchId);
    if (!batch) {
      throw new Error("Batch not found.");
    }

    return {
      ...batch,
      status: "ARCHIVED",
    };
  }

  const batch = await prisma.batch.update({
    where: { id: normalizedBatchId },
    data: { status: "ARCHIVED" },
    include: {
      program: { select: { name: true } },
      trainer: {
        select: {
          id: true,
          user: { select: { name: true } },
        },
      },
      trainers: {
        select: {
          id: true,
          user: { select: { name: true } },
        },
      },
    },
  });

  return mapBatchRecord(batch);
}

export async function getBatchesForProgramService(programName: string): Promise<BatchOption[]> {
  const normalizedProgramName = programName.trim();

  if (!isDatabaseConfigured) {
    return MOCK_BATCHES.filter((b) => b.programName.toLowerCase() === normalizedProgramName.toLowerCase());
  }

  const program = await prisma.program.findFirst({
    where: { name: { equals: normalizedProgramName, mode: "insensitive" } },
    select: { id: true },
  });

  if (!program) return [];

  const batches = await prisma.batch.findMany({
    where: { programId: program.id },
    include: {
      program: { select: { name: true } },
      trainer: { select: { id: true, user: { select: { name: true } } } },
      trainers: { select: { id: true, user: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return batches.map((batch) => mapBatchRecord(batch));
}