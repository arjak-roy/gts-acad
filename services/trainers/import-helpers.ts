import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma-client";

export type TrainerCourseRecord = {
  id: string;
  name: string;
};

export type TrainerCourseLookup = {
  byId: Map<string, TrainerCourseRecord>;
  byNormalizedName: Map<string, TrainerCourseRecord>;
};

export function normalizeTrainerCourseList(courses: string[]) {
  return Array.from(new Set(courses.map((course) => course.trim()).filter(Boolean)));
}

export function normalizeTrainerEmployeeCode(employeeCode: string) {
  return employeeCode.trim().toUpperCase();
}

function isUuidLike(value: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value.trim());
}

export async function loadTrainerCourseLookup(courseSelections: string[]): Promise<TrainerCourseLookup> {
  const normalizedSelections = normalizeTrainerCourseList(courseSelections);

  if (normalizedSelections.length === 0) {
    return {
      byId: new Map(),
      byNormalizedName: new Map(),
    };
  }

  const matchingCourses = await prisma.course.findMany({
    where: {
      OR: normalizedSelections.flatMap((courseSelection) => {
        const courseFilters: Prisma.CourseWhereInput[] = [
          {
            name: {
              equals: courseSelection,
              mode: "insensitive" as const,
            },
          },
        ];

        if (isUuidLike(courseSelection)) {
          courseFilters.unshift({ id: courseSelection });
        }

        return courseFilters;
      }),
    },
    select: {
      id: true,
      name: true,
    },
  });

  return {
    byId: new Map(matchingCourses.map((course) => [course.id, course])),
    byNormalizedName: new Map(matchingCourses.map((course) => [course.name.trim().toLowerCase(), course])),
  };
}

export function resolveTrainerCoursesFromLookup(courseSelections: string[], lookup: TrainerCourseLookup) {
  const normalizedSelections = normalizeTrainerCourseList(courseSelections);

  return normalizedSelections.map((courseSelection) => {
    const resolvedCourse = lookup.byId.get(courseSelection) ?? lookup.byNormalizedName.get(courseSelection.trim().toLowerCase());

    if (!resolvedCourse) {
      throw new Error(`Invalid course selection: ${courseSelection}.`);
    }

    return resolvedCourse;
  });
}

export async function resolveTrainerSelectedCourses(courseSelections: string[]) {
  const lookup = await loadTrainerCourseLookup(courseSelections);
  const resolvedCourses = resolveTrainerCoursesFromLookup(courseSelections, lookup);
  return Array.from(new Map(resolvedCourses.map((course) => [course.id, course])).values());
}