import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { mapProgramOption, mapProgramRecord, mapProgramSummaryRecord, selectProgramRecord } from "@/services/programs/internal-helpers";
import { MOCK_PROGRAMS } from "@/services/programs/mock-data";
import { ProgramDetail, ProgramOption, ProgramSummaryRecord } from "@/services/programs/types";

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

    return (programs as ProgramSummaryRecord[]).map(mapProgramSummaryRecord);
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

    return (programs as ProgramSummaryRecord[]).map(mapProgramSummaryRecord);
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
