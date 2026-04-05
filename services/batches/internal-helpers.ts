import { prisma } from "@/lib/prisma-client";
import { MOCK_TRAINERS } from "@/services/batches/mock-data";
import { BatchOption, BatchRecord, TrainerSummary } from "@/services/batches/types";

export function normalizeTrainerIds(trainerIds: string[]) {
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

export function mapBatchRecord(batch: BatchRecord): BatchOption {
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

export function formatMockTrainerNames(trainerIds: string[]) {
  const trainerLookup = new Map(MOCK_TRAINERS.map((trainer) => [trainer.id, trainer.fullName]));
  return trainerIds.map((trainerId) => trainerLookup.get(trainerId)).filter((trainerName): trainerName is string => Boolean(trainerName));
}

export async function resolveProgramAndTrainers(programName: string, trainerIds: string[]) {
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

export async function resolveProgramAndTrainersWithAutoMapping(programName: string, trainerIds: string[]) {
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
    trainersToAddToProgram: trainersToAddToProgram.map((trainer) => trainer.id),
  };
}
