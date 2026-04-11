import { Prisma } from "@prisma/client";

import type { GetTrainerRegistryInput } from "@/lib/validation-schemas/trainers";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { MOCK_TRAINERS } from "@/services/trainers/mock-data";
import { TrainerDetail, TrainerOption, TrainerRegistryResponse } from "@/services/trainers/types";

const trainerSelect = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      lastLoginAt: true,
    },
  },
} satisfies Prisma.TrainerProfileInclude;

type TrainerRecord = Prisma.TrainerProfileGetPayload<{
  include: typeof trainerSelect;
}>;

function mapTrainerOption(record: TrainerRecord): TrainerOption {
  return {
    id: record.id,
    fullName: record.user.name,
    employeeCode: record.employeeCode,
    email: record.user.email,
    specialization: record.specialization,
    isActive: record.isActive,
    availabilityStatus: record.availabilityStatus,
    courses: record.courses,
    lastActiveAt: record.user.lastLoginAt?.toISOString() ?? null,
  };
}

function sortMockTrainers(items: TrainerOption[], sortBy: GetTrainerRegistryInput["sortBy"], sortDirection: GetTrainerRegistryInput["sortDirection"]) {
  const direction = sortDirection === "asc" ? 1 : -1;

  return [...items].sort((left, right) => {
    const statusLeft = left.isActive ? "ACTIVE" : "INACTIVE";
    const statusRight = right.isActive ? "ACTIVE" : "INACTIVE";

    const leftValue =
      sortBy === "fullName" ? left.fullName :
      sortBy === "employeeCode" ? left.employeeCode :
      sortBy === "email" ? left.email :
      sortBy === "specialization" ? left.specialization :
      sortBy === "status" ? statusLeft :
      sortBy === "availabilityStatus" ? left.availabilityStatus :
      left.lastActiveAt ?? "";

    const rightValue =
      sortBy === "fullName" ? right.fullName :
      sortBy === "employeeCode" ? right.employeeCode :
      sortBy === "email" ? right.email :
      sortBy === "specialization" ? right.specialization :
      sortBy === "status" ? statusRight :
      sortBy === "availabilityStatus" ? right.availabilityStatus :
      right.lastActiveAt ?? "";

    return leftValue.localeCompare(rightValue) * direction;
  });
}

function filterMockTrainers(input: GetTrainerRegistryInput): TrainerOption[] {
  const normalizedSearch = input.search.trim().toLowerCase();
  const normalizedSpecialization = input.specialization.trim().toLowerCase();

  const filtered = MOCK_TRAINERS.filter((trainer) => {
    if (input.status === "ACTIVE" && !trainer.isActive) {
      return false;
    }

    if (input.status === "INACTIVE" && trainer.isActive) {
      return false;
    }

    if (input.availability !== "ALL" && trainer.availabilityStatus !== input.availability) {
      return false;
    }

    if (normalizedSpecialization && trainer.specialization.trim().toLowerCase() !== normalizedSpecialization) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return (
      trainer.fullName.toLowerCase().includes(normalizedSearch) ||
      trainer.employeeCode.toLowerCase().includes(normalizedSearch) ||
      trainer.email.toLowerCase().includes(normalizedSearch) ||
      trainer.specialization.toLowerCase().includes(normalizedSearch)
    );
  });

  return sortMockTrainers(filtered, input.sortBy, input.sortDirection);
}

async function resolveCourseNameForFilter(courseId: string) {
  if (!courseId) {
    return null;
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { name: true },
  });

  if (!course) {
    throw new Error("Invalid course selection.");
  }

  return course.name;
}

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
            id: true,
            name: true,
            email: true,
            phone: true,
            lastLoginAt: true,
          },
        },
      },
    });

    return trainers.map((trainer) => mapTrainerOption(trainer as TrainerRecord));
  } catch (error) {
    console.warn("Trainer list fallback activated", error);
    return filterMockByCourse(normalizedCourseName);
  }
}

export async function getTrainerRegistryService(input: GetTrainerRegistryInput): Promise<TrainerRegistryResponse> {
  if (!isDatabaseConfigured) {
    const filtered = filterMockTrainers(input);
    const totalCount = filtered.length;
    const startIndex = (input.page - 1) * input.pageSize;
    const items = filtered.slice(startIndex, startIndex + input.pageSize);

    return {
      items,
      totalCount,
      page: input.page,
      pageSize: input.pageSize,
      pageCount: Math.max(1, Math.ceil(totalCount / input.pageSize)),
      filterOptions: {
        specializations: Array.from(new Set(MOCK_TRAINERS.map((trainer) => trainer.specialization))).sort((left, right) => left.localeCompare(right)),
      },
    };
  }

  const courseName = input.courseId ? await resolveCourseNameForFilter(input.courseId) : null;
  const where: Prisma.TrainerProfileWhereInput = {
    ...(input.status === "ACTIVE" ? { isActive: true } : {}),
    ...(input.status === "INACTIVE" ? { isActive: false } : {}),
    ...(input.availability !== "ALL" ? { availabilityStatus: input.availability } : {}),
    ...(input.specialization
      ? {
          specialization: {
            equals: input.specialization,
            mode: "insensitive",
          },
        }
      : {}),
    ...(courseName ? { courses: { has: courseName } } : {}),
    ...(input.search
      ? {
          OR: [
            { user: { name: { contains: input.search, mode: "insensitive" } } },
            { user: { email: { contains: input.search, mode: "insensitive" } } },
            { employeeCode: { contains: input.search, mode: "insensitive" } },
            { specialization: { contains: input.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const sortMap: Record<GetTrainerRegistryInput["sortBy"], Prisma.TrainerProfileOrderByWithRelationInput> = {
    fullName: { user: { name: input.sortDirection } },
    employeeCode: { employeeCode: input.sortDirection },
    email: { user: { email: input.sortDirection } },
    specialization: { specialization: input.sortDirection },
    status: { isActive: input.sortDirection },
    availabilityStatus: { availabilityStatus: input.sortDirection },
    lastActiveAt: { user: { lastLoginAt: input.sortDirection } },
  };

  const [totalCount, trainers, specializationRecords] = await prisma.$transaction([
    prisma.trainerProfile.count({ where }),
    prisma.trainerProfile.findMany({
      where,
      orderBy: sortMap[input.sortBy],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      include: trainerSelect,
    }),
    prisma.trainerProfile.findMany({
      select: { specialization: true },
      distinct: ["specialization"],
      orderBy: { specialization: "asc" },
    }),
  ]);

  return {
    items: trainers.map((trainer) => mapTrainerOption(trainer as TrainerRecord)),
    totalCount,
    page: input.page,
    pageSize: input.pageSize,
    pageCount: Math.max(1, Math.ceil(totalCount / input.pageSize)),
    filterOptions: {
      specializations: specializationRecords.map((record) => record.specialization).filter(Boolean),
    },
  };
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
            { employeeCode: { contains: query, mode: "insensitive" } },
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

    return trainers.map((trainer) => mapTrainerOption(trainer as TrainerRecord));
  } catch (error) {
    console.warn("Trainer search fallback activated", error);
    return MOCK_TRAINERS.filter(
      (trainer) =>
        trainer.fullName.toLowerCase().includes(normalizedQuery) ||
        trainer.employeeCode.toLowerCase().includes(normalizedQuery) ||
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
      employeeCode: trainer.employeeCode,
      email: trainer.email,
      phone: null,
      specialization: trainer.specialization,
      bio: null,
      capacity: 0,
      status: trainer.isActive ? "ACTIVE" : "INACTIVE",
      availabilityStatus: trainer.availabilityStatus,
      courses: trainer.courses,
      lastActiveAt: trainer.lastActiveAt,
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
          lastLoginAt: true,
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
    employeeCode: trainer.employeeCode,
    email: trainer.user.email,
    phone: trainer.user.phone,
    specialization: trainer.specialization,
    bio: trainer.bio,
    capacity: trainer.capacity,
    status: trainer.isActive ? "ACTIVE" : "INACTIVE",
    availabilityStatus: trainer.availabilityStatus,
    courses: trainer.courses,
    lastActiveAt: trainer.user.lastLoginAt?.toISOString() ?? null,
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

  return trainers.map((trainer) => mapTrainerOption(trainer as TrainerRecord));
}
