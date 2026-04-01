import "server-only";

import { ProgramType } from "@prisma/client";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { CreateProgramInput, UpdateProgramInput } from "@/lib/validation-schemas/programs";

export type ProgramOption = {
  id: string;
  name: string;
  type: ProgramType;
  isActive: boolean;
};

export type ProgramCreateResult = {
  id: string;
  slug: string;
  name: string;
  type: ProgramType;
  durationWeeks: number;
  category: string | null;
  description: string | null;
  isActive: boolean;
};

export type ProgramDetail = {
  id: string;
  slug: string;
  name: string;
  type: ProgramType;
  durationWeeks: number;
  category: string | null;
  description: string | null;
  isActive: boolean;
};

const MOCK_PROGRAMS: ProgramOption[] = [
  {
    id: "mock-program-1",
    name: "German Language B1",
    type: "LANGUAGE",
    isActive: true,
  },
  {
    id: "mock-program-2",
    name: "Clinical Bridging",
    type: "CLINICAL",
    isActive: true,
  },
];

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 120);
}

async function resolveUniqueSlug(baseSlug: string) {
  const seed = baseSlug || `program-${Date.now()}`;
  let attempt = 0;

  while (attempt < 20) {
    const slug = attempt === 0 ? seed : `${seed}-${attempt + 1}`;
    const existing = await prisma.program.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) {
      return slug;
    }
    attempt += 1;
  }

  throw new Error("Unable to generate unique program slug.");
}

export async function listProgramsService(): Promise<ProgramOption[]> {
  if (!isDatabaseConfigured) {
    return MOCK_PROGRAMS;
  }

  try {
    return await prisma.program.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        type: true,
        isActive: true,
      },
    });
  } catch (error) {
    console.warn("Program list fallback activated", error);
    return MOCK_PROGRAMS;
  }
}

export async function searchProgramsService(query: string, limit: number): Promise<ProgramOption[]> {
  const normalizedQuery = query.trim().toLowerCase();

  if (!isDatabaseConfigured) {
    return MOCK_PROGRAMS.filter(
      (program) =>
        program.name.toLowerCase().includes(normalizedQuery) ||
        program.type.toLowerCase().includes(normalizedQuery),
    ).slice(0, limit);
  }

  try {
    return await prisma.program.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { category: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      take: limit,
      select: {
        id: true,
        name: true,
        type: true,
        isActive: true,
      },
    });
  } catch (error) {
    console.warn("Program search fallback activated", error);
    return MOCK_PROGRAMS.filter(
      (program) =>
        program.name.toLowerCase().includes(normalizedQuery) ||
        program.type.toLowerCase().includes(normalizedQuery),
    ).slice(0, limit);
  }
}

export async function getProgramByIdService(programId: string): Promise<ProgramDetail | null> {
  if (!isDatabaseConfigured) {
    const mock = MOCK_PROGRAMS.find((program) => program.id === programId);
    if (!mock) {
      return null;
    }

    return {
      id: mock.id,
      slug: slugify(mock.name),
      name: mock.name,
      type: mock.type,
      durationWeeks: 24,
      category: null,
      description: null,
      isActive: mock.isActive,
    };
  }

  try {
    return await prisma.program.findUnique({
      where: { id: programId },
      select: {
        id: true,
        slug: true,
        name: true,
        type: true,
        durationWeeks: true,
        category: true,
        description: true,
        isActive: true,
      },
    });
  } catch (error) {
    console.warn("Program detail fallback activated", error);
    return null;
  }
}

export async function updateProgramService(input: UpdateProgramInput): Promise<ProgramCreateResult> {
  const normalizedName = input.name.trim();
  const normalizedCategory = input.category.trim() || null;
  const normalizedDescription = input.description.trim() || null;
  const selectedTrainerIds = input.trainerIds ? Array.from(new Set(input.trainerIds.map((trainerId) => trainerId.trim()).filter(Boolean))) : null;
  const selectedBatchIds = input.batchIds ? Array.from(new Set(input.batchIds.map((batchId) => batchId.trim()).filter(Boolean))) : null;

  if (!isDatabaseConfigured) {
    return {
      id: input.programId,
      slug: slugify(normalizedName) || `program-${Date.now()}`,
      name: normalizedName,
      type: input.type,
      durationWeeks: input.durationWeeks,
      category: normalizedCategory,
      description: normalizedDescription,
      isActive: input.isActive,
    };
  }

  const existingProgram = await prisma.program.findUnique({
    where: { id: input.programId },
    select: { id: true, name: true, slug: true },
  });

  if (!existingProgram) {
    throw new Error("Program not found.");
  }

  const duplicateName = await prisma.program.findFirst({
    where: {
      id: { not: input.programId },
      name: { equals: normalizedName, mode: "insensitive" },
    },
    select: { id: true },
  });

  if (duplicateName) {
    throw new Error("Program name already exists.");
  }

  const nextSlug =
    normalizedName.toLowerCase() === existingProgram.name.toLowerCase()
      ? existingProgram.slug
      : await resolveUniqueSlug(slugify(normalizedName));

  if (!selectedTrainerIds && !selectedBatchIds) {
    return prisma.program.update({
      where: { id: input.programId },
      data: {
        slug: nextSlug,
        name: normalizedName,
        type: input.type,
        durationWeeks: input.durationWeeks,
        category: normalizedCategory,
        description: normalizedDescription,
        isActive: input.isActive,
      },
      select: {
        id: true,
        slug: true,
        name: true,
        type: true,
        durationWeeks: true,
        category: true,
        description: true,
        isActive: true,
      },
    });
  }

  return prisma.$transaction(async (tx) => {
    if (selectedTrainerIds) {
      const [selectedTrainers, currentlyAssigned] = await Promise.all([
        selectedTrainerIds.length
          ? tx.trainerProfile.findMany({
              where: { id: { in: selectedTrainerIds } },
              select: { id: true, programs: true },
            })
          : Promise.resolve([]),
        tx.trainerProfile.findMany({
          where: {
            OR: [
              { programs: { has: existingProgram.name } },
              { programs: { has: normalizedName } },
            ],
          },
          select: { id: true, programs: true },
        }),
      ]);

      if (selectedTrainers.length !== selectedTrainerIds.length) {
        throw new Error("One or more selected trainers were not found.");
      }

      const selectedSet = new Set(selectedTrainerIds);
      const touched = new Map<string, string[]>();

      for (const trainer of currentlyAssigned) {
        touched.set(trainer.id, trainer.programs);
      }

      for (const trainer of selectedTrainers) {
        if (!touched.has(trainer.id)) {
          touched.set(trainer.id, trainer.programs);
        }
      }

      const oldProgramLower = existingProgram.name.toLowerCase();
      const newProgramLower = normalizedName.toLowerCase();

      for (const [trainerId, trainerPrograms] of touched.entries()) {
        const filteredPrograms = trainerPrograms.filter((program) => {
          const lowerProgram = program.trim().toLowerCase();
          return lowerProgram !== oldProgramLower && lowerProgram !== newProgramLower;
        });

        if (selectedSet.has(trainerId)) {
          filteredPrograms.push(normalizedName);
        }

        await tx.trainerProfile.update({
          where: { id: trainerId },
          data: {
            programs: filteredPrograms,
          },
        });
      }
    }

    const updatedProgram = await tx.program.update({
      where: { id: input.programId },
      data: {
        slug: nextSlug,
        name: normalizedName,
        type: input.type,
        durationWeeks: input.durationWeeks,
        category: normalizedCategory,
        description: normalizedDescription,
        isActive: input.isActive,
      },
      select: {
        id: true,
        slug: true,
        name: true,
        type: true,
        durationWeeks: true,
        category: true,
        description: true,
        isActive: true,
      },
    });

    if (selectedBatchIds) {
      if (selectedBatchIds.length > 0) {
        const selectedBatches = await tx.batch.findMany({
          where: { id: { in: selectedBatchIds } },
          select: { id: true },
        });

        if (selectedBatches.length !== selectedBatchIds.length) {
          throw new Error("One or more selected batches were not found.");
        }

        await tx.batch.updateMany({
          where: { id: { in: selectedBatchIds } },
          data: { programId: updatedProgram.id },
        });
      }
    }

    return updatedProgram;
  });
}

export async function archiveProgramService(programId: string): Promise<ProgramOption> {
  if (!isDatabaseConfigured) {
    const mock = MOCK_PROGRAMS.find((program) => program.id === programId);
    if (!mock) {
      throw new Error("Program not found.");
    }

    return {
      ...mock,
      isActive: false,
    };
  }

  return prisma.program.update({
    where: { id: programId },
    data: { isActive: false },
    select: {
      id: true,
      name: true,
      type: true,
      isActive: true,
    },
  });
}

export async function createProgramService(input: CreateProgramInput): Promise<ProgramCreateResult> {
  const normalizedName = input.name.trim();
  const normalizedCategory = input.category.trim() || null;
  const normalizedDescription = input.description.trim() || null;
  const selectedTrainerIds = Array.from(new Set((input.trainerIds ?? []).map((trainerId) => trainerId.trim()).filter(Boolean)));
  const selectedBatchIds = Array.from(new Set((input.batchIds ?? []).map((batchId) => batchId.trim()).filter(Boolean)));

  if (!isDatabaseConfigured) {
    return {
      id: `mock-${Date.now()}`,
      slug: slugify(normalizedName) || `program-${Date.now()}`,
      name: normalizedName,
      type: input.type,
      durationWeeks: input.durationWeeks,
      category: normalizedCategory,
      description: normalizedDescription,
      isActive: input.isActive,
    };
  }

  const existingName = await prisma.program.findFirst({
    where: { name: { equals: normalizedName, mode: "insensitive" } },
    select: { id: true },
  });

  if (existingName) {
    throw new Error("Program name already exists.");
  }

  const slug = await resolveUniqueSlug(slugify(normalizedName));

  return prisma.$transaction(async (tx) => {
    const program = await tx.program.create({
      data: {
        slug,
        name: normalizedName,
        type: input.type,
        durationWeeks: input.durationWeeks,
        category: normalizedCategory,
        description: normalizedDescription,
        isActive: input.isActive,
      },
      select: {
        id: true,
        slug: true,
        name: true,
        type: true,
        durationWeeks: true,
        category: true,
        description: true,
        isActive: true,
      },
    });

    if (selectedTrainerIds.length > 0) {
      const trainers = await tx.trainerProfile.findMany({
        where: { id: { in: selectedTrainerIds } },
        select: { id: true, programs: true },
      });

      if (trainers.length !== selectedTrainerIds.length) {
        throw new Error("One or more selected trainers were not found.");
      }

      const normalizedProgramName = normalizedName.toLowerCase();

      await Promise.all(
        trainers.map((trainer) => {
          const hasProgram = trainer.programs.some((programName) => programName.trim().toLowerCase() === normalizedProgramName);
          if (hasProgram) {
            return Promise.resolve();
          }

          return tx.trainerProfile.update({
            where: { id: trainer.id },
            data: {
              programs: {
                push: normalizedName,
              },
            },
          });
        }),
      );
    }

    if (selectedBatchIds.length > 0) {
      const batches = await tx.batch.findMany({
        where: { id: { in: selectedBatchIds } },
        select: { id: true },
      });

      if (batches.length !== selectedBatchIds.length) {
        throw new Error("One or more selected batches were not found.");
      }

      await tx.batch.updateMany({
        where: { id: { in: selectedBatchIds } },
        data: { programId: program.id },
      });
    }

    return program;
  });
}
