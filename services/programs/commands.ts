import "server-only";

import { deriveGeneratedCodePrefix, formatGeneratedCode } from "@/lib/utils";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { CreateProgramInput, UpdateProgramInput } from "@/lib/validation-schemas/programs";
import { createAuditLogEntry } from "@/services/logs-actions-service";
import { mapProgramRecord, mapProgramSummaryRecord, requireCourse, resolveUniqueSlug, selectProgramRecord, slugify } from "@/services/programs/internal-helpers";
import { MOCK_PROGRAMS } from "@/services/programs/mock-data";
import { ProgramCreateResult, ProgramOption } from "@/services/programs/types";

export async function generateProgramCode(programName: string): Promise<string> {
  const prefix = deriveGeneratedCodePrefix(programName);

  if (!isDatabaseConfigured) {
    return formatGeneratedCode("P", programName, 1);
  }

  const lastProgram = await prisma.program.findFirst({
    where: { code: { startsWith: `P-${prefix}-` } },
    orderBy: { code: "desc" },
    select: { code: true },
  });

  let number = 1;
  if (lastProgram) {
    const match = lastProgram.code.match(/-(\d+)$/);
    number = match ? Number.parseInt(match[1], 10) + 1 : 1;
  }

  return formatGeneratedCode("P", programName, number);
}

export async function updateProgramService(input: UpdateProgramInput, actorUserId?: string): Promise<ProgramCreateResult> {
  const normalizedName = input.name.trim();
  const normalizedCategory = input.category.trim() || null;
  const normalizedDescription = input.description.trim() || null;
  const selectedBatchIds = input.batchIds ? Array.from(new Set(input.batchIds.map((batchId) => batchId.trim()).filter(Boolean))) : null;

  if (!isDatabaseConfigured) {
    const courseName = MOCK_PROGRAMS.find((program) => program.courseId === input.courseId)?.courseName ?? "Assigned Course";
    const result = {
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

    await createAuditLogEntry({
      entityType: "SYSTEM",
      entityId: result.id,
      action: "UPDATED",
      status: "PROGRAM",
      message: `Program ${result.name} updated.`,
      metadata: {
        programId: result.id,
        courseId: result.courseId,
        type: result.type,
        isActive: result.isActive,
      },
      actorUserId: actorUserId ?? null,
    });

    return result;
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

  if (!selectedBatchIds) {
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

    const mappedProgram = mapProgramRecord(program);

    await createAuditLogEntry({
      entityType: "SYSTEM",
      entityId: mappedProgram.id,
      action: "UPDATED",
      status: "PROGRAM",
      message: `Program ${mappedProgram.name} updated.`,
      metadata: {
        programId: mappedProgram.id,
        courseId: mappedProgram.courseId,
        type: mappedProgram.type,
        isActive: mappedProgram.isActive,
      },
      actorUserId: actorUserId ?? null,
    });

    return mappedProgram;
  }

  const mappedProgram = await prisma.$transaction(async (tx) => {
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

  await createAuditLogEntry({
    entityType: "SYSTEM",
    entityId: mappedProgram.id,
    action: "UPDATED",
    status: "PROGRAM",
    message: `Program ${mappedProgram.name} updated.`,
    metadata: {
      programId: mappedProgram.id,
      courseId: mappedProgram.courseId,
      type: mappedProgram.type,
      isActive: mappedProgram.isActive,
      batchCount: selectedBatchIds?.length ?? null,
    },
    actorUserId: actorUserId ?? null,
  });

  return mappedProgram;
}

export async function archiveProgramService(programId: string, actorUserId?: string): Promise<ProgramOption> {
  if (!isDatabaseConfigured) {
    const mock = MOCK_PROGRAMS.find((program) => program.id === programId);
    if (!mock) {
      throw new Error("Program not found.");
    }

    const result = {
      id: mock.id,
      courseId: mock.courseId,
      courseName: mock.courseName,
      name: mock.name,
      type: mock.type,
      isActive: false,
    };

    await createAuditLogEntry({
      entityType: "SYSTEM",
      entityId: result.id,
      action: "UPDATED",
      status: "PROGRAM",
      message: `Program ${result.name} archived.`,
      metadata: {
        programId: result.id,
        courseId: result.courseId,
        type: result.type,
        isActive: result.isActive,
      },
      actorUserId: actorUserId ?? null,
    });

    return result;
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

  const mappedProgram = mapProgramSummaryRecord(program);

  await createAuditLogEntry({
    entityType: "SYSTEM",
    entityId: mappedProgram.id,
    action: "UPDATED",
    status: "PROGRAM",
    message: `Program ${mappedProgram.name} archived.`,
    metadata: {
      programId: mappedProgram.id,
      courseId: mappedProgram.courseId,
      type: mappedProgram.type,
      isActive: mappedProgram.isActive,
    },
    actorUserId: actorUserId ?? null,
  });

  return mappedProgram;
}

export async function createProgramService(input: CreateProgramInput, actorUserId?: string): Promise<ProgramCreateResult> {
  const normalizedName = input.name.trim();
  const normalizedCategory = input.category.trim() || null;
  const normalizedDescription = input.description.trim() || null;
  const selectedBatchIds = Array.from(new Set((input.batchIds ?? []).map((batchId) => batchId.trim()).filter(Boolean)));
  let normalizedCode = input.code.trim().toUpperCase();

  if (!normalizedCode) {
    normalizedCode = await generateProgramCode(normalizedName);
  }

  if (!isDatabaseConfigured) {
    const courseName = MOCK_PROGRAMS.find((program) => program.courseId === input.courseId)?.courseName ?? "Assigned Course";
    const result = {
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

    await createAuditLogEntry({
      entityType: "SYSTEM",
      entityId: result.id,
      action: "CREATED",
      status: "PROGRAM",
      message: `Program ${result.name} created.`,
      metadata: {
        programId: result.id,
        courseId: result.courseId,
        type: result.type,
        isActive: result.isActive,
      },
      actorUserId: actorUserId ?? null,
    });

    return result;
  }

  const [existingName, existingCode, course] = await Promise.all([
    prisma.program.findFirst({
      where: { name: { equals: normalizedName, mode: "insensitive" } },
      select: { id: true },
    }),
    prisma.program.findUnique({
      where: { code: normalizedCode },
      select: { id: true },
    }),
    requireCourse(input.courseId),
  ]);

  if (existingName) {
    throw new Error("Program name already exists.");
  }

  if (existingCode) {
    throw new Error("Program code already exists.");
  }

  const slug = await resolveUniqueSlug(slugify(normalizedName));

  const createdProgram = await prisma.$transaction(async (tx) => {
    const program = await tx.program.create({
      data: {
        courseId: course.id,
        code: normalizedCode,
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

  await createAuditLogEntry({
    entityType: "SYSTEM",
    entityId: createdProgram.id,
    action: "CREATED",
    status: "PROGRAM",
    message: `Program ${createdProgram.name} created.`,
    metadata: {
      programId: createdProgram.id,
      courseId: createdProgram.courseId,
      type: createdProgram.type,
      isActive: createdProgram.isActive,
      batchCount: selectedBatchIds.length,
    },
    actorUserId: actorUserId ?? null,
  });

  return createdProgram;
}
