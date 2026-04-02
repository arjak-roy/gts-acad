import "server-only";

import { ProgramType } from "@prisma/client";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { CreateProgramInput, UpdateProgramInput } from "@/lib/validation-schemas/programs";

export type ProgramOption = {
  id: string;
  courseId: string;
  courseName: string;
  name: string;
  type: ProgramType;
  isActive: boolean;
};

export type ProgramCreateResult = {
  id: string;
  courseId: string;
  courseName: string;
  slug: string;
  name: string;
  type: ProgramType;
  durationWeeks: number;
  category: string | null;
  description: string | null;
  isActive: boolean;
};

export type ProgramDetail = ProgramCreateResult;

type ProgramRecord = {
  id: string;
  courseId: string;
  slug: string;
  name: string;
  type: ProgramType;
  durationWeeks: number;
  category: string | null;
  description: string | null;
  isActive: boolean;
  course: {
    name: string;
  };
};

type ProgramSummaryRecord = {
  id: string;
  courseId: string;
  name: string;
  type: ProgramType;
  isActive: boolean;
  course: {
    name: string;
  };
};

const MOCK_PROGRAMS: ProgramCreateResult[] = [
  {
    id: "mock-program-1",
    courseId: "mock-course-language",
    courseName: "Language Career Track",
    slug: "german-language-b1",
    name: "German Language B1",
    type: "LANGUAGE",
    durationWeeks: 20,
    category: "Language",
    description: "Language preparation curriculum.",
    isActive: true,
  },
  {
    id: "mock-program-2",
    courseId: "mock-course-clinical",
    courseName: "Clinical Career Track",
    slug: "clinical-bridging",
    name: "Clinical Bridging",
    type: "CLINICAL",
    durationWeeks: 16,
    category: "Clinical",
    description: "Clinical transition curriculum.",
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

function mapProgramOption(program: ProgramCreateResult): ProgramOption {
  return {
    id: program.id,
    courseId: program.courseId,
    courseName: program.courseName,
    name: program.name,
    type: program.type,
    isActive: program.isActive,
  };
}

function mapProgramSummaryRecord(program: ProgramSummaryRecord): ProgramOption {
  return {
    id: program.id,
    courseId: program.courseId,
    courseName: program.course.name,
    name: program.name,
    type: program.type,
    isActive: program.isActive,
  };
}

function mapProgramRecord(program: ProgramRecord): ProgramCreateResult {
  return {
    id: program.id,
    courseId: program.courseId,
    courseName: program.course.name,
    slug: program.slug,
    name: program.name,
    type: program.type,
    durationWeeks: program.durationWeeks,
    category: program.category,
    description: program.description,
    isActive: program.isActive,
  };
}

function selectProgramRecord() {
  return {
    id: true,
    courseId: true,
    slug: true,
    name: true,
    type: true,
    durationWeeks: true,
    category: true,
    description: true,
    isActive: true,
    course: { select: { name: true } },
  } as const;
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

async function requireCourse(courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, name: true },
  });

  if (!course) {
    throw new Error("Invalid course selection.");
  }

  return course;
}

export async function listProgramsService(courseId?: string): Promise<ProgramOption[]> {
  const normalizedCourseId = courseId?.trim();

  if (!isDatabaseConfigured) {
    return (normalizedCourseId ? MOCK_PROGRAMS.filter((program) => program.courseId === normalizedCourseId) : MOCK_PROGRAMS).map(mapProgramOption);
  }

  try {
    const programs = await prisma.program.findMany({
      where: normalizedCourseId ? { courseId: normalizedCourseId } : undefined,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        courseId: true,
        name: true,
        type: true,
        isActive: true,
        course: { select: { name: true } },
      },
    });

    return programs.map(mapProgramSummaryRecord);
  } catch (error) {
    console.warn("Program list fallback activated", error);
    return (normalizedCourseId ? MOCK_PROGRAMS.filter((program) => program.courseId === normalizedCourseId) : MOCK_PROGRAMS).map(mapProgramOption);
  }
}

export async function searchProgramsService(query: string, limit: number): Promise<ProgramOption[]> {
  const normalizedQuery = query.trim().toLowerCase();

  if (!isDatabaseConfigured) {
    return MOCK_PROGRAMS.filter(
      (program) =>
        program.name.toLowerCase().includes(normalizedQuery) ||
        program.type.toLowerCase().includes(normalizedQuery) ||
        program.courseName.toLowerCase().includes(normalizedQuery),
    )
      .slice(0, limit)
      .map(mapProgramOption);
  }

  try {
    const programs = await prisma.program.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { category: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { course: { name: { contains: query, mode: "insensitive" } } },
        ],
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      take: limit,
      select: {
        id: true,
        courseId: true,
        name: true,
        type: true,
        isActive: true,
        course: { select: { name: true } },
      },
    });

    return programs.map(mapProgramSummaryRecord);
  } catch (error) {
    console.warn("Program search fallback activated", error);
    return MOCK_PROGRAMS.filter(
      (program) =>
        program.name.toLowerCase().includes(normalizedQuery) ||
        program.type.toLowerCase().includes(normalizedQuery) ||
        program.courseName.toLowerCase().includes(normalizedQuery),
    )
      .slice(0, limit)
      .map(mapProgramOption);
  }
}

export async function getProgramByIdService(programId: string): Promise<ProgramDetail | null> {
  if (!isDatabaseConfigured) {
    return MOCK_PROGRAMS.find((program) => program.id === programId) ?? null;
  }

  try {
    const program = await prisma.program.findUnique({
      where: { id: programId },
      select: selectProgramRecord(),
    });

    return program ? mapProgramRecord(program) : null;
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
    const courseName = MOCK_PROGRAMS.find((program) => program.courseId === input.courseId)?.courseName ?? "Assigned Course";
    return {
      id: input.programId,
      courseId: input.courseId,
      courseName,
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

  const [duplicateName, nextCourse] = await Promise.all([
    prisma.program.findFirst({
      where: {
        id: { not: input.programId },
        name: { equals: normalizedName, mode: "insensitive" },
      },
      select: { id: true },
    }),
    requireCourse(input.courseId),
  ]);

  if (duplicateName) {
    throw new Error("Program name already exists.");
  }

  const nextSlug =
    normalizedName.toLowerCase() === existingProgram.name.toLowerCase()
      ? existingProgram.slug
      : await resolveUniqueSlug(slugify(normalizedName));

  if (!selectedTrainerIds && !selectedBatchIds) {
    const program = await prisma.program.update({
      where: { id: input.programId },
      data: {
        courseId: nextCourse.id,
        slug: nextSlug,
        name: normalizedName,
        type: input.type,
        durationWeeks: input.durationWeeks,
        category: normalizedCategory,
        description: normalizedDescription,
        isActive: input.isActive,
      },
      select: selectProgramRecord(),
    });

    return mapProgramRecord(program);
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
            OR: [{ programs: { has: existingProgram.name } }, { programs: { has: normalizedName } }],
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
          data: { programs: filteredPrograms },
        });
      }
    }

    const updatedProgram = await tx.program.update({
      where: { id: input.programId },
      data: {
        courseId: nextCourse.id,
        slug: nextSlug,
        name: normalizedName,
        type: input.type,
        durationWeeks: input.durationWeeks,
        category: normalizedCategory,
        description: normalizedDescription,
        isActive: input.isActive,
      },
      select: selectProgramRecord(),
    });

    if (selectedBatchIds && selectedBatchIds.length > 0) {
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

    return mapProgramRecord(updatedProgram);
  });
}

export async function archiveProgramService(programId: string): Promise<ProgramOption> {
  if (!isDatabaseConfigured) {
    const mock = MOCK_PROGRAMS.find((program) => program.id === programId);
    if (!mock) {
      throw new Error("Program not found.");
    }

    return {
      id: mock.id,
      courseId: mock.courseId,
      courseName: mock.courseName,
      name: mock.name,
      type: mock.type,
      isActive: false,
    };
  }

  const program = await prisma.program.update({
    where: { id: programId },
    data: { isActive: false },
    select: {
      id: true,
      courseId: true,
      name: true,
      type: true,
      isActive: true,
      course: { select: { name: true } },
    },
  });

  return mapProgramSummaryRecord(program);
}

export async function createProgramService(input: CreateProgramInput): Promise<ProgramCreateResult> {
  const normalizedName = input.name.trim();
  const normalizedCategory = input.category.trim() || null;
  const normalizedDescription = input.description.trim() || null;
  const selectedTrainerIds = Array.from(new Set((input.trainerIds ?? []).map((trainerId) => trainerId.trim()).filter(Boolean)));
  const selectedBatchIds = Array.from(new Set((input.batchIds ?? []).map((batchId) => batchId.trim()).filter(Boolean)));

  if (!isDatabaseConfigured) {
    const courseName = MOCK_PROGRAMS.find((program) => program.courseId === input.courseId)?.courseName ?? "Assigned Course";
    return {
      id: `mock-${Date.now()}`,
      courseId: input.courseId,
      courseName,
      slug: slugify(normalizedName) || `program-${Date.now()}`,
      name: normalizedName,
      type: input.type,
      durationWeeks: input.durationWeeks,
      category: normalizedCategory,
      description: normalizedDescription,
      isActive: input.isActive,
    };
  }

  const [existingName, course] = await Promise.all([
    prisma.program.findFirst({
      where: { name: { equals: normalizedName, mode: "insensitive" } },
      select: { id: true },
    }),
    requireCourse(input.courseId),
  ]);

  if (existingName) {
    throw new Error("Program name already exists.");
  }

  const slug = await resolveUniqueSlug(slugify(normalizedName));

  return prisma.$transaction(async (tx) => {
    const program = await tx.program.create({
      data: {
        courseId: course.id,
        slug,
        name: normalizedName,
        type: input.type,
        durationWeeks: input.durationWeeks,
        category: normalizedCategory,
        description: normalizedDescription,
        isActive: input.isActive,
      },
      select: selectProgramRecord(),
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

    return mapProgramRecord(program);
  });
}