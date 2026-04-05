import { Prisma } from "@prisma/client";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { GetBatchEnrollmentCandidatesInput, GetBatchEnrolledLearnersInput } from "@/lib/validation-schemas/batches";
import { mapBatchRecord } from "@/services/batches/internal-helpers";
import { MOCK_BATCHES } from "@/services/batches/mock-data";
import { MOCK_LEARNERS } from "@/services/learners/internal-helpers";
import {
  BatchEnrollmentCandidatesResponse,
  BatchEnrolledLearnersResponse,
  BatchEnrollmentExportRow,
  BatchOption,
} from "@/services/batches/types";

const BATCH_SEARCH_SELECT = {
  id: true,
  code: true,
  name: true,
  campus: true,
  status: true,
  startDate: true,
  endDate: true,
  capacity: true,
  mode: true,
  schedule: true,
  trainer: { select: { id: true, user: { select: { name: true } } } },
  trainers: { select: { id: true, user: { select: { name: true } } } },
  program: { select: { name: true } },
} as const;

export async function listBatchesService(programName?: string): Promise<BatchOption[]> {
  const normalizedProgramName = programName?.trim();

  if (!isDatabaseConfigured) {
    return MOCK_BATCHES.filter((batch) =>
      normalizedProgramName ? batch.programName.toLowerCase() === normalizedProgramName.toLowerCase() : true,
    );
  }

  try {
    return await prisma.batch
      .findMany({
        where: normalizedProgramName
          ? {
              program: {
                name: {
                  equals: normalizedProgramName,
                  mode: "insensitive",
                },
              },
            }
          : undefined,
        orderBy: [{ startDate: "desc" }, { code: "asc" }],
        select: {
          id: true,
          code: true,
          name: true,
          campus: true,
          status: true,
          startDate: true,
          endDate: true,
          capacity: true,
          mode: true,
          schedule: true,
          trainer: {
            select: {
              id: true,
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
          trainers: {
            select: {
              id: true,
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
          program: {
            select: {
              name: true,
            },
          },
        },
      })
      .then((batches) => batches.map(mapBatchRecord));
  } catch (error) {
    console.warn("Batch list fallback activated", error);
    return MOCK_BATCHES.filter((batch) =>
      normalizedProgramName ? batch.programName.toLowerCase() === normalizedProgramName.toLowerCase() : true,
    );
  }
}

export async function searchBatchesService(query: string, limit: number): Promise<BatchOption[]> {
  const normalizedQuery = query.trim().toLowerCase();

  if (!isDatabaseConfigured) {
    return MOCK_BATCHES.filter(
      (batch) =>
        batch.code.toLowerCase().includes(normalizedQuery) ||
        batch.name.toLowerCase().includes(normalizedQuery) ||
        (batch.campus ?? "").toLowerCase().includes(normalizedQuery) ||
        batch.programName.toLowerCase().includes(normalizedQuery) ||
        batch.trainerNames.some((name) => name.toLowerCase().includes(normalizedQuery)),
    ).slice(0, limit);
  }

  try {
    return await prisma.batch
      .findMany({
        where: {
          OR: [
            { code: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
            { campus: { contains: query, mode: "insensitive" } },
            { program: { name: { contains: query, mode: "insensitive" } } },
            { trainer: { user: { name: { contains: query, mode: "insensitive" } } } },
            { trainers: { some: { user: { name: { contains: query, mode: "insensitive" } } } } },
          ],
        },
        orderBy: [{ startDate: "desc" }, { code: "asc" }],
        take: limit,
        select: BATCH_SEARCH_SELECT,
      })
      .then((batches) => batches.map(mapBatchRecord));
  } catch (error) {
    console.warn("Batch search fallback activated", error);
    return MOCK_BATCHES.filter(
      (batch) =>
        batch.code.toLowerCase().includes(normalizedQuery) ||
        batch.name.toLowerCase().includes(normalizedQuery) ||
        (batch.campus ?? "").toLowerCase().includes(normalizedQuery) ||
        batch.programName.toLowerCase().includes(normalizedQuery) ||
        batch.trainerNames.some((name) => name.toLowerCase().includes(normalizedQuery)),
    ).slice(0, limit);
  }
}

export async function getBatchByIdService(batchId: string): Promise<BatchOption | null> {
  if (!isDatabaseConfigured) {
    return MOCK_BATCHES.find((batch) => batch.id === batchId) ?? null;
  }

  try {
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: {
        program: { select: { name: true } },
        trainer: {
          select: {
            id: true,
            user: { select: { name: true } },
          },
        },
        trainers: {
          select: {
            id: true,
            user: { select: { name: true } },
          },
        },
      },
    });

    return batch ? mapBatchRecord(batch) : null;
  } catch (error) {
    console.warn("Batch detail fallback activated", error);
    return MOCK_BATCHES.find((batch) => batch.id === batchId) ?? null;
  }
}

export async function getBatchesForProgramService(programName: string): Promise<BatchOption[]> {
  const normalizedProgramName = programName.trim();

  if (!isDatabaseConfigured) {
    return MOCK_BATCHES.filter((batch) => batch.programName.toLowerCase() === normalizedProgramName.toLowerCase());
  }

  const program = await prisma.program.findFirst({
    where: { name: { equals: normalizedProgramName, mode: "insensitive" } },
    select: { id: true },
  });

  if (!program) {
    return [];
  }

  const batches = await prisma.batch.findMany({
    where: { programId: program.id },
    include: {
      program: { select: { name: true } },
      trainer: { select: { id: true, user: { select: { name: true } } } },
      trainers: { select: { id: true, user: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return batches.map((batch) => mapBatchRecord(batch));
}

export async function getBatchEnrolledLearnersService(
  batchId: string,
  input: GetBatchEnrolledLearnersInput,
): Promise<BatchEnrolledLearnersResponse> {
  const normalizedBatchId = batchId.trim();

  if (!isDatabaseConfigured) {
    const batch = MOCK_BATCHES.find((item) => item.id === normalizedBatchId);

    if (!batch) {
      throw new Error("Batch not found.");
    }

    const enrolled = MOCK_LEARNERS.filter((learner) => learner.batchCode?.toLowerCase() === batch.code.toLowerCase());
    const start = (input.page - 1) * input.pageSize;
    const items = enrolled.slice(start, start + input.pageSize).map((learner) => ({
      id: learner.id,
      learnerCode: learner.learnerCode,
      fullName: learner.fullName,
    }));

    return {
      items,
      totalCount: enrolled.length,
      page: input.page,
      pageSize: input.pageSize,
      pageCount: Math.max(1, Math.ceil(enrolled.length / input.pageSize)),
    };
  }

  const batch = await prisma.batch.findUnique({
    where: { id: normalizedBatchId },
    select: { id: true },
  });

  if (!batch) {
    throw new Error("Batch not found.");
  }

  const [totalCount, enrollments] = await prisma.$transaction([
    prisma.batchEnrollment.count({
      where: {
        batchId: normalizedBatchId,
      },
    }),
    prisma.batchEnrollment.findMany({
      where: {
        batchId: normalizedBatchId,
      },
      orderBy: [{ status: "asc" }, { joinedAt: "asc" }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: {
        learner: {
          select: {
            id: true,
            learnerCode: true,
            fullName: true,
          },
        },
      },
    }),
  ]);

  return {
    items: enrollments.map((enrollment) => ({
      id: enrollment.learner.id,
      learnerCode: enrollment.learner.learnerCode,
      fullName: enrollment.learner.fullName,
    })),
    totalCount,
    page: input.page,
    pageSize: input.pageSize,
    pageCount: Math.max(1, Math.ceil(totalCount / input.pageSize)),
  };
}

export async function getBatchEnrollmentCandidatesService(
  batchId: string,
  input: GetBatchEnrollmentCandidatesInput,
): Promise<BatchEnrollmentCandidatesResponse> {
  const normalizedBatchId = batchId.trim();
  const normalizedSearch = input.search.trim();
  const normalizedCourseId = input.courseId.trim();
  const normalizedProgramId = input.programId.trim();

  if (!isDatabaseConfigured) {
    const batch = MOCK_BATCHES.find((item) => item.id === normalizedBatchId);

    if (!batch) {
      throw new Error("Batch not found.");
    }

    const filtered = MOCK_LEARNERS.filter((learner) => {
      const notInBatch = learner.batchCode?.toLowerCase() !== batch.code.toLowerCase();
      const matchesSearch =
        normalizedSearch.length === 0 ||
        learner.fullName.toLowerCase().includes(normalizedSearch.toLowerCase()) ||
        learner.learnerCode.toLowerCase().includes(normalizedSearch.toLowerCase()) ||
        learner.email.toLowerCase().includes(normalizedSearch.toLowerCase());

      return notInBatch && matchesSearch;
    });

    const start = (input.page - 1) * input.pageSize;
    const items = filtered.slice(start, start + input.pageSize).map((learner) => ({
      id: learner.id,
      learnerCode: learner.learnerCode,
      fullName: learner.fullName,
      email: learner.email,
      phone: null,
      country: null,
      programId: null,
      programName: learner.programName,
      courseId: null,
      courseName: null,
      currentBatchCode: learner.batchCode,
      currentBatchName: learner.batchCode,
      campus: learner.campus,
    }));

    return {
      items,
      totalCount: filtered.length,
      page: input.page,
      pageSize: input.pageSize,
      pageCount: Math.max(1, Math.ceil(filtered.length / input.pageSize)),
    };
  }

  const batch = await prisma.batch.findUnique({
    where: { id: normalizedBatchId },
    select: { id: true },
  });

  if (!batch) {
    throw new Error("Batch not found.");
  }

  const filters: Prisma.LearnerWhereInput[] = [
    {
      enrollments: {
        none: {
          batchId: normalizedBatchId,
        },
      },
    },
  ];

  if (normalizedSearch.length > 0) {
    filters.push({
      OR: [
        { fullName: { contains: normalizedSearch, mode: "insensitive" } },
        { learnerCode: { contains: normalizedSearch, mode: "insensitive" } },
        { email: { contains: normalizedSearch, mode: "insensitive" } },
      ],
    });
  }

  if (normalizedProgramId.length > 0 || normalizedCourseId.length > 0) {
    filters.push({
      enrollments: {
        some: {
          status: "ACTIVE",
          batch: {
            ...(normalizedProgramId.length > 0 ? { programId: normalizedProgramId } : {}),
            ...(normalizedCourseId.length > 0 ? { program: { courseId: normalizedCourseId } } : {}),
          },
        },
      },
    });
  }

  const where: Prisma.LearnerWhereInput = {
    AND: filters,
  };

  const [totalCount, learners] = await prisma.$transaction([
    prisma.learner.count({ where }),
    prisma.learner.findMany({
      where,
      orderBy: { fullName: "asc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: {
        id: true,
        learnerCode: true,
        fullName: true,
        email: true,
        phone: true,
        country: true,
        enrollments: {
          where: { status: "ACTIVE" },
          orderBy: { joinedAt: "desc" },
          take: 1,
          select: {
            batch: {
              select: {
                code: true,
                name: true,
                campus: true,
                program: {
                  select: {
                    id: true,
                    name: true,
                    course: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    items: learners.map((learner) => {
      const currentEnrollment = learner.enrollments[0] ?? null;
      const currentBatch = currentEnrollment?.batch ?? null;

      return {
        id: learner.id,
        learnerCode: learner.learnerCode,
        fullName: learner.fullName,
        email: learner.email,
        phone: learner.phone,
        country: learner.country,
        programId: currentBatch?.program.id ?? null,
        programName: currentBatch?.program.name ?? null,
        courseId: currentBatch?.program.course.id ?? null,
        courseName: currentBatch?.program.course.name ?? null,
        currentBatchCode: currentBatch?.code ?? null,
        currentBatchName: currentBatch?.name ?? null,
        campus: currentBatch?.campus ?? null,
      };
    }),
    totalCount,
    page: input.page,
    pageSize: input.pageSize,
    pageCount: Math.max(1, Math.ceil(totalCount / input.pageSize)),
  };
}

export async function getBatchEnrollmentExportService(batchId: string): Promise<{ batchCode: string; rows: BatchEnrollmentExportRow[] }> {
  const normalizedBatchId = batchId.trim();

  if (!isDatabaseConfigured) {
    const batch = MOCK_BATCHES.find((item) => item.id === normalizedBatchId);

    if (!batch) {
      throw new Error("Batch not found.");
    }

    const rows: BatchEnrollmentExportRow[] = MOCK_LEARNERS.filter(
      (learner) => learner.batchCode?.toLowerCase() === batch.code.toLowerCase(),
    ).map((learner) => ({
      learnerCode: learner.learnerCode,
      learnerName: learner.fullName,
      learnerEmail: learner.email,
      learnerPhone: "",
      learnerCountry: "",
      placementStatus: learner.placementStatus,
      recruiterSyncStatus: learner.recruiterSyncStatus,
      readinessPercentage: String(learner.readinessPercentage),
      attendancePercentage: String(learner.attendancePercentage),
      averageScore: String(learner.averageScore),
      courseCode: "",
      courseName: "",
      programCode: "",
      programName: learner.programName ?? "",
      programType: learner.programType ?? "",
      batchCode: batch.code,
      batchName: batch.name,
      batchStatus: batch.status,
      batchMode: batch.mode ?? "",
      campus: batch.campus ?? "",
      enrollmentStatus: "ACTIVE",
      joinedAt: batch.startDate ? new Date(batch.startDate).toISOString() : "",
      completedAt: "",
      trainerNames: batch.trainerNames.join(", "),
    }));

    return {
      batchCode: batch.code,
      rows,
    };
  }

  const batch = await prisma.batch.findUnique({
    where: { id: normalizedBatchId },
    include: {
      program: {
        include: {
          course: {
            select: {
              code: true,
              name: true,
            },
          },
        },
      },
      trainer: {
        select: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
      trainers: {
        select: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
      enrollments: {
        orderBy: { joinedAt: "asc" },
        include: {
          learner: {
            select: {
              learnerCode: true,
              fullName: true,
              email: true,
              phone: true,
              country: true,
              placementStatus: true,
              recruiterSyncStatus: true,
              readinessPercentage: true,
              latestAttendancePercentage: true,
              latestAssessmentAverage: true,
            },
          },
        },
      },
    },
  });

  if (!batch) {
    throw new Error("Batch not found.");
  }

  const trainerNames = Array.from(
    new Set([batch.trainer?.user.name, ...batch.trainers.map((trainer) => trainer.user.name)].filter((name): name is string => Boolean(name))),
  ).join(", ");

  return {
    batchCode: batch.code,
    rows: batch.enrollments.map((enrollment) => ({
      learnerCode: enrollment.learner.learnerCode,
      learnerName: enrollment.learner.fullName,
      learnerEmail: enrollment.learner.email,
      learnerPhone: enrollment.learner.phone ?? "",
      learnerCountry: enrollment.learner.country ?? "",
      placementStatus: enrollment.learner.placementStatus,
      recruiterSyncStatus: enrollment.learner.recruiterSyncStatus,
      readinessPercentage: String(enrollment.learner.readinessPercentage),
      attendancePercentage: String(Number(enrollment.learner.latestAttendancePercentage)),
      averageScore: String(Number(enrollment.learner.latestAssessmentAverage)),
      courseCode: batch.program.course.code,
      courseName: batch.program.course.name,
      programCode: batch.program.code,
      programName: batch.program.name,
      programType: batch.program.type,
      batchCode: batch.code,
      batchName: batch.name,
      batchStatus: batch.status,
      batchMode: batch.mode,
      campus: batch.campus ?? "",
      enrollmentStatus: enrollment.status,
      joinedAt: enrollment.joinedAt.toISOString(),
      completedAt: enrollment.completedAt?.toISOString() ?? "",
      trainerNames,
    })),
  };
}
