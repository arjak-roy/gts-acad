import "server-only";

import { ProgramType } from "@prisma/client";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { deriveGeneratedCodePrefix, formatGeneratedCode } from "@/lib/utils";
import { CreateCourseInput, UpdateCourseInput } from "@/lib/validation-schemas/courses";

export type CourseProgramSummary = {
  id: string;
  name: string;
  type: ProgramType;
  isActive: boolean;
};

export type CourseOption = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  programCount: number;
};

export type CourseCreateResult = CourseOption;

export type CourseDetail = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  programs: CourseProgramSummary[];
};

const MOCK_COURSES: CourseDetail[] = [
  {
    id: "mock-course-language",
    name: "Language Career Track",
    description: "Language preparation pathways for international academy placement.",
    isActive: true,
    programs: [{ id: "mock-program-1", name: "German Language B1", type: "LANGUAGE", isActive: true }],
  },
  {
    id: "mock-course-clinical",
    name: "Clinical Career Track",
    description: "Clinical upskilling pathways for nursing and healthcare deployment.",
    isActive: true,
    programs: [{ id: "mock-program-2", name: "Clinical Bridging", type: "CLINICAL", isActive: true }],
  },
];

function mapCourseOption(course: CourseDetail): CourseOption {
  return {
    id: course.id,
    name: course.name,
    description: course.description,
    isActive: course.isActive,
    programCount: course.programs.length,
  };
}

function normalizeProgramIds(programIds: string[]) {
  return Array.from(new Set(programIds.map((programId) => programId.trim()).filter(Boolean)));
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

export async function listCoursesService(): Promise<CourseOption[]> {
  if (!isDatabaseConfigured) {
    return MOCK_COURSES.map(mapCourseOption);
  }

  try {
    const courses = await prisma.course.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        _count: { select: { programs: true } },
      },
    });

    return courses.map((course) => ({
      id: course.id,
      name: course.name,
      description: course.description,
      isActive: course.isActive,
      programCount: course._count.programs,
    }));
  } catch (error) {
    console.warn("Course list fallback activated", error);
    return MOCK_COURSES.map(mapCourseOption);
  }
}

export async function searchCoursesService(query: string, limit: number): Promise<CourseOption[]> {
  const normalizedQuery = query.trim().toLowerCase();

  if (!isDatabaseConfigured) {
    return MOCK_COURSES.filter(
      (course) =>
        course.name.toLowerCase().includes(normalizedQuery) ||
        (course.description ?? "").toLowerCase().includes(normalizedQuery),
    )
      .slice(0, limit)
      .map(mapCourseOption);
  }

  try {
    const courses = await prisma.course.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      take: limit,
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        _count: { select: { programs: true } },
      },
    });

    return courses.map((course) => ({
      id: course.id,
      name: course.name,
      description: course.description,
      isActive: course.isActive,
      programCount: course._count.programs,
    }));
  } catch (error) {
    console.warn("Course search fallback activated", error);
    return MOCK_COURSES.filter(
      (course) =>
        course.name.toLowerCase().includes(normalizedQuery) ||
        (course.description ?? "").toLowerCase().includes(normalizedQuery),
    )
      .slice(0, limit)
      .map(mapCourseOption);
  }
}

export async function getCourseByIdService(courseId: string): Promise<CourseDetail | null> {
  if (!isDatabaseConfigured) {
    return MOCK_COURSES.find((course) => course.id === courseId) ?? null;
  }

  try {
    return await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        programs: {
          orderBy: [{ isActive: "desc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            type: true,
            isActive: true,
          },
        },
      },
    });
  } catch (error) {
    console.warn("Course detail fallback activated", error);
    return null;
  }
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

  return prisma.$transaction(async (tx) => {
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