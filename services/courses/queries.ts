import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { listAssignedSharedCourseContentService } from "@/services/course-content-service";
import { mapCourseOption, sortCoursesByLifecycle } from "@/services/courses/internal-helpers";
import { MOCK_COURSES } from "@/services/courses/mock-data";
import { CourseDetail, CourseOption } from "@/services/courses/types";

export async function listCoursesService(): Promise<CourseOption[]> {
  if (!isDatabaseConfigured) {
    return MOCK_COURSES.map(mapCourseOption);
  }

  try {
    const courses = await prisma.course.findMany({
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        isActive: true,
        _count: { select: { programs: true } },
      },
    });

    return courses.map((course) => ({
      id: course.id,
      name: course.name,
      description: course.description,
      status: course.status,
      isActive: course.isActive,
      programCount: course._count.programs,
    })).sort(sortCoursesByLifecycle);
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
      orderBy: [{ name: "asc" }],
      take: limit,
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        isActive: true,
        _count: { select: { programs: true } },
      },
    });

    return courses.map((course) => ({
      id: course.id,
      name: course.name,
      description: course.description,
      status: course.status,
      isActive: course.isActive,
      programCount: course._count.programs,
    })).sort(sortCoursesByLifecycle);
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
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
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

    if (!course) {
      return null;
    }

    const trainers = await prisma.trainerProfile.findMany({
      where: {
        isActive: true,
        courses: {
          has: course.name,
        },
      },
      orderBy: [{ joinedAt: "desc" }],
      select: {
        id: true,
        specialization: true,
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    return {
      ...course,
      trainers: trainers.map((trainer) => ({
        id: trainer.id,
        fullName: trainer.user.name,
        specialization: trainer.specialization,
      })),
      assignedSharedContents: await listAssignedSharedCourseContentService(courseId),
    };
  } catch (error) {
    console.warn("Course detail fallback activated", error);
    return null;
  }
}
