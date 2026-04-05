import "server-only";

import { AuditActionType, AuditEntityType } from "@prisma/client";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { deriveGeneratedCodePrefix, formatGeneratedCode } from "@/lib/utils";
import { CreateCourseInput, UpdateCourseInput } from "@/lib/validation-schemas/courses";
import { createAuditLogEntry } from "@/services/logs-actions-service";
import { mapCourseOption, normalizeProgramIds } from "@/services/courses/internal-helpers";
import { MOCK_COURSES } from "@/services/courses/mock-data";
import { CourseCreateResult, CourseOption } from "@/services/courses/types";

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
  let normalizedCode = input.code.trim().toUpperCase();

  if (!normalizedCode) {
    normalizedCode = await generateCourseCode(normalizedName);
  }

  if (!isDatabaseConfigured) {
    return {
      id: `mock-course-${Date.now()}`,
      name: normalizedName,
      description: normalizedDescription,
      isActive: input.isActive,
      programCount: selectedProgramIds.length,
    };
  }

  const [existingName, existingCode, selectedPrograms] = await Promise.all([
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

  const createdCourse = await prisma.$transaction(async (tx) => {
    const course = await tx.course.create({
      data: {
        code: normalizedCode,
        name: normalizedName,
        description: normalizedDescription,
        isActive: input.isActive,
      },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
      },
    });

    if (selectedProgramIds.length > 0) {
      await tx.program.updateMany({
        where: { id: { in: selectedProgramIds } },
        data: { courseId: course.id },
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
      programCount: selectedProgramIds.length,
    },
  });

  return createdCourse;
}

export async function updateCourseService(input: UpdateCourseInput): Promise<CourseCreateResult> {
  const normalizedName = input.name.trim();
  const normalizedDescription = input.description.trim() || null;

  if (!isDatabaseConfigured) {
    const existing = MOCK_COURSES.find((course) => course.id === input.courseId);
    return {
      id: input.courseId,
      name: normalizedName,
      description: normalizedDescription,
      isActive: input.isActive,
      programCount: existing?.programs.length ?? 0,
    };
  }

  const [existingCourse, duplicateName] = await Promise.all([
    prisma.course.findUnique({
      where: { id: input.courseId },
      select: { id: true, _count: { select: { programs: true } } },
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

  const course = await prisma.course.update({
    where: { id: input.courseId },
    data: {
      name: normalizedName,
      description: normalizedDescription,
      isActive: input.isActive,
    },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
    },
  });

  await createAuditLogEntry({
    entityType: AuditEntityType.COURSE,
    entityId: course.id,
    action: AuditActionType.UPDATED,
    message: `Course ${course.name} updated.`,
    metadata: {
      isActive: course.isActive,
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
      isActive: false,
    };
  }

  const course = await prisma.course.update({
    where: { id: courseId },
    data: { isActive: false },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      _count: { select: { programs: true } },
    },
  });

  return {
    id: course.id,
    name: course.name,
    description: course.description,
    isActive: course.isActive,
    programCount: course._count.programs,
  };
}
