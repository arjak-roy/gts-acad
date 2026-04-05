import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { mapBatchRecord } from "@/services/batches/internal-helpers";
import { MOCK_BATCHES } from "@/services/batches/mock-data";
import { BatchOption } from "@/services/batches/types";

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

export async function getBatchesForProgramService(programName: string): Promise<BatchOption[]> {
  const normalizedProgramName = programName.trim();

  if (!isDatabaseConfigured) {
    return MOCK_BATCHES.filter((batch) => batch.programName.toLowerCase() === normalizedProgramName.toLowerCase());
  }

  const program = await prisma.program.findFirst({
    where: { name: { equals: normalizedProgramName, mode: "insensitive" } },
    select: { id: true },
  });

  if (!program) {
    return [];
  }

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
