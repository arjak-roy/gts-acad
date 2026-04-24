import { Prisma } from "@prisma/client";

import type { GetTrainerRegistryInput } from "@/lib/validation-schemas/trainers";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { getStoredUploadAssetUrl } from "@/services/file-upload";
import { MOCK_TRAINERS } from "@/services/trainers/mock-data";
import { mapTrainerCourseNames } from "@/services/trainers/course-assignment-helpers";
import { TrainerDetail, TrainerOption, TrainerRegistryResponse, TrainerStatus, TrainerStatusHistoryItem } from "@/services/trainers/types";

const trainerSelect = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      lastLoginAt: true,
      updatedAt: true,
    },
  },
  updatedBy: {
    select: {
      name: true,
    },
  },
  courseAssignments: {
    select: {
      course: {
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      },
    },
  },
} satisfies Prisma.TrainerProfileInclude;

type TrainerRecord = Prisma.TrainerProfileGetPayload<{
  include: typeof trainerSelect;
}>;

function resolveTrainerPhotoUrl(value: string | null) {
  if (!value) {
    return null;
  }

  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) {
    return value;
  }

  const storageProvider = value.startsWith("candidate-profile-photos/") ? "S3" : "LOCAL_PUBLIC";
  return getStoredUploadAssetUrl({ storageProvider, storagePath: value });
}

function mapTrainerOption(record: TrainerRecord): TrainerOption {
  return {
    id: record.id,
    fullName: record.user.name,
    employeeCode: record.employeeCode,
    email: record.user.email,
    department: record.department,
    specialization: record.specialization,
    isActive: record.isActive,
    trainerStatus: record.trainerStatus as TrainerStatus,
    availabilityStatus: record.availabilityStatus,
    courses: mapTrainerCourseNames(record),
    lastActiveAt: record.user.lastLoginAt?.toISOString() ?? null,
    lastUpdatedAt: record.user.updatedAt?.toISOString() ?? null,
    lastUpdatedByName: record.updatedBy?.name ?? null,
  };
}

function sortMockTrainers(
  items: TrainerOption[],
  sortBy: GetTrainerRegistryInput["sortBy"],
  sortDirection: GetTrainerRegistryInput["sortDirection"],
) {
  const direction = sortDirection === "asc" ? 1 : -1;

  return [...items].sort((left, right) => {
    const statusLeft = left.trainerStatus ?? (left.isActive ? "ACTIVE" : "INACTIVE");
    const statusRight = right.trainerStatus ?? (right.isActive ? "ACTIVE" : "INACTIVE");
    const leftValue =
      sortBy === "fullName"
        ? left.fullName
        : sortBy === "employeeCode"
          ? left.employeeCode
          : sortBy === "email"
            ? left.email
            : sortBy === "department"
              ? left.department ?? ""
              : sortBy === "specialization"
                ? left.specialization
                : sortBy === "status"
                  ? statusLeft
                  : sortBy === "availabilityStatus"
                    ? left.availabilityStatus
                    : left.lastActiveAt ?? "";

    const rightValue =
      sortBy === "fullName"
        ? right.fullName
        : sortBy === "employeeCode"
          ? right.employeeCode
          : sortBy === "email"
            ? right.email
            : sortBy === "department"
              ? right.department ?? ""
              : sortBy === "specialization"
                ? right.specialization
                : sortBy === "status"
                  ? statusRight
                  : sortBy === "availabilityStatus"
                    ? right.availabilityStatus
                    : right.lastActiveAt ?? "";

    return leftValue.localeCompare(rightValue) * direction;
  });
}

function filterMockTrainers(input: GetTrainerRegistryInput): TrainerOption[] {
  const normalizedSearch = input.search.trim().toLowerCase();
  const normalizedSpecialization = input.specialization.trim().toLowerCase();
  const normalizedDepartment = input.department?.trim().toLowerCase() ?? "";

  const filtered = MOCK_TRAINERS.filter((trainer) => {
    const trainerStatus = trainer.trainerStatus ?? (trainer.isActive ? "ACTIVE" : "INACTIVE");

    if (input.status !== "ALL" && trainerStatus !== input.status) {
      return false;
    }

    if (input.availability !== "ALL" && trainer.availabilityStatus !== input.availability) {
      return false;
    }

    if (normalizedSpecialization && trainer.specialization.trim().toLowerCase() !== normalizedSpecialization) {
      return false;
    }

    if (normalizedDepartment && (trainer.department ?? "").trim().toLowerCase() !== normalizedDepartment) {
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

function filterMockByCourse(courseName?: string) {
  const normalizedCourseName = courseName?.trim().toLowerCase();

  return MOCK_TRAINERS.filter((trainer) =>
    normalizedCourseName
      ? trainer.courses.some((course) => course.toLowerCase() === normalizedCourseName)
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
            courseAssignments: {
              some: {
                course: {
                  name: {
                    equals: normalizedCourseName,
                    mode: "insensitive",
                  },
                },
              },
            },
          }
        : undefined,
      orderBy: [{ isActive: "desc" }, { joinedAt: "desc" }],
      include: trainerSelect,
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
        departments: [],
      },
    };
  }

  const where: Prisma.TrainerProfileWhereInput = {
    ...(input.status !== "ALL" ? { trainerStatus: input.status.toLowerCase() as Prisma.EnumTrainerProfileStatusFilter } : {}),
    ...(input.availability !== "ALL" ? { availabilityStatus: input.availability } : {}),
    ...(input.specialization
      ? {
          specialization: {
            equals: input.specialization,
            mode: "insensitive",
          },
        }
      : {}),
    ...(input.department
      ? {
          department: {
            equals: input.department,
            mode: "insensitive",
          },
        }
      : {}),
    ...(input.courseId
      ? {
          courseAssignments: {
            some: {
              courseId: input.courseId,
            },
          },
        }
      : {}),
    ...(input.search
      ? {
          OR: [
            { user: { name: { contains: input.search, mode: "insensitive" } } },
            { user: { email: { contains: input.search, mode: "insensitive" } } },
            { employeeCode: { contains: input.search, mode: "insensitive" } } ,
            { specialization: { contains: input.search, mode: "insensitive" } },
            {
              courseAssignments: {
                some: {
                  course: {
                    name: {
                      contains: input.search,
                      mode: "insensitive",
                    },
                  },
                },
              },
            },
          ],
        }
      : {}),
  };

  const sortMap: Record<GetTrainerRegistryInput["sortBy"], Prisma.TrainerProfileOrderByWithRelationInput> = {
    fullName: { user: { name: input.sortDirection } },
    employeeCode: { employeeCode: input.sortDirection },
    email: { user: { email: input.sortDirection } },
    department: { department: input.sortDirection },
    specialization: { specialization: input.sortDirection },
    status: { trainerStatus: input.sortDirection },
    availabilityStatus: { availabilityStatus: input.sortDirection },
    lastActiveAt: { user: { lastLoginAt: input.sortDirection } },
  };

  const [totalCount, trainers, specializationRecords, departmentRecords] = await prisma.$transaction([
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
    prisma.trainerProfile.findMany({
      where: { department: { not: null } },
      select: { department: true },
      distinct: ["department"],
      orderBy: { department: "asc" },
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
      departments: departmentRecords.map((record) => record.department).filter((d): d is string => Boolean(d)),
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
    const sharedQuery = {
      include: trainerSelect,
      orderBy: [{ isActive: "desc" as const }, { joinedAt: "desc" as const }],
      take: limit,
    };

    const [directMatches, matchingCourses] = await Promise.all([
      prisma.trainerProfile.findMany({
        where: {
          OR: [
            { user: { name: { contains: query, mode: "insensitive" } } },
            { user: { email: { contains: query, mode: "insensitive" } } },
            { employeeCode: { contains: query, mode: "insensitive" } },
            { specialization: { contains: query, mode: "insensitive" } },
          ],
        },
        ...sharedQuery,
      }),
      prisma.course.findMany({
        where: { name: { contains: query, mode: "insensitive" } },
        select: { id: true },
        take: 20,
      }),
    ]);

    const courseMatchIds = matchingCourses.map((course) => course.id);
    const courseMatches =
      courseMatchIds.length > 0
        ? await prisma.trainerProfile.findMany({
            where: {
              courseAssignments: {
                some: {
                  courseId: {
                    in: courseMatchIds,
                  },
                },
              },
            },
            ...sharedQuery,
          })
        : [];

    const seen = new Set<string>();
    const trainers = [...directMatches, ...courseMatches]
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
      department: trainer.department ?? null,
      jobTitle: null,
      specialization: trainer.specialization,
      skills: [],
      certifications: [],
      experienceYears: null,
      preferredLanguage: null,
      timeZone: null,
      profilePhotoUrl: null,
      bio: null,
      capacity: 0,
      status: trainer.trainerStatus ?? (trainer.isActive ? "ACTIVE" : "INACTIVE"),
      availabilityStatus: trainer.availabilityStatus,
      courses: trainer.courses,
      lastActiveAt: trainer.lastActiveAt,
      lastUpdatedAt: trainer.lastUpdatedAt,
      lastUpdatedByName: trainer.lastUpdatedByName,
    };
  }

  const trainer = await prisma.trainerProfile.findUnique({
    where: { id: trainerId },
    include: trainerSelect,
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
    department: trainer.department,
    jobTitle: trainer.jobTitle,
    specialization: trainer.specialization,
    skills: trainer.skills,
    certifications: trainer.certifications,
    experienceYears: trainer.experienceYears,
    preferredLanguage: trainer.preferredLanguage,
    timeZone: trainer.timeZone,
    profilePhotoUrl: resolveTrainerPhotoUrl(trainer.profilePhotoUrl),
    bio: trainer.bio,
    capacity: trainer.capacity,
    status: trainer.trainerStatus as TrainerStatus,
    availabilityStatus: trainer.availabilityStatus,
    courses: mapTrainerCourseNames(trainer as TrainerRecord),
    lastActiveAt: trainer.user.lastLoginAt?.toISOString() ?? null,
    lastUpdatedAt: trainer.user.updatedAt?.toISOString() ?? null,
    lastUpdatedByName: trainer.updatedBy?.name ?? null,
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
      courseAssignments: {
        some: {
          course: {
            name: {
              equals: normalizedCourseName,
              mode: "insensitive",
            },
          },
        },
      },
    },
    include: trainerSelect,
  });

  return trainers.map((trainer) => mapTrainerOption(trainer as TrainerRecord));
}

export async function getTrainerStatusHistoryService(trainerId: string): Promise<TrainerStatusHistoryItem[]> {
  if (!isDatabaseConfigured) {
    return [];
  }

  const records = await prisma.trainerStatusHistory.findMany({
    where: { trainerId },
    orderBy: { changedAt: "desc" },
    take: 50,
    include: {
      changedBy: {
        select: { id: true, name: true },
      },
    },
  });

  return records.map((record) => ({
    id: record.id,
    oldStatus: record.oldStatus as TrainerStatus,
    newStatus: record.newStatus as TrainerStatus,
    reason: record.reason,
    changedById: record.changedById,
    changedByName: record.changedBy?.name ?? null,
    changedAt: record.changedAt.toISOString(),
  }));
}