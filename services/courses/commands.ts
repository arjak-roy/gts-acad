import "server-only";

import { AuditActionType, AuditEntityType } from "@prisma/client";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { deriveGeneratedCodePrefix, formatGeneratedCode } from "@/lib/utils";
import { CreateCourseInput, UpdateCourseInput } from "@/lib/validation-schemas/courses";
import { createAuditLogEntry } from "@/services/logs-actions-service";
import { mapCourseOption, normalizeProgramIds } from "@/services/courses/internal-helpers";
import { MOCK_COURSES } from "@/services/courses/mock-data";
import { CourseCreateResult, CourseOption } from "@/services/courses/types";

function resolveCourseActivation(status: CreateCourseInput["status"] | UpdateCourseInput["status"], isActive: boolean) {
  return status === "ARCHIVED" ? false : isActive;
}

function normalizeTrainerIds(trainerIds: string[]) {
  return Array.from(new Set(trainerIds.map((trainerId) => trainerId.trim()).filter(Boolean)));
}

export async function generateCourseCode(courseName: string): Promise<string> {
  const prefix = deriveGeneratedCodePrefix(courseName);

  if (!isDatabaseConfigured) {
    return formatGeneratedCode("C", courseName, 1);
  }

  const lastCourse = await prisma.course.findFirst({
    where: { code: { startsWith: `C-${prefix}-` } },
    orderBy: { code: "desc" },
    select: { code: true },
  });

  let number = 1;
  if (lastCourse) {
    const match = lastCourse.code.match(/-(\d+)$/);
    number = match ? Number.parseInt(match[1], 10) + 1 : 1;
  }

  return formatGeneratedCode("C", courseName, number);
}

export async function createCourseService(input: CreateCourseInput): Promise<CourseCreateResult> {
  const normalizedName = input.name.trim();
  const normalizedDescription = input.description.trim() || null;
  const selectedProgramIds = normalizeProgramIds(input.programIds ?? []);
  const selectedTrainerIds = normalizeTrainerIds(input.trainerIds ?? []);
  const status = input.status;
  const isActive = resolveCourseActivation(status, input.isActive);
  let normalizedCode = input.code.trim().toUpperCase();

  if (!normalizedCode) {
    normalizedCode = await generateCourseCode(normalizedName);
  }

  if (!isDatabaseConfigured) {
    return {
      id: `mock-course-${Date.now()}`,
      name: normalizedName,
      description: normalizedDescription,
      status,
      isActive,
      programCount: selectedProgramIds.length,
    };
  }

  const [existingName, existingCode, selectedPrograms, selectedTrainers] = await Promise.all([
    prisma.course.findFirst({
      where: { name: { equals: normalizedName, mode: "insensitive" } },
      select: { id: true },
    }),
    prisma.course.findUnique({
      where: { code: normalizedCode },
      select: { id: true },
    }),
    selectedProgramIds.length > 0
      ? prisma.program.findMany({ where: { id: { in: selectedProgramIds } }, select: { id: true } })
      : Promise.resolve([]),
    selectedTrainerIds.length > 0
      ? prisma.trainerProfile.findMany({ where: { id: { in: selectedTrainerIds } }, select: { id: true } })
      : Promise.resolve([]),
  ]);

  if (existingName) {
    throw new Error("Course name already exists.");
  }

  if (existingCode) {
    throw new Error("Course code already exists.");
  }

  if (selectedPrograms.length !== selectedProgramIds.length) {
    throw new Error("One or more selected programs were not found.");
  }

  if (selectedTrainers.length !== selectedTrainerIds.length) {
    throw new Error("One or more selected trainers were not found.");
  }

  const createdCourse = await prisma.$transaction(async (tx) => {
    const course = await tx.course.create({
      data: {
        code: normalizedCode,
        name: normalizedName,
        description: normalizedDescription,
        status,
        isActive,
      },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        isActive: true,
      },
    });

    if (selectedProgramIds.length > 0) {
      await tx.program.updateMany({
        where: { id: { in: selectedProgramIds } },
        data: { courseId: course.id },
      });
    }

    if (selectedTrainerIds.length > 0) {
      await tx.trainerCourseAssignment.createMany({
        data: selectedTrainers.map((trainer) => ({
          trainerId: trainer.id,
          courseId: course.id,
        })),
        skipDuplicates: true,
      });
    }

    return {
      ...course,
      programCount: selectedProgramIds.length,
    };
  });

  await createAuditLogEntry({
    entityType: AuditEntityType.COURSE,
    entityId: createdCourse.id,
    action: AuditActionType.CREATED,
    message: `Course ${createdCourse.name} created.`,
    metadata: {
      code: normalizedCode,
      status: createdCourse.status,
      programCount: selectedProgramIds.length,
      trainerCount: selectedTrainerIds.length,
    },
  });

  return createdCourse;
}

export async function updateCourseService(input: UpdateCourseInput): Promise<CourseCreateResult> {
  const normalizedName = input.name.trim();
  const normalizedDescription = input.description.trim() || null;
  const selectedTrainerIds = normalizeTrainerIds(input.trainerIds ?? []);
  const status = input.status;
  const isActive = resolveCourseActivation(status, input.isActive);

  if (!isDatabaseConfigured) {
    const existing = MOCK_COURSES.find((course) => course.id === input.courseId);
    return {
      id: input.courseId,
      name: normalizedName,
      description: normalizedDescription,
      status,
      isActive,
      programCount: existing?.programs.length ?? 0,
    };
  }

  const [existingCourse, duplicateName] = await Promise.all([
    prisma.course.findUnique({
      where: { id: input.courseId },
      select: { id: true, name: true, _count: { select: { programs: true } } },
    }),
    prisma.course.findFirst({
      where: {
        id: { not: input.courseId },
        name: { equals: normalizedName, mode: "insensitive" },
      },
      select: { id: true },
    }),
  ]);

  if (!existingCourse) {
    throw new Error("Course not found.");
  }

  if (duplicateName) {
    throw new Error("Course name already exists.");
  }

  const selectedTrainers = await (
    selectedTrainerIds.length > 0
      ? prisma.trainerProfile.findMany({
          where: { id: { in: selectedTrainerIds } },
          select: { id: true },
        })
      : Promise.resolve([])
  );

  if (selectedTrainers.length !== selectedTrainerIds.length) {
    throw new Error("One or more selected trainers were not found.");
  }

  const course = await prisma.$transaction(async (tx) => {
    await tx.trainerCourseAssignment.deleteMany({
      where: {
        courseId: input.courseId,
        ...(selectedTrainerIds.length > 0 ? { trainerId: { notIn: selectedTrainerIds } } : {}),
      },
    });

    if (selectedTrainerIds.length > 0) {
      await tx.trainerCourseAssignment.createMany({
        data: selectedTrainerIds.map((trainerId) => ({
          trainerId,
          courseId: input.courseId,
        })),
        skipDuplicates: true,
      });
    }

    return tx.course.update({
      where: { id: input.courseId },
      data: {
        name: normalizedName,
        description: normalizedDescription,
        status,
        isActive,
      },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        isActive: true,
      },
    });
  });

  await createAuditLogEntry({
    entityType: AuditEntityType.COURSE,
    entityId: course.id,
    action: AuditActionType.UPDATED,
    message: `Course ${course.name} updated.`,
    metadata: {
      status: course.status,
      isActive: course.isActive,
      trainerCount: selectedTrainerIds.length,
    },
  });

  return {
    ...course,
    programCount: existingCourse._count.programs,
  };
}

export async function archiveCourseService(courseId: string): Promise<CourseOption> {
  if (!isDatabaseConfigured) {
    const course = MOCK_COURSES.find((item) => item.id === courseId);
    if (!course) {
      throw new Error("Course not found.");
    }

    return {
      ...mapCourseOption(course),
      status: "ARCHIVED",
      isActive: false,
    };
  }

  const course = await prisma.course.update({
    where: { id: courseId },
    data: { status: "ARCHIVED", isActive: false },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      isActive: true,
      _count: { select: { programs: true } },
    },
  });

  await createAuditLogEntry({
    entityType: AuditEntityType.COURSE,
    entityId: course.id,
    action: AuditActionType.DEACTIVATED,
    message: `Course ${course.name} archived.`,
    metadata: {
      status: course.status,
      isActive: course.isActive,
    },
  });

  return {
    id: course.id,
    name: course.name,
    description: course.description,
    status: course.status,
    isActive: course.isActive,
    programCount: course._count.programs,
  };
}
