import { CourseDetail, CourseOption } from "@/services/courses/types";

export function mapCourseOption(course: CourseDetail): CourseOption {
  return {
    id: course.id,
    name: course.name,
    description: course.description,
    isActive: course.isActive,
    programCount: course.programs.length,
  };
}

export function normalizeProgramIds(programIds: string[]) {
  return Array.from(new Set(programIds.map((programId) => programId.trim()).filter(Boolean)));
}
