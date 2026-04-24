import { AssessmentAttemptStatus, EnrollmentStatus } from "@prisma/client";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import type {
  TrainerActivityItem,
  TrainerActivityResponse,
  TrainerPerformanceSummary,
} from "@/services/trainers/types";

function roundToSingleDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

export async function getTrainerPerformanceService(trainerId: string): Promise<TrainerPerformanceSummary> {
  if (!isDatabaseConfigured) {
    return {
      trainerId,
      assignedCourses: 0,
      numberOfLearners: 0,
      completionRate: 0,
      averageLearnerScore: 0,
      pendingReviews: 0,
      lastActiveAt: null,
    };
  }

  const trainer = await prisma.trainerProfile.findUnique({
    where: { id: trainerId },
    select: {
      id: true,
      user: {
        select: {
          lastLoginAt: true,
        },
      },
    },
  });

  if (!trainer) {
    throw new Error("Trainer not found.");
  }

  const [assignedCourses, batchRows, pendingReviews, scoreAggregate] = await Promise.all([
    prisma.trainerCourseAssignment.count({ where: { trainerId } }),
    prisma.batch.findMany({
      where: {
        OR: [
          { trainerId },
          { trainers: { some: { id: trainerId } } },
        ],
      },
      select: {
        id: true,
      },
      distinct: ["id"],
    }),
    prisma.assessmentAttempt.count({
      where: {
        status: {
          in: [AssessmentAttemptStatus.PENDING_REVIEW, AssessmentAttemptStatus.IN_REVIEW],
        },
        assessmentPool: {
          trainerAssignments: {
            some: {
              trainerId,
              isActive: true,
              OR: [
                { canReviewSubmissions: true },
                { canManageAttempts: true },
                { canManualGrade: true },
              ],
            },
          },
        },
      },
    }),
    prisma.assessmentScore.aggregate({
      _avg: {
        score: true,
      },
      where: {
        assessment: {
          batch: {
            OR: [
              { trainerId },
              { trainers: { some: { id: trainerId } } },
            ],
          },
        },
      },
    }),
  ]);

  const batchIds = batchRows.map((batch) => batch.id);

  let numberOfLearners = 0;
  let completionRate = 0;

  if (batchIds.length > 0) {
    const [activeLearners, completedLearners] = await Promise.all([
      prisma.batchEnrollment.count({
        where: {
          batchId: { in: batchIds },
          status: EnrollmentStatus.ACTIVE,
        },
      }),
      prisma.batchEnrollment.count({
        where: {
          batchId: { in: batchIds },
          status: EnrollmentStatus.COMPLETED,
        },
      }),
    ]);

    numberOfLearners = activeLearners + completedLearners;
    completionRate = numberOfLearners > 0 ? roundToSingleDecimal((completedLearners / numberOfLearners) * 100) : 0;
  }

  return {
    trainerId,
    assignedCourses,
    numberOfLearners,
    completionRate,
    averageLearnerScore: roundToSingleDecimal(scoreAggregate._avg.score ?? 0),
    pendingReviews,
    lastActiveAt: trainer.user.lastLoginAt?.toISOString() ?? null,
  };
}

type ListTrainerActivityInput = {
  trainerId: string;
  page: number;
  pageSize: number;
};

export async function listTrainerActivityService(input: ListTrainerActivityInput): Promise<TrainerActivityResponse> {
  if (!isDatabaseConfigured) {
    return {
      items: [],
      totalCount: 0,
      page: input.page,
      pageSize: input.pageSize,
      pageCount: 1,
    };
  }

  const trainer = await prisma.trainerProfile.findUnique({
    where: { id: input.trainerId },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!trainer) {
    throw new Error("Trainer not found.");
  }

  const [courseAssignments, assessmentAssignments, userActivities, auditLogs] = await Promise.all([
    prisma.trainerCourseAssignment.findMany({
      where: {
        trainerId: input.trainerId,
      },
      select: {
        trainerId: true,
        assignedAt: true,
        course: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        assignedAt: "desc",
      },
      take: 200,
    }),
    prisma.trainerAssessmentAssignment.findMany({
      where: {
        trainerId: input.trainerId,
      },
      select: {
        id: true,
        assignedAt: true,
        updatedAt: true,
        canReviewSubmissions: true,
        canManageAttempts: true,
        canManualGrade: true,
        assessmentPool: {
          select: {
            id: true,
            title: true,
            code: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 200,
    }),
    prisma.userActivityLog.findMany({
      where: {
        userId: trainer.userId,
      },
      select: {
        id: true,
        activityType: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 200,
    }),
    prisma.auditLog.findMany({
      where: {
        OR: [
          { actorUserId: trainer.userId },
          {
            entityType: "AUTH",
            entityId: trainer.userId,
          },
        ],
      },
      select: {
        id: true,
        action: true,
        message: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 200,
    }),
  ]);

  const timeline: TrainerActivityItem[] = [
    ...courseAssignments.map((assignment) => ({
      id: `course:${assignment.trainerId}:${assignment.course.id}:${assignment.assignedAt.toISOString()}`,
      type: "COURSE_ASSIGNMENT" as const,
      title: `Assigned to course ${assignment.course.name}`,
      occurredAt: assignment.assignedAt.toISOString(),
      metadata: {
        courseId: assignment.course.id,
        courseName: assignment.course.name,
      },
    })),
    ...assessmentAssignments.map((assignment) => ({
      id: `assessment:${assignment.id}`,
      type: "QUIZ_ASSIGNMENT" as const,
      title: `Quiz access updated for ${assignment.assessmentPool.title}`,
      occurredAt: assignment.updatedAt.toISOString(),
      metadata: {
        assessmentPoolId: assignment.assessmentPool.id,
        assessmentCode: assignment.assessmentPool.code,
        canReviewSubmissions: assignment.canReviewSubmissions,
        canManageAttempts: assignment.canManageAttempts,
        canManualGrade: assignment.canManualGrade,
      },
    })),
    ...userActivities.map((activity) => ({
      id: `login:${activity.id}`,
      type: "LOGIN" as const,
      title: `User activity: ${activity.activityType}`,
      occurredAt: activity.createdAt.toISOString(),
      metadata: {
        activityType: activity.activityType,
      },
    })),
    ...auditLogs.map((audit) => ({
      id: `audit:${audit.id}`,
      type: "AUDIT" as const,
      title: audit.message,
      occurredAt: audit.createdAt.toISOString(),
      metadata: {
        action: audit.action,
      },
    })),
  ];

  timeline.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));

  const totalCount = timeline.length;
  const startIndex = (input.page - 1) * input.pageSize;
  const items = timeline.slice(startIndex, startIndex + input.pageSize);

  return {
    items,
    totalCount,
    page: input.page,
    pageSize: input.pageSize,
    pageCount: Math.max(1, Math.ceil(totalCount / input.pageSize)),
  };
}
