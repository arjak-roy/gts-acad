import "server-only";

import { Prisma } from "@prisma/client";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { CreateLearnerInput, GetLearnersInput } from "@/lib/validation-schemas/learners";
import { LearnerDetail, LearnerListItem, LearnersResponse } from "@/types";

const MOCK_LEARNERS: LearnerListItem[] = [
  {
    id: "clx1",
    learnerCode: "GTS-240901",
    fullName: "Aditya Sharma",
    email: "aditya.sharma@gts-academy.test",
    attendancePercentage: 98.4,
    averageScore: 84,
    readinessPercentage: 82,
    placementStatus: "PLACEMENT_READY" as const,
    recruiterSyncStatus: "NOT_SYNCED" as const,
    programName: "German Language (B1)",
    batchCode: "B-GER-NOV",
    campus: "Main Campus",
    trainerName: "Dr. Markus S.",
    programType: "LANGUAGE" as const,
  },
  {
    id: "clx2",
    learnerCode: "GTS-240902",
    fullName: "Meera Nair",
    email: "meera.nair@gts-academy.test",
    attendancePercentage: 92.1,
    averageScore: 79,
    readinessPercentage: 76,
    placementStatus: "IN_REVIEW" as const,
    recruiterSyncStatus: "NOT_SYNCED" as const,
    programName: "Clinical Bridging",
    batchCode: "B-CLI-OCT",
    campus: "South Wing",
    trainerName: "Dr. Leena P.",
    programType: "CLINICAL" as const,
  },
  {
    id: "clx3",
    learnerCode: "GTS-240903",
    fullName: "Arjun Mehta",
    email: "arjun.mehta@gts-academy.test",
    attendancePercentage: 88.7,
    averageScore: 81,
    readinessPercentage: 85,
    placementStatus: "PLACEMENT_READY" as const,
    recruiterSyncStatus: "SYNCED" as const,
    programName: "German Language (B1)",
    batchCode: "B-GER-OCT-01",
    campus: "Main Campus",
    trainerName: "Dr. Markus S.",
    programType: "LANGUAGE" as const,
  },
];

/**
 * Converts a Prisma learner record into the lean table row shape.
 * Flattens active enrollment metadata needed by list views.
 * Keeps mapping logic isolated so DB schema changes are easier to contain.
 */
function mapLearnerToListItem(
  learner: Prisma.LearnerGetPayload<{
    include: {
      enrollments: {
        include: {
          batch: {
            include: {
              program: true;
              trainer: { include: { user: true } };
              trainers: { include: { user: true } };
            };
          };
        };
      };
    };
  }>,
): LearnerListItem {
  const enrollment = learner.enrollments[0];
  const trainerNames = enrollment?.batch
    ? Array.from(
        new Set([
          ...enrollment.batch.trainers.map((trainer) => trainer.user.name),
          enrollment.batch.trainer?.user.name,
        ].filter(Boolean)),
      )
    : [];

  return {
    id: learner.id,
    learnerCode: learner.learnerCode,
    fullName: learner.fullName,
    email: learner.email,
    attendancePercentage: Number(learner.latestAttendancePercentage),
    averageScore: Number(learner.latestAssessmentAverage),
    readinessPercentage: learner.readinessPercentage,
    placementStatus: learner.placementStatus,
    recruiterSyncStatus: learner.recruiterSyncStatus,
    programName: enrollment?.batch.program.name ?? null,
    batchCode: enrollment?.batch.code ?? null,
    campus: enrollment?.batch.campus ?? null,
    trainerName: trainerNames.length > 0 ? trainerNames.join(", ") : null,
    programType: enrollment?.batch.program.type ?? null,
  };
}

/**
 * Sorts local mock learners using the same sort contract as DB queries.
 * Applies direction handling once to avoid duplicated comparison logic.
 * Preserves parity between mock mode and production mode table behavior.
 */
function sortMockLearners(items: LearnerListItem[], input: GetLearnersInput) {
  const direction = input.sortDirection === "asc" ? 1 : -1;

  return [...items].sort((left, right) => {
    switch (input.sortBy) {
      case "attendancePercentage":
        return (left.attendancePercentage - right.attendancePercentage) * direction;
      case "averageScore":
        return (left.averageScore - right.averageScore) * direction;
      case "readinessPercentage":
        return (left.readinessPercentage - right.readinessPercentage) * direction;
      default:
        return left.fullName.localeCompare(right.fullName) * direction;
    }
  });
}

/**
 * Builds a fully paginated learners response from in-memory fallback data.
 * Applies search, batch, and placement filters before pagination.
 * Mirrors production response structure so UI code is environment-agnostic.
 */
function buildMockLearnersResponse(input: GetLearnersInput): LearnersResponse {
  const filtered = MOCK_LEARNERS.filter((learner) => {
    const matchesSearch =
      input.search.length === 0 ||
      learner.fullName.toLowerCase().includes(input.search.toLowerCase()) ||
      learner.learnerCode.toLowerCase().includes(input.search.toLowerCase()) ||
      learner.email.toLowerCase().includes(input.search.toLowerCase());
    const matchesBatch = input.batchCode.length === 0 || learner.batchCode?.toLowerCase() === input.batchCode.toLowerCase();
    const matchesStatus = !input.placementStatus || learner.placementStatus === input.placementStatus;
    return matchesSearch && matchesBatch && matchesStatus;
  });

  const sorted = sortMockLearners(filtered, input);
  const start = (input.page - 1) * input.pageSize;
  const items = sorted.slice(start, start + input.pageSize);

  return {
    items,
    totalCount: sorted.length,
    page: input.page,
    pageSize: input.pageSize,
    pageCount: Math.max(1, Math.ceil(sorted.length / input.pageSize)),
  };
}

/**
 * Produces a mock learner detail record for sheet and profile rendering.
 * Adds demo-only fields that are not present in the list response.
 * Returns null when the requested learner code does not exist in mocks.
 */
function buildMockLearnerDetail(learnerCode: string): LearnerDetail | null {
  const learner = MOCK_LEARNERS.find((entry) => entry.learnerCode === learnerCode);
  return learner
    ? {
        ...learner,
        phone: "+91 98765 43210",
        country: "India",
        softSkillsScore: 81,
        latestSyncMessage: learner.recruiterSyncStatus === "SYNCED" ? "Synced to Recruiter Workspace" : null,
      }
    : null;
}

function buildLearnerCodePrefix(date = new Date()) {
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `GTS-${year}${month}${day}`;
}

function buildMockLearnerCode() {
  const prefix = buildLearnerCodePrefix();
  const suffix = String(Date.now()).slice(-4);
  return `${prefix}-${suffix}`;
}

async function generateLearnerCode() {
  const prefix = buildLearnerCodePrefix();
  const latestLearner = await prisma.learner.findFirst({
    where: {
      learnerCode: {
        startsWith: `${prefix}-`,
      },
    },
    orderBy: {
      learnerCode: "desc",
    },
    select: {
      learnerCode: true,
    },
  });

  const currentSequence = latestLearner?.learnerCode.match(/-(\d+)$/)?.[1];
  const nextSequence = (currentSequence ? Number(currentSequence) : 0) + 1;

  return `${prefix}-${String(nextSequence).padStart(2, "0")}`;
}

function isLearnerCodeConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;
  const targetText = Array.isArray(target) ? target.join(",") : String(target ?? "");
  return targetText.includes("learnerCode") || targetText.includes("candidate_code");
}

/**
 * Fetches learner list data with filters, sorting, and pagination controls.
 * Runs Prisma queries in configured environments and mock logic otherwise.
 * Guarantees a stable response object for table and URL-driven state.
 */
export async function getLearnersService(input: GetLearnersInput): Promise<LearnersResponse> {
  const sortMap: Record<GetLearnersInput["sortBy"], Prisma.LearnerOrderByWithRelationInput> = {
    fullName: { fullName: input.sortDirection },
    attendancePercentage: { latestAttendancePercentage: input.sortDirection },
    averageScore: { latestAssessmentAverage: input.sortDirection },
    readinessPercentage: { readinessPercentage: input.sortDirection },
  };

  const where: Prisma.LearnerWhereInput = {
    ...(input.search
      ? {
          OR: [
            { fullName: { contains: input.search, mode: "insensitive" } },
            { learnerCode: { contains: input.search, mode: "insensitive" } },
            { email: { contains: input.search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(input.placementStatus ? { placementStatus: input.placementStatus } : {}),
    ...(input.batchCode
      ? {
          enrollments: {
            some: {
              status: "ACTIVE",
              batch: {
                code: { equals: input.batchCode, mode: "insensitive" },
              },
            },
          },
        }
      : {}),
  };

  if (!isDatabaseConfigured) {
    return buildMockLearnersResponse(input);
  }

  try {
    const [totalCount, learners] = await prisma.$transaction([
      prisma.learner.count({ where }),
      prisma.learner.findMany({
        where,
        orderBy: sortMap[input.sortBy],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        include: {
          enrollments: {
            where: { status: "ACTIVE" },
            orderBy: { joinedAt: "desc" },
            take: 1,
            include: {
              batch: {
                include: {
                  program: true,
                  trainer: { include: { user: true } },
                  trainers: { include: { user: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      items: learners.map(mapLearnerToListItem),
      totalCount,
      page: input.page,
      pageSize: input.pageSize,
      pageCount: Math.max(1, Math.ceil(totalCount / input.pageSize)),
    };
  } catch (error) {
    console.warn("Learner query fallback activated", error);
    return buildMockLearnersResponse(input);
  }
}

export type LearnerSearchItem = {
  id: string;
  learnerCode: string;
  fullName: string;
  email: string;
  programName: string | null;
  batchCode: string | null;
};

export async function searchLearnersService(query: string, limit: number): Promise<LearnerSearchItem[]> {
  const normalizedQuery = query.trim().toLowerCase();

  if (!isDatabaseConfigured) {
    return MOCK_LEARNERS.filter(
      (l) =>
        l.fullName.toLowerCase().includes(normalizedQuery) ||
        l.learnerCode.toLowerCase().includes(normalizedQuery) ||
        l.email.toLowerCase().includes(normalizedQuery),
    )
      .slice(0, limit)
      .map((l) => ({
        id: l.id,
        learnerCode: l.learnerCode,
        fullName: l.fullName,
        email: l.email,
        programName: l.programName,
        batchCode: l.batchCode,
      }));
  }

  try {
    const learners = await prisma.learner.findMany({
      where: {
        OR: [
          { fullName: { contains: query, mode: "insensitive" } },
          { learnerCode: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        learnerCode: true,
        fullName: true,
        email: true,
        enrollments: {
          where: { status: "ACTIVE" },
          orderBy: { joinedAt: "desc" },
          take: 1,
          select: {
            batch: {
              select: {
                code: true,
                program: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    return learners.map((l) => {
      const enrollment = l.enrollments[0] ?? null;
      return {
        id: l.id,
        learnerCode: l.learnerCode,
        fullName: l.fullName,
        email: l.email,
        programName: enrollment?.batch.program.name ?? null,
        batchCode: enrollment?.batch.code ?? null,
      };
    });
  } catch (error) {
    console.warn("Learner search fallback activated", error);
    return MOCK_LEARNERS.filter(
      (l) =>
        l.fullName.toLowerCase().includes(normalizedQuery) ||
        l.learnerCode.toLowerCase().includes(normalizedQuery) ||
        l.email.toLowerCase().includes(normalizedQuery),
    )
      .slice(0, limit)
      .map((l) => ({
        id: l.id,
        learnerCode: l.learnerCode,
        fullName: l.fullName,
        email: l.email,
        programName: l.programName,
        batchCode: l.batchCode,
      }));
  }
}

/**
 * Fetches a single learner detail payload by unique learner code.
 * Supports both Prisma-backed retrieval and mock fallback behavior.
 * Returns null when the learner does not exist in the selected data source.
 */
export async function getLearnerByCodeService(learnerCode: string): Promise<LearnerDetail | null> {
  if (!isDatabaseConfigured) {
    return buildMockLearnerDetail(learnerCode);
  }

  try {
    const learner = await prisma.learner.findUnique({
      where: { learnerCode },
      include: {
        recruiterSyncLogs: { orderBy: { createdAt: "desc" }, take: 1 },
        enrollments: {
          where: { status: "ACTIVE" },
          orderBy: { joinedAt: "desc" },
          take: 1,
          include: {
            batch: {
              include: {
                program: true,
                trainer: { include: { user: true } },
                trainers: { include: { user: true } },
              },
            },
          },
        },
      },
    });

    if (!learner) {
      return null;
    }

    const base = mapLearnerToListItem(learner);
    return {
      ...base,
      phone: learner.phone,
      country: learner.country,
      softSkillsScore: learner.softSkillsScore,
      latestSyncMessage: learner.recruiterSyncLogs[0]?.message ?? null,
    };
  } catch (error) {
    console.warn("Learner detail fallback activated", error);
    return buildMockLearnerDetail(learnerCode);
  }
}

/**
 * Creates a learner candidate and optionally enrolls them into a batch.
 * Generates a unique learner code server-side and enforces email uniqueness.
 * Returns the created learner shape used by list and detail consumers.
 */
export async function createLearnerService(input: CreateLearnerInput): Promise<LearnerDetail> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedFullName = input.fullName.trim();
  const normalizedPhone = input.phone.trim() || null;
  const normalizedCampus = input.campus.trim() || null;
  const normalizedProgramName = input.programName.trim();
  const normalizedBatchCode = input.batchCode.trim();

  if (!isDatabaseConfigured) {
    const nowId = `mock-${Date.now()}`;
    return {
      id: nowId,
      learnerCode: buildMockLearnerCode(),
      fullName: normalizedFullName,
      email: normalizedEmail,
      phone: normalizedPhone,
      country: normalizedCampus,
      attendancePercentage: 0,
      averageScore: 0,
      readinessPercentage: 0,
      placementStatus: "NOT_READY",
      recruiterSyncStatus: "NOT_SYNCED",
      programName: normalizedProgramName,
      batchCode: normalizedBatchCode || null,
      campus: normalizedCampus,
      trainerName: null,
      programType: null,
      softSkillsScore: 0,
      latestSyncMessage: null,
    };
  }

  const existingEmail = await prisma.learner.findUnique({ where: { email: normalizedEmail }, select: { id: true } });

  if (existingEmail) {
    throw new Error("Email already exists.");
  }

  const batch = normalizedBatchCode
    ? await prisma.batch.findFirst({
        where: { code: { equals: normalizedBatchCode, mode: "insensitive" } },
        select: { id: true },
      })
    : null;

  if (normalizedBatchCode && !batch) {
    throw new Error("Invalid batch code.");
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const generatedLearnerCode = await generateLearnerCode();

    try {
      const learner = await prisma.$transaction(async (tx) => {
        const created = await tx.learner.create({
          data: {
            learnerCode: generatedLearnerCode,
            fullName: normalizedFullName,
            email: normalizedEmail,
            phone: normalizedPhone,
            country: normalizedCampus,
          },
          include: {
            enrollments: {
              where: { status: "ACTIVE" },
              orderBy: { joinedAt: "desc" },
              take: 1,
              include: {
                batch: {
                  include: {
                    program: true,
                    trainer: { include: { user: true } },
                    trainers: { include: { user: true } },
                  },
                },
              },
            },
          },
        });

        if (batch) {
          await tx.batchEnrollment.create({
            data: {
              learnerId: created.id,
              batchId: batch.id,
              status: "ACTIVE",
            },
          });

          return tx.learner.findUniqueOrThrow({
            where: { id: created.id },
            include: {
              enrollments: {
                where: { status: "ACTIVE" },
                orderBy: { joinedAt: "desc" },
                take: 1,
                include: {
                  batch: {
                    include: {
                      program: true,
                      trainer: { include: { user: true } },
                      trainers: { include: { user: true } },
                    },
                  },
                },
              },
            },
          });
        }

        return created;
      });

      const mapped = mapLearnerToListItem(learner);
      return {
        ...mapped,
        phone: learner.phone,
        country: learner.country,
        softSkillsScore: learner.softSkillsScore,
        latestSyncMessage: null,
      };
    } catch (error) {
      if (isLearnerCodeConflict(error)) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Unable to generate learner code.");
}