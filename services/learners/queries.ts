import { Prisma } from "@prisma/client";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { GetLearnersInput } from "@/lib/validation-schemas/learners";
import {
  buildMockLearnerDetail,
  buildMockLearnersResponse,
  learnerDetailArgs,
  learnerEnrollmentArgs,
  learnerListArgs,
  mapLearnerToDetail,
  mapLearnerToListItem,
} from "@/services/learners/internal-helpers";
import { CandidateProfile, LearnerSearchItem } from "@/services/learners/types";
import { LearnersResponse } from "@/types";

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
        ...learnerListArgs,
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

export async function searchLearnersService(query: string, limit: number): Promise<LearnerSearchItem[]> {
  const normalizedQuery = query.trim().toLowerCase();

  if (!isDatabaseConfigured) {
    return buildMockLearnersResponse({
      search: normalizedQuery,
      page: 1,
      pageSize: limit,
      sortBy: "fullName",
      sortDirection: "asc",
      batchCode: "",
      placementStatus: undefined,
    }).items.map((learner) => ({
      id: learner.id,
      learnerCode: learner.learnerCode,
      fullName: learner.fullName,
      email: learner.email,
      programName: learner.programName,
      batchCode: learner.batchCode,
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

    return learners.map((learner) => {
      const enrollment = learner.enrollments[0] ?? null;
      return {
        id: learner.id,
        learnerCode: learner.learnerCode,
        fullName: learner.fullName,
        email: learner.email,
        programName: enrollment?.batch.program.name ?? null,
        batchCode: enrollment?.batch.code ?? null,
      };
    });
  } catch (error) {
    console.warn("Learner search fallback activated", error);
    return buildMockLearnersResponse({
      search: normalizedQuery,
      page: 1,
      pageSize: limit,
      sortBy: "fullName",
      sortDirection: "asc",
      batchCode: "",
      placementStatus: undefined,
    }).items.map((learner) => ({
      id: learner.id,
      learnerCode: learner.learnerCode,
      fullName: learner.fullName,
      email: learner.email,
      programName: learner.programName,
      batchCode: learner.batchCode,
    }));
  }
}

export async function getLearnerByCodeService(learnerCode: string) {
  if (!isDatabaseConfigured) {
    return buildMockLearnerDetail(learnerCode);
  }

  try {
    const learner = await prisma.learner.findUnique({ where: { learnerCode }, ...learnerDetailArgs });

    if (!learner) {
      return null;
    }

    return mapLearnerToDetail(learner);
  } catch (error) {
    console.warn("Learner detail fallback activated", error);
    return buildMockLearnerDetail(learnerCode);
  }
}

export async function getCandidateProfileByUserIdService(userId: string): Promise<CandidateProfile | null> {
  if (!isDatabaseConfigured) {
    const mockLearner = buildMockLearnerDetail("GTS-240901");

    if (!mockLearner) {
      return null;
    }

    return {
      ...mockLearner,
      userId,
      role: "CANDIDATE",
      pathway: "Germany Pathway",
    };
  }

  try {
    const learner = await prisma.learner.findFirst({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
          },
        },
        recruiterSyncLogs: { orderBy: { createdAt: "desc" }, take: 1 },
        enrollments: {
          where: { status: "ACTIVE" },
          orderBy: { joinedAt: "desc" },
          include: learnerEnrollmentArgs.include,
        },
      },
    });

    if (!learner || !learner.user?.id) {
      return null;
    }

    const activeEnrollment = learner.enrollments[0] ?? null;
    const pathway =
      [learner.targetCountry, learner.targetLanguage].filter((value): value is string => Boolean(value && value.trim().length > 0)).join(" / ") ||
      activeEnrollment?.batch.program.name ||
      "Candidate Pathway";

    return {
      ...mapLearnerToDetail(learner),
      userId: learner.user.id,
      role: "CANDIDATE",
      pathway,
    };
  } catch (error) {
    console.warn("Candidate profile query fallback activated", error);
    return null;
  }
}
