import { CourseDetail, CourseOption } from "@/services/courses/types";
import { COURSE_STATUS_ORDER } from "@/lib/course-status";

export function mapCourseOption(course: CourseDetail): CourseOption {
  return {
    id: course.id,
    name: course.name,
    description: course.description,
    status: course.status,
    isActive: course.isActive,
    programCount: course.programs.length,
  };
}

export function sortCoursesByLifecycle<T extends { status: string; isActive: boolean; name: string }>(
  left: T,
  right: T,
) {
  const statusDelta =
    (COURSE_STATUS_ORDER[left.status as keyof typeof COURSE_STATUS_ORDER] ?? Number.MAX_SAFE_INTEGER) -
    (COURSE_STATUS_ORDER[right.status as keyof typeof COURSE_STATUS_ORDER] ?? Number.MAX_SAFE_INTEGER);

  if (statusDelta !== 0) {
    return statusDelta;
  }

  if (left.isActive !== right.isActive) {
    return left.isActive ? -1 : 1;
  }

  return left.name.localeCompare(right.name, "en", { sensitivity: "base" });
}

export function normalizeProgramIds(programIds: string[]) {
  return Array.from(new Set(programIds.map((programId) => programId.trim()).filter(Boolean)));
}
