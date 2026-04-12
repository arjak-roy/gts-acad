import { prisma } from "@/lib/prisma-client";
import { MOCK_TRAINERS } from "@/services/batches/mock-data";
import { BatchOption, BatchRecord, TrainerSummary } from "@/services/batches/types";
import { trainerHasCourseId } from "@/services/trainers/course-assignment-helpers";

export function normalizeTrainerIds(trainerIds: string[]) {
  return Array.from(new Set(trainerIds.map((trainerId) => trainerId.trim()).filter(Boolean)));
}

function normalizeCourseKey(courseName: string) {
  return courseName.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeTrainerSummaries(trainers: TrainerSummary[]) {
  const unique = new Map<string, TrainerSummary>();

  for (const trainer of trainers) {
    unique.set(trainer.id, trainer);
  }

  return Array.from(unique.values()).sort((left, right) => left.fullName.localeCompare(right.fullName));
}

function formatCentreAddress(batch: BatchRecord) {
  if (!batch.centre) {
    return null;
  }

  const parts = [
    batch.centre.addressLine1,
    batch.centre.addressLine2,
    batch.centre.landmark,
    batch.centre.location?.name,
    batch.centre.location?.state.name,
    batch.centre.location?.state.country.name,
    batch.centre.postalCode,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  return parts.length > 0 ? parts.join(", ") : null;
}

export function mapBatchRecord(batch: BatchRecord): BatchOption {
  const trainerSummaries = normalizeTrainerSummaries(batch.trainers.map((trainer) => ({ id: trainer.id, fullName: trainer.user.name })));
  const centreName = batch.centre?.name ?? batch.campus;

  return {
    id: batch.id,
    code: batch.code,
    name: batch.name,
    programName: batch.program.name,
    centreId: batch.centre?.id ?? null,
    campus: centreName,
    centreAddress: formatCentreAddress(batch),
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
      select: { id: true, name: true, slug: true, course: { select: { id: true, name: true } } },
    }),
    normalizedTrainerIds.length > 0
      ? prisma.trainerProfile.findMany({
          where: {
            id: {
              in: normalizedTrainerIds,
            },
          },
          include: {
            user: { select: { name: true } },
            courseAssignments: {
              select: {
                course: {
                  select: {
                    id: true,
                    name: true,
                    isActive: true,
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  if (!program) {
    throw new Error("Invalid program name.");
  }

  if (trainers.length !== normalizedTrainerIds.length) {
    throw new Error("Invalid trainer selection.");
  }

  if (
    trainers.some(
      (trainer) => !trainerHasCourseId(trainer, program.course.id),
    )
  ) {
    throw new Error("One or more selected trainers are not assigned to the selected course.");
  }

  return {
    program,
    courseId: program.course.id,
    courseName: program.course.name,
    trainerIds: normalizedTrainerIds,
  };
}

export async function resolveProgramAndTrainersWithAutoCourseMapping(programName: string, trainerIds: string[]) {
  const normalizedTrainerIds = normalizeTrainerIds(trainerIds);

  const [program, trainers] = await Promise.all([
    prisma.program.findFirst({
      where: { name: { equals: programName, mode: "insensitive" } },
      select: { id: true, name: true, slug: true, course: { select: { id: true, name: true } } },
    }),
    normalizedTrainerIds.length > 0
      ? prisma.trainerProfile.findMany({
          where: { id: { in: normalizedTrainerIds } },
          include: {
            user: { select: { name: true } },
            courseAssignments: {
              select: {
                course: {
                  select: {
                    id: true,
                    name: true,
                    isActive: true,
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  if (!program) {
    throw new Error("Invalid program name.");
  }

  if (trainers.length !== normalizedTrainerIds.length) {
    throw new Error("Invalid trainer selection.");
  }

  const trainersToAddToCourse = trainers.filter(
    (trainer) => !trainerHasCourseId(trainer, program.course.id),
  );

  return {
    program,
    courseId: program.course.id,
    courseName: program.course.name,
    trainerIds: normalizedTrainerIds,
    trainersToAddToCourse: trainersToAddToCourse.map((trainer) => trainer.id),
  };
}
