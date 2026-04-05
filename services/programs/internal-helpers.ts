import { prisma } from "@/lib/prisma-client";
import { ProgramCreateResult, ProgramOption, ProgramRecord, ProgramSummaryRecord } from "@/services/programs/types";

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 120);
}

export function mapProgramOption(program: ProgramCreateResult): ProgramOption {
  return {
    id: program.id,
    courseId: program.courseId,
    courseName: program.courseName,
    name: program.name,
    type: program.type,
    isActive: program.isActive,
  };
}

export function mapProgramSummaryRecord(program: ProgramSummaryRecord): ProgramOption {
  return {
    id: program.id,
    courseId: program.courseId,
    courseName: program.course.name,
    name: program.name,
    type: program.type,
    isActive: program.isActive,
  };
}

export function mapProgramRecord(program: ProgramRecord): ProgramCreateResult {
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

export function selectProgramRecord() {
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

export async function resolveUniqueSlug(baseSlug: string) {
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

export async function requireCourse(courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, name: true },
  });

  if (!course) {
    throw new Error("Invalid course selection.");
  }

  return course;
}
