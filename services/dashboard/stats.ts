import "server-only";

import { AuditLogLevel, ProgramType as PrismaProgramType } from "@prisma/client";

import { getCourseStatusAccent, getCourseStatusLabel } from "@/lib/course-status";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { CourseStatus, DashboardPendingActionItem, DashboardRecentActivityItem, DashboardStats, ProgramType } from "@/types";
import { DEFAULT_DASHBOARD_STATS } from "@/services/dashboard/types";

type DashboardStatsFiltersInput = {
  programType?: DashboardStats["filters"]["programType"];
  courseId?: string | null;
  programId?: string | null;
  batchId?: string | null;
};

type DashboardScopeResolution = {
  filters: DashboardStats["filters"];
  scope: DashboardStats["scope"];
  courseIds: string[] | null;
  programIds: string[] | null;
  batchIds: string[] | null;
};

const PROGRAM_TYPE_LABELS: Record<PrismaProgramType, string> = {
  LANGUAGE: "Language",
  CLINICAL: "Clinical",
  TECHNICAL: "Technical",
};

function normalizeOptionalId(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeOptionalProgramType(value?: string | null) {
  const normalized = value?.trim().toUpperCase();

  if (!normalized) {
    return null;
  }

  return Object.values(ProgramType).includes(normalized as (typeof ProgramType)[keyof typeof ProgramType])
    ? (normalized as DashboardStats["filters"]["programType"])
    : null;
}

function hasFilteredDashboardView(filters: DashboardStatsFiltersInput) {
  return Boolean(filters.programType || filters.courseId || filters.programId || filters.batchId);
}

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function buildMonthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function buildMonthLabel(date: Date) {
  return date.toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" });
}

function buildLastSixMonths() {
  const months: Array<{ key: string; label: string }> = [];
  const now = new Date();
  const anchor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  for (let offset = 5; offset >= 0; offset -= 1) {
    const month = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - offset, 1));
    months.push({
      key: buildMonthKey(month),
      label: buildMonthLabel(month),
    });
  }

  return months;
}

function buildAssessmentPoolWhere(courseIds: string[] | null, publishedOnly = false) {
  const base = publishedOnly ? { status: "PUBLISHED" as const } : {};

  if (!courseIds) {
    return base;
  }

  return {
    ...base,
    OR: [
      { courseId: { in: courseIds } },
      { courseAssessmentLinks: { some: { courseId: { in: courseIds } } } },
    ],
  };
}

function formatProgramTypeLabel(programType: DashboardStats["filters"]["programType"]) {
  return programType ? PROGRAM_TYPE_LABELS[programType as PrismaProgramType] ?? programType : null;
}

function formatActivityTypeLabel(activityType: string) {
  return activityType.toLowerCase().replace(/_/g, " ");
}

function formatToneFromLogLevel(level: AuditLogLevel): DashboardRecentActivityItem["tone"] {
  if (level === "ERROR") {
    return "danger";
  }

  if (level === "WARN") {
    return "warning";
  }

  return "info";
}

async function resolveDashboardScope(filtersInput: DashboardStatsFiltersInput): Promise<DashboardScopeResolution> {
  const normalizedFilters = {
    programType: normalizeOptionalProgramType(filtersInput.programType),
    courseId: normalizeOptionalId(filtersInput.courseId),
    programId: normalizeOptionalId(filtersInput.programId),
    batchId: normalizeOptionalId(filtersInput.batchId),
  };

  if (normalizedFilters.batchId) {
    const batch = await prisma.batch.findUnique({
      where: { id: normalizedFilters.batchId },
      select: {
        id: true,
        name: true,
        programId: true,
        program: {
          select: {
            name: true,
            type: true,
            courseId: true,
            course: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!batch) {
      throw new Error("Batch not found.");
    }

    if (normalizedFilters.programId && normalizedFilters.programId !== batch.programId) {
      throw new Error("Selected batch does not belong to the selected program.");
    }

    if (normalizedFilters.courseId && normalizedFilters.courseId !== batch.program.courseId) {
      throw new Error("Selected batch does not belong to the selected course.");
    }

    if (normalizedFilters.programType && normalizedFilters.programType !== batch.program.type) {
      throw new Error("Selected batch does not belong to the selected course category.");
    }

    return {
      filters: {
        programType: batch.program.type,
        courseId: batch.program.courseId,
        programId: batch.programId,
        batchId: batch.id,
      },
      scope: {
        viewMode: "FILTERED",
        programTypeLabel: PROGRAM_TYPE_LABELS[batch.program.type],
        courseName: batch.program.course.name,
        programName: batch.program.name,
        batchName: batch.name,
      },
      courseIds: [batch.program.courseId],
      programIds: [batch.programId],
      batchIds: [batch.id],
    };
  }

  if (normalizedFilters.programId) {
    const program = await prisma.program.findUnique({
      where: { id: normalizedFilters.programId },
      select: {
        id: true,
        name: true,
        type: true,
        courseId: true,
        course: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!program) {
      throw new Error("Program not found.");
    }

    if (normalizedFilters.courseId && normalizedFilters.courseId !== program.courseId) {
      throw new Error("Selected program does not belong to the selected course.");
    }

    if (normalizedFilters.programType && normalizedFilters.programType !== program.type) {
      throw new Error("Selected program does not belong to the selected course category.");
    }

    const batches = await prisma.batch.findMany({
      where: {
        programId: program.id,
      },
      select: {
        id: true,
      },
    });

    return {
      filters: {
        programType: program.type,
        courseId: program.courseId,
        programId: program.id,
        batchId: null,
      },
      scope: {
        viewMode: "FILTERED",
        programTypeLabel: PROGRAM_TYPE_LABELS[program.type],
        courseName: program.course.name,
        programName: program.name,
        batchName: null,
      },
      courseIds: [program.courseId],
      programIds: [program.id],
      batchIds: batches.map((batch) => batch.id),
    };
  }

  if (normalizedFilters.courseId) {
    const course = await prisma.course.findUnique({
      where: { id: normalizedFilters.courseId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!course) {
      throw new Error("Course not found.");
    }

    const programs = await prisma.program.findMany({
      where: {
        courseId: course.id,
        ...(normalizedFilters.programType ? { type: normalizedFilters.programType } : {}),
      },
      select: {
        id: true,
      },
    });
    const programIds = programs.map((program) => program.id);
    const batches = programIds.length > 0
      ? await prisma.batch.findMany({
          where: {
            programId: {
              in: programIds,
            },
          },
          select: {
            id: true,
          },
        })
      : [];

    return {
      filters: {
        programType: normalizedFilters.programType,
        courseId: course.id,
        programId: null,
        batchId: null,
      },
      scope: {
        viewMode: "FILTERED",
        programTypeLabel: formatProgramTypeLabel(normalizedFilters.programType),
        courseName: course.name,
        programName: null,
        batchName: null,
      },
      courseIds: normalizedFilters.programType && programIds.length === 0 ? [] : [course.id],
      programIds,
      batchIds: batches.map((batch) => batch.id),
    };
  }

  if (normalizedFilters.programType) {
    const programs = await prisma.program.findMany({
      where: {
        type: normalizedFilters.programType,
      },
      select: {
        id: true,
        courseId: true,
      },
    });
    const programIds = programs.map((program) => program.id);
    const courseIds = Array.from(new Set(programs.map((program) => program.courseId)));
    const batches = programIds.length > 0
      ? await prisma.batch.findMany({
          where: {
            programId: {
              in: programIds,
            },
          },
          select: {
            id: true,
          },
        })
      : [];

    return {
      filters: {
        programType: normalizedFilters.programType,
        courseId: null,
        programId: null,
        batchId: null,
      },
      scope: {
        viewMode: "FILTERED",
        programTypeLabel: PROGRAM_TYPE_LABELS[normalizedFilters.programType],
        courseName: null,
        programName: null,
        batchName: null,
      },
      courseIds,
      programIds,
      batchIds: batches.map((batch) => batch.id),
    };
  }

  return {
    filters: {
      programType: null,
      courseId: null,
      programId: null,
      batchId: null,
    },
    scope: {
      viewMode: "GLOBAL",
      programTypeLabel: null,
      courseName: null,
      programName: null,
      batchName: null,
    },
    courseIds: null,
    programIds: null,
    batchIds: null,
  };
}

async function buildTrainerWorkload(batchIds: string[] | null) {
  const now = new Date();
  const upcomingWindow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const batches = await prisma.batch.findMany({
    where: {
      ...(batchIds ? { id: { in: batchIds } } : {}),
      status: {
        in: ["PLANNED", "IN_SESSION"],
      },
    },
    select: {
      id: true,
      trainerId: true,
      trainers: {
        select: {
          id: true,
        },
      },
      enrollments: {
        where: {
          status: "ACTIVE",
        },
        select: {
          id: true,
        },
      },
      scheduleEvents: {
        where: {
          startsAt: {
            gte: now,
            lt: upcomingWindow,
          },
        },
        select: {
          id: true,
        },
      },
    },
  });

  if (batches.length === 0) {
    return [];
  }

  const aggregatedByTrainerId = new Map<string, { activeBatches: number; activeLearners: number; upcomingSessions: number }>();

  for (const batch of batches) {
    const assignedTrainerIds = new Set<string>([
      ...(batch.trainerId ? [batch.trainerId] : []),
      ...batch.trainers.map((trainer) => trainer.id),
    ]);

    for (const trainerId of assignedTrainerIds) {
      const current = aggregatedByTrainerId.get(trainerId) ?? {
        activeBatches: 0,
        activeLearners: 0,
        upcomingSessions: 0,
      };
      current.activeBatches += 1;
      current.activeLearners += batch.enrollments.length;
      current.upcomingSessions += batch.scheduleEvents.length;
      aggregatedByTrainerId.set(trainerId, current);
    }
  }

  const trainerProfiles = await prisma.trainerProfile.findMany({
    where: {
      id: {
        in: Array.from(aggregatedByTrainerId.keys()),
      },
      isActive: true,
    },
    select: {
      id: true,
      specialization: true,
      capacity: true,
      user: {
        select: {
          name: true,
        },
      },
    },
  });

  return trainerProfiles
    .map((trainer) => {
      const aggregate = aggregatedByTrainerId.get(trainer.id) ?? {
        activeBatches: 0,
        activeLearners: 0,
        upcomingSessions: 0,
      };

      return {
        id: trainer.id,
        name: trainer.user.name,
        specialization: trainer.specialization,
        activeBatches: aggregate.activeBatches,
        activeLearners: aggregate.activeLearners,
        upcomingSessions: aggregate.upcomingSessions,
        capacity: trainer.capacity,
      };
    })
    .sort((left, right) => {
      if (right.activeBatches !== left.activeBatches) {
        return right.activeBatches - left.activeBatches;
      }

      if (right.activeLearners !== left.activeLearners) {
        return right.activeLearners - left.activeLearners;
      }

      return left.name.localeCompare(right.name, "en", { sensitivity: "base" });
    })
    .slice(0, 6);
}

async function buildRecentActivity(scope: DashboardScopeResolution): Promise<DashboardRecentActivityItem[]> {
  const auditWhere = scope.batchIds
    ? {
        entityType: "BATCH" as const,
        entityId: {
          in: scope.batchIds,
        },
      }
    : scope.courseIds && scope.courseIds.length === 1
      ? {
          entityType: "COURSE" as const,
          entityId: {
            in: scope.courseIds,
          },
        }
      : undefined;

  const [auditLogs, userActivityLogs] = await Promise.all([
    prisma.auditLog.findMany({
      where: auditWhere,
      orderBy: {
        createdAt: "desc",
      },
      take: 6,
      select: {
        id: true,
        message: true,
        level: true,
        createdAt: true,
        actorUser: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    }),
    auditWhere
      ? Promise.resolve([])
      : prisma.userActivityLog.findMany({
          orderBy: {
            createdAt: "desc",
          },
          take: 4,
          select: {
            id: true,
            activityType: true,
            createdAt: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        }),
  ]);

  return [
    ...auditLogs.map((log) => ({
      id: `audit:${log.id}`,
      title: log.message,
      detail: log.actorUser?.name
        ? `${log.actorUser.name}${log.actorUser.email ? ` · ${log.actorUser.email}` : ""}`
        : "System audit trail",
      occurredAt: log.createdAt.toISOString(),
      tone: formatToneFromLogLevel(log.level),
    })),
    ...userActivityLogs.map((activity) => ({
      id: `activity:${activity.id}`,
      title: `${activity.user?.name ?? "User"} ${formatActivityTypeLabel(activity.activityType)}`,
      detail: activity.user?.email ?? "Platform activity log",
      occurredAt: activity.createdAt.toISOString(),
      tone: (activity.activityType.includes("FAILED") || activity.activityType.includes("FORCED") ? "danger" : "info") as DashboardRecentActivityItem["tone"],
    })),
  ]
    .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
    .slice(0, 8);
}

function buildPendingActions(options: {
  pendingCourseApprovals: number;
  overdueAssignments: number;
  draftCourses: number;
  missingCurriculaCount: number;
}): DashboardPendingActionItem[] {
  return [
    {
      id: "course-approvals",
      title: "Course approvals",
      detail: options.pendingCourseApprovals > 0
        ? `${options.pendingCourseApprovals} course${options.pendingCourseApprovals === 1 ? " is" : "s are"} currently waiting for approval.`
        : "No courses are waiting in the approval queue.",
      count: options.pendingCourseApprovals,
      tone: options.pendingCourseApprovals > 0 ? "warning" : "info",
      href: "/courses",
    },
    {
      id: "overdue-quiz-schedules",
      title: "Overdue quiz schedules",
      detail: options.overdueAssignments > 0
        ? `${options.overdueAssignments} scheduled quiz${options.overdueAssignments === 1 ? " has" : "zes have"} crossed its planned start time.`
        : "No scheduled quizzes are overdue in the current scope.",
      count: options.overdueAssignments,
      tone: options.overdueAssignments > 0 ? "danger" : "info",
      href: "/schedule",
    },
    {
      id: "draft-courses",
      title: "Draft courses",
      detail: options.draftCourses > 0
        ? `${options.draftCourses} draft course${options.draftCourses === 1 ? " still needs" : "s still need"} review and publishing work.`
        : "No draft courses are pending in the selected scope.",
      count: options.draftCourses,
      tone: options.draftCourses > 0 ? "info" : "default",
      href: "/courses",
    },
    {
      id: "curriculum-coverage",
      title: "Published courses missing curriculum",
      detail: options.missingCurriculaCount > 0
        ? `${options.missingCurriculaCount} published course${options.missingCurriculaCount === 1 ? " is" : "s are"} still missing a published curriculum.`
        : "Every published course in scope already has a published curriculum.",
      count: options.missingCurriculaCount,
      tone: options.missingCurriculaCount > 0 ? "warning" : "default",
      href: "/curriculum-builder",
    },
  ];
}

export async function getDashboardStatsService(filtersInput: DashboardStatsFiltersInput = {}): Promise<DashboardStats> {
  const normalizedFilters = {
    programType: normalizeOptionalProgramType(filtersInput.programType),
    courseId: normalizeOptionalId(filtersInput.courseId),
    programId: normalizeOptionalId(filtersInput.programId),
    batchId: normalizeOptionalId(filtersInput.batchId),
  };
  const filteredViewActive = hasFilteredDashboardView(normalizedFilters);

  if (!isDatabaseConfigured) {
    return {
      ...DEFAULT_DASHBOARD_STATS,
      filters: {
        programType: normalizedFilters.programType,
        courseId: normalizedFilters.courseId,
        programId: normalizedFilters.programId,
        batchId: normalizedFilters.batchId,
      },
      scope: {
        ...DEFAULT_DASHBOARD_STATS.scope,
        viewMode: filteredViewActive ? "FILTERED" : "GLOBAL",
        programTypeLabel: formatProgramTypeLabel(normalizedFilters.programType),
      },
    };
  }

  try {
    const resolvedScope = await resolveDashboardScope(normalizedFilters);
    const scopedCourseIds = resolvedScope.courseIds;
    const scopedProgramIds = resolvedScope.programIds;
    const scopedBatchIds = resolvedScope.batchIds;
    const now = new Date();

    const [
      totalCourses,
      activeCourses,
      publishedCourses,
      draftCourses,
      archivedCourses,
      pendingCourseApprovals,
      activePrograms,
      liveBatches,
      publishedCurricula,
      publishedResources,
      totalQuizzes,
      publishedAssessments,
      overdueAssignments,
      missingCurriculaCount,
      enrollmentRows,
      assessmentRows,
      requiredStageItems,
      progressRows,
      trainerWorkload,
      recentActivity,
    ] = await Promise.all([
      prisma.course.count({
        where: scopedCourseIds ? { id: { in: scopedCourseIds } } : undefined,
      }),
      prisma.course.count({
        where: {
          ...(scopedCourseIds ? { id: { in: scopedCourseIds } } : {}),
          isActive: true,
          status: {
            not: "ARCHIVED",
          },
        },
      }),
      prisma.course.count({
        where: {
          ...(scopedCourseIds ? { id: { in: scopedCourseIds } } : {}),
          status: "PUBLISHED",
        },
      }),
      prisma.course.count({
        where: {
          ...(scopedCourseIds ? { id: { in: scopedCourseIds } } : {}),
          status: "DRAFT",
        },
      }),
      prisma.course.count({
        where: {
          ...(scopedCourseIds ? { id: { in: scopedCourseIds } } : {}),
          status: "ARCHIVED",
        },
      }),
      prisma.course.count({
        where: {
          ...(scopedCourseIds ? { id: { in: scopedCourseIds } } : {}),
          status: "IN_REVIEW",
        },
      }),
      prisma.program.count({
        where: {
          ...(scopedProgramIds ? { id: { in: scopedProgramIds } } : {}),
          isActive: true,
        },
      }),
      prisma.batch.count({
        where: {
          ...(scopedBatchIds ? { id: { in: scopedBatchIds } } : {}),
          status: "IN_SESSION",
        },
      }),
      prisma.curriculum.count({
        where: {
          ...(scopedCourseIds ? { courseId: { in: scopedCourseIds } } : {}),
          status: "PUBLISHED",
        },
      }),
      prisma.courseContent.count({
        where: {
          ...(scopedCourseIds ? { courseId: { in: scopedCourseIds } } : {}),
          status: "PUBLISHED",
        },
      }),
      prisma.assessmentPool.count({
        where: buildAssessmentPoolWhere(scopedCourseIds, false),
      }),
      prisma.assessmentPool.count({
        where: buildAssessmentPoolWhere(scopedCourseIds, true),
      }),
      prisma.batchScheduleEvent.count({
        where: {
          ...(scopedBatchIds ? { batchId: { in: scopedBatchIds } } : {}),
          linkedAssessmentPoolId: {
            not: null,
          },
          type: {
            in: ["QUIZ", "TEST"],
          },
          status: {
            in: ["SCHEDULED", "IN_PROGRESS"],
          },
          startsAt: {
            lt: now,
          },
        },
      }),
      prisma.course.count({
        where: {
          ...(scopedCourseIds ? { id: { in: scopedCourseIds } } : {}),
          status: "PUBLISHED",
          curricula: {
            none: {
              status: "PUBLISHED",
            },
          },
        },
      }),
      prisma.batchEnrollment.findMany({
        where: scopedBatchIds ? { batchId: { in: scopedBatchIds } } : undefined,
        select: {
          id: true,
          learnerId: true,
          batchId: true,
          status: true,
          learner: {
            select: {
              placementStatus: true,
            },
          },
          batch: {
            select: {
              program: {
                select: {
                  courseId: true,
                },
              },
            },
          },
        },
      }),
      prisma.assessment.findMany({
        where: scopedBatchIds ? { batchId: { in: scopedBatchIds } } : undefined,
        select: {
          id: true,
        },
      }),
      prisma.curriculumStageItem.findMany({
        where: {
          isRequired: true,
          stage: {
            module: {
              curriculum: {
                status: "PUBLISHED",
                ...(scopedCourseIds ? { courseId: { in: scopedCourseIds } } : {}),
              },
            },
          },
        },
        select: {
          id: true,
          stage: {
            select: {
              module: {
                select: {
                  curriculum: {
                    select: {
                      courseId: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.learnerCurriculumItemProgress.findMany({
        where: scopedBatchIds ? { batchId: { in: scopedBatchIds } } : undefined,
        select: {
          learnerId: true,
          batchId: true,
          stageItemId: true,
          status: true,
          createdAt: true,
          completedAt: true,
        },
      }),
      buildTrainerWorkload(scopedBatchIds),
      buildRecentActivity(resolvedScope),
    ]);

    const [attendanceRows, assessmentScores] = await Promise.all([
      enrollmentRows.length > 0
        ? prisma.attendanceRecord.findMany({
            where: {
              enrollmentId: {
                in: enrollmentRows.map((enrollment) => enrollment.id),
              },
            },
            select: {
              status: true,
            },
          })
        : Promise.resolve([]),
      assessmentRows.length > 0
        ? prisma.assessmentScore.findMany({
            where: {
              assessmentId: {
                in: assessmentRows.map((assessment) => assessment.id),
              },
            },
            select: {
              learnerId: true,
              score: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const totalEnrolledLearnerIds = new Set(enrollmentRows.map((enrollment) => enrollment.learnerId));
    const activeEnrollments = enrollmentRows.filter((enrollment) => enrollment.status === "ACTIVE");
    const activeLearnerIds = new Set(activeEnrollments.map((enrollment) => enrollment.learnerId));
    const assessmentClearedLearnerIds = new Set(
      assessmentScores
        .map((assessmentScore) => assessmentScore.learnerId)
        .filter((learnerId) => totalEnrolledLearnerIds.has(learnerId)),
    );
    const placementReadyLearnerIds = new Set(
      enrollmentRows
        .filter((enrollment) => enrollment.learner.placementStatus === "PLACEMENT_READY")
        .map((enrollment) => enrollment.learnerId),
    );
    const activePairByKey = new Map(activeEnrollments.map((enrollment) => {
      const key = `${enrollment.learnerId}:${enrollment.batchId}`;

      return [key, {
        learnerId: enrollment.learnerId,
        batchId: enrollment.batchId,
        courseId: enrollment.batch.program.courseId,
      }] as const;
    }));

    const requiredStageItemsByCourseId = new Map<string, Set<string>>();

    for (const stageItem of requiredStageItems) {
      const courseId = stageItem.stage.module.curriculum.courseId;
      const currentStageItems = requiredStageItemsByCourseId.get(courseId) ?? new Set<string>();
      currentStageItems.add(stageItem.id);
      requiredStageItemsByCourseId.set(courseId, currentStageItems);
    }

    const startedLearnerIds = new Set<string>();
    const inProgressLearnerIds = new Set<string>();
    const completedRequiredStageItemsByPair = new Map<string, Set<string>>();
    const firstStartedAtByLearner = new Map<string, Date>();
    const firstCompletedAtByLearner = new Map<string, Date>();

    for (const progressRow of progressRows) {
      const pairKey = `${progressRow.learnerId}:${progressRow.batchId}`;
      const pair = activePairByKey.get(pairKey);

      if (!pair) {
        continue;
      }

      startedLearnerIds.add(pair.learnerId);

      const firstStartedAt = firstStartedAtByLearner.get(pair.learnerId);
      if (!firstStartedAt || progressRow.createdAt < firstStartedAt) {
        firstStartedAtByLearner.set(pair.learnerId, progressRow.createdAt);
      }

      if (progressRow.status === "IN_PROGRESS") {
        inProgressLearnerIds.add(pair.learnerId);
      }

      if (progressRow.completedAt) {
        const firstCompletedAt = firstCompletedAtByLearner.get(pair.learnerId);
        if (!firstCompletedAt || progressRow.completedAt < firstCompletedAt) {
          firstCompletedAtByLearner.set(pair.learnerId, progressRow.completedAt);
        }
      }

      if (progressRow.status !== "COMPLETED") {
        continue;
      }

      const requiredStageItemsForCourse = requiredStageItemsByCourseId.get(pair.courseId);

      if (!requiredStageItemsForCourse?.has(progressRow.stageItemId)) {
        continue;
      }

      const completedStageItems = completedRequiredStageItemsByPair.get(pairKey) ?? new Set<string>();
      completedStageItems.add(progressRow.stageItemId);
      completedRequiredStageItemsByPair.set(pairKey, completedStageItems);
    }

    let totalRequiredAssignments = 0;
    let completedRequiredAssignments = 0;
    const completedLearnerIds = new Set<string>();

    for (const [pairKey, pair] of activePairByKey.entries()) {
      const requiredCount = requiredStageItemsByCourseId.get(pair.courseId)?.size ?? 0;
      const completedCount = completedRequiredStageItemsByPair.get(pairKey)?.size ?? 0;

      totalRequiredAssignments += requiredCount;
      completedRequiredAssignments += completedCount;

      if (requiredCount > 0 && completedCount >= requiredCount) {
        completedLearnerIds.add(pair.learnerId);
      }
    }

    const attendanceScoreByStatus: Record<string, number> = {
      PRESENT: 100,
      LATE: 60,
      EXCUSED: 80,
      ABSENT: 0,
    };

    const averageAttendance = attendanceRows.length > 0
      ? roundToOneDecimal(attendanceRows.reduce((total, row) => total + (attendanceScoreByStatus[row.status] ?? 0), 0) / attendanceRows.length)
      : 0;
    const averageAssessmentScore = assessmentScores.length > 0
      ? roundToOneDecimal(assessmentScores.reduce((total, row) => total + row.score, 0) / assessmentScores.length)
      : 0;
    const overallCompletionRate = totalRequiredAssignments > 0
      ? roundToOneDecimal((completedRequiredAssignments / totalRequiredAssignments) * 100)
      : 0;

    const months = buildLastSixMonths();
    const startedCounts = new Map(months.map((month) => [month.key, 0]));
    const completedCounts = new Map(months.map((month) => [month.key, 0]));

    for (const startedAt of firstStartedAtByLearner.values()) {
      const monthKey = buildMonthKey(startedAt);
      if (startedCounts.has(monthKey)) {
        startedCounts.set(monthKey, (startedCounts.get(monthKey) ?? 0) + 1);
      }
    }

    for (const completedAt of firstCompletedAtByLearner.values()) {
      const monthKey = buildMonthKey(completedAt);
      if (completedCounts.has(monthKey)) {
        completedCounts.set(monthKey, (completedCounts.get(monthKey) ?? 0) + 1);
      }
    }

    const notStartedLearners = Math.max(activeLearnerIds.size - startedLearnerIds.size, 0);
    const totalTrainers = scopedBatchIds
      ? trainerWorkload.length
      : await prisma.trainerProfile.count({
          where: {
            isActive: true,
          },
        });
    const pendingActions = buildPendingActions({
      pendingCourseApprovals,
      overdueAssignments,
      draftCourses,
      missingCurriculaCount,
    });

    return {
      filters: resolvedScope.filters,
      scope: resolvedScope.scope,
      activeCourses,
      activePrograms,
      liveBatches,
      publishedCurricula,
      publishedResources,
      publishedAssessments,
      totalEnrolled: totalEnrolledLearnerIds.size,
      activeLearners: activeLearnerIds.size,
      assessmentCleared: assessmentClearedLearnerIds.size,
      placementReady: placementReadyLearnerIds.size,
      learnersStarted: startedLearnerIds.size,
      learnersInProgress: inProgressLearnerIds.size,
      learnersCompletedRequired: completedLearnerIds.size,
      overallCompletionRate,
      averageAttendance,
      averageAssessmentScore,
      totalCourses,
      publishedCourses,
      draftCourses,
      archivedCourses,
      totalQuizzes,
      totalTrainers,
      pendingCourseApprovals,
      overdueAssignments,
      courseStatusBreakdown: [
        { status: CourseStatus.PUBLISHED, value: publishedCourses },
        { status: CourseStatus.IN_REVIEW, value: pendingCourseApprovals },
        { status: CourseStatus.DRAFT, value: draftCourses },
        { status: CourseStatus.ARCHIVED, value: archivedCourses },
      ].map((item) => ({
        status: item.status,
        label: getCourseStatusLabel(item.status),
        value: item.value,
        accent: getCourseStatusAccent(item.status),
      })),
      learnerProgress: [
        {
          key: "not_started",
          label: "Not Started",
          value: notStartedLearners,
          helper: "Active learners with no required curriculum activity yet.",
          accent: "bg-slate-400",
        },
        {
          key: "in_progress",
          label: "In Progress",
          value: inProgressLearnerIds.size,
          helper: "Learners currently moving through required items.",
          accent: "bg-blue-600",
        },
        {
          key: "completed",
          label: "Completed",
          value: completedLearnerIds.size,
          helper: "Learners who completed every required published item.",
          accent: "bg-emerald-500",
        },
      ],
      trainerWorkload,
      recentActivity,
      pendingActions,
      readinessFunnel: [
        { label: "Total Enrolled", value: totalEnrolledLearnerIds.size, accent: "bg-slate-900" },
        { label: "Active Learning", value: activeLearnerIds.size, accent: "bg-blue-700" },
        { label: "Assessment Cleared", value: assessmentClearedLearnerIds.size, accent: "bg-blue-500" },
        { label: "Placement Ready", value: placementReadyLearnerIds.size, accent: "bg-[var(--accent-orange)]" },
      ],
      operationsSnapshot: [
        {
          id: "approval-health",
          title: "Approvals Queue",
          message: pendingCourseApprovals > 0
            ? `${pendingCourseApprovals} course${pendingCourseApprovals === 1 ? " is" : "s are"} waiting for approval.`
            : "No course approvals are waiting in the queue.",
          tone: pendingCourseApprovals > 0 ? "danger" : "info",
        },
        {
          id: "schedule-health",
          title: "Quiz Scheduling",
          message: overdueAssignments > 0
            ? `${overdueAssignments} quiz schedule${overdueAssignments === 1 ? " has" : "s have"} crossed its planned start time.`
            : "No scheduled quizzes are overdue in the current scope.",
          tone: overdueAssignments > 0 ? "danger" : "info",
        },
        {
          id: "lms-coverage",
          title: "LMS Coverage",
          message: publishedCourses > 0
            ? `${publishedCourses} published course${publishedCourses === 1 ? "" : "s"}, ${publishedCurricula} curricula, and ${publishedAssessments} quiz pool${publishedAssessments === 1 ? "" : "s"} are ready for delivery.`
            : "No published courses are currently available in scope.",
          tone: publishedCourses > 0 ? "info" : "danger",
        },
      ],
      trends: months.map((month) => ({
        label: month.label,
        startedLearners: startedCounts.get(month.key) ?? 0,
        completedLearners: completedCounts.get(month.key) ?? 0,
      })),
    };
  } catch (error) {
    console.warn("Dashboard query fallback activated", error);
    return {
      ...DEFAULT_DASHBOARD_STATS,
      filters: {
        programType: normalizedFilters.programType,
        courseId: normalizedFilters.courseId,
        programId: normalizedFilters.programId,
        batchId: normalizedFilters.batchId,
      },
      scope: {
        ...DEFAULT_DASHBOARD_STATS.scope,
        viewMode: filteredViewActive ? "FILTERED" : "GLOBAL",
        programTypeLabel: formatProgramTypeLabel(normalizedFilters.programType),
      },
    };
  }
}
