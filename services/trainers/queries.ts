import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { MOCK_TRAINERS } from "@/services/trainers/mock-data";
import { TrainerDetail, TrainerOption } from "@/services/trainers/types";

function filterMockByCourse(courseName?: string) {
  const normalizedCourseName = courseName?.trim();

  return MOCK_TRAINERS.filter((trainer) =>
    normalizedCourseName
      ? trainer.courses.some((course) => course.toLowerCase() === normalizedCourseName.toLowerCase())
      : true,
  );
}

export async function listTrainersService(courseName?: string): Promise<TrainerOption[]> {
  const normalizedCourseName = courseName?.trim();

  if (!isDatabaseConfigured) {
    return filterMockByCourse(normalizedCourseName);
  }

  try {
    const trainers = await prisma.trainerProfile.findMany({
      where: normalizedCourseName
        ? {
            courses: {
              has: normalizedCourseName,
            },
          }
        : undefined,
      orderBy: [{ isActive: "desc" }, { joinedAt: "desc" }],
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return trainers.map((trainer) => ({
      id: trainer.id,
      fullName: trainer.user.name,
      email: trainer.user.email,
      specialization: trainer.specialization,
      isActive: trainer.isActive,
      courses: trainer.courses,
    }));
  } catch (error) {
    console.warn("Trainer list fallback activated", error);
    return filterMockByCourse(normalizedCourseName);
  }
}

export async function searchTrainersService(query: string, limit: number): Promise<TrainerOption[]> {
  const normalizedQuery = query.trim().toLowerCase();

  if (!isDatabaseConfigured) {
    return MOCK_TRAINERS.filter(
      (trainer) =>
        trainer.fullName.toLowerCase().includes(normalizedQuery) ||
        trainer.email.toLowerCase().includes(normalizedQuery) ||
        trainer.specialization.toLowerCase().includes(normalizedQuery) ||
        trainer.courses.some((course) => course.toLowerCase().includes(normalizedQuery)),
    ).slice(0, limit);
  }

  try {
    // Run two branches in parallel:
    // Branch A - match on name / email / specialization directly
    // Branch B - resolve course names first, then match trainers via hasSome
    const trainerSelect = {
      include: { user: { select: { name: true, email: true } } },
      orderBy: [{ isActive: "desc" as const }, { joinedAt: "desc" as const }],
      take: limit,
    };

    const [branchA, matchingCourses] = await Promise.all([
      prisma.trainerProfile.findMany({
        where: {
          OR: [
            { user: { name: { contains: query, mode: "insensitive" } } },
            { user: { email: { contains: query, mode: "insensitive" } } },
            { specialization: { contains: query, mode: "insensitive" } },
          ],
        },
        ...trainerSelect,
      }),
      prisma.course.findMany({
        where: { name: { contains: query, mode: "insensitive" } },
        select: { name: true },
        take: 20,
      }),
    ]);

    const branchB =
      matchingCourses.length > 0
        ? await prisma.trainerProfile.findMany({
            where: { courses: { hasSome: matchingCourses.map((course) => course.name) } },
            ...trainerSelect,
          })
        : [];

    // Deduplicate by id, preserving Branch A ordering first
    const seen = new Set<string>();
    const trainers = [...branchA, ...branchB]
      .filter((trainer) => {
        if (seen.has(trainer.id)) {
          return false;
        }

        seen.add(trainer.id);
        return true;
      })
      .slice(0, limit);

    return trainers.map((trainer) => ({
      id: trainer.id,
      fullName: trainer.user.name,
      email: trainer.user.email,
      specialization: trainer.specialization,
      isActive: trainer.isActive,
      courses: trainer.courses,
    }));
  } catch (error) {
    console.warn("Trainer search fallback activated", error);
    return MOCK_TRAINERS.filter(
      (trainer) =>
        trainer.fullName.toLowerCase().includes(normalizedQuery) ||
        trainer.email.toLowerCase().includes(normalizedQuery) ||
        trainer.specialization.toLowerCase().includes(normalizedQuery) ||
        trainer.courses.some((course) => course.toLowerCase().includes(normalizedQuery)),
    ).slice(0, limit);
  }
}

export async function getTrainerByIdService(trainerId: string): Promise<TrainerDetail | null> {
  if (!isDatabaseConfigured) {
    const trainer = MOCK_TRAINERS.find((item) => item.id === trainerId);
    if (!trainer) {
      return null;
    }

    return {
      id: trainer.id,
      userId: `mock-user-${trainer.id}`,
      fullName: trainer.fullName,
      email: trainer.email,
      phone: null,
      specialization: trainer.specialization,
      bio: null,
      capacity: 0,
      status: trainer.isActive ? "ACTIVE" : "INACTIVE",
      courses: trainer.courses,
    };
  }

  const trainer = await prisma.trainerProfile.findUnique({
    where: { id: trainerId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  if (!trainer) {
    return null;
  }

  return {
    id: trainer.id,
    userId: trainer.user.id,
    fullName: trainer.user.name,
    email: trainer.user.email,
    phone: trainer.user.phone,
    specialization: trainer.specialization,
    bio: trainer.bio,
    capacity: trainer.capacity,
    status: trainer.isActive ? "ACTIVE" : "INACTIVE",
    courses: trainer.courses,
  };
}

export async function getTrainersForCourseService(courseName: string): Promise<TrainerOption[]> {
  const normalizedCourseName = courseName.trim();

  if (!isDatabaseConfigured) {
    return MOCK_TRAINERS.filter((trainer) =>
      trainer.courses.some((course) => course.toLowerCase() === normalizedCourseName.toLowerCase()),
    );
  }

  const trainers = await prisma.trainerProfile.findMany({
    where: {
      isActive: true,
      courses: {
        has: normalizedCourseName,
      },
    },
    include: { user: { select: { name: true, email: true } } },
  });

  return trainers.map((trainer) => ({
    id: trainer.id,
    fullName: trainer.user.name,
    email: trainer.user.email,
    specialization: trainer.specialization,
    isActive: trainer.isActive,
    courses: trainer.courses,
  }));
}
