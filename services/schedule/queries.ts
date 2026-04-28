import { EnrollmentStatus } from "@prisma/client";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { ListScheduleEventsQueryInput } from "@/lib/validation-schemas/schedule";
import { batchScheduleEventDelegate, mapScheduleEvent, parseDate } from "@/services/schedule/internal-helpers";
import {
  BatchScheduleEventWhereInput,
  EventRecord,
  ScheduleContextOption,
  ScheduleEventListItem,
  ScheduleEventListResponse,
  ScheduleEventType,
} from "@/services/schedule/types";

const SCHEDULE_EVENT_TYPES: ScheduleEventType[] = ["CLASS", "TEST"];

function buildEmptyScheduleResponse(input: ListScheduleEventsQueryInput): ScheduleEventListResponse {
  return {
    items: [],
    totalCount: 0,
    page: input.page,
    pageSize: input.pageSize,
    pageCount: 0,
  };
}

async function resolveScheduleBatchIds(input: ListScheduleEventsQueryInput) {
  if (input.contextType === "batch") {
    return input.batchId ? [input.batchId] : null;
  }

  if (input.contextType === "learner") {
    if (!input.learnerId) {
      return [];
    }

    const enrollments = await prisma.batchEnrollment.findMany({
      where: {
        learnerId: input.learnerId,
      },
      select: {
        batchId: true,
      },
      distinct: ["batchId"],
    });

    return enrollments.map((enrollment) => enrollment.batchId);
  }

  if (!input.trainerId) {
    return [];
  }

  const batches = await prisma.batch.findMany({
    where: {
      OR: [
        { trainerId: input.trainerId },
        { trainers: { some: { id: input.trainerId } } },
      ],
    },
    select: {
      id: true,
    },
    distinct: ["id"],
  });

  return batches.map((batch) => batch.id);
}

export async function listScheduleEventsService(input: ListScheduleEventsQueryInput): Promise<ScheduleEventListResponse> {
  if (!isDatabaseConfigured) {
    return buildEmptyScheduleResponse(input);
  }

  const batchIds = await resolveScheduleBatchIds(input);

  if (Array.isArray(batchIds) && batchIds.length === 0) {
    return buildEmptyScheduleResponse(input);
  }

  const where: BatchScheduleEventWhereInput = {
    ...(Array.isArray(batchIds)
      ? { batchId: { in: batchIds } }
      : input.batchId
        ? { batchId: input.batchId }
        : {}),
    ...(input.type ? { type: input.type } : { type: { in: SCHEDULE_EVENT_TYPES } }),
    ...(input.status ? { status: input.status } : {}),
    ...(input.search
      ? {
          OR: [
            { title: { contains: input.search, mode: "insensitive" } },
            { description: { contains: input.search, mode: "insensitive" } },
            { location: { contains: input.search, mode: "insensitive" } },
            { batch: { name: { contains: input.search, mode: "insensitive" } } },
            { batch: { code: { contains: input.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  if (input.from || input.to) {
    where.startsAt = {
      ...(input.from ? { gte: parseDate(input.from, "range start") } : {}),
      ...(input.to ? { lte: parseDate(input.to, "range end") } : {}),
    };
  }

  const skip = (input.page - 1) * input.pageSize;
  const scheduleEvents = batchScheduleEventDelegate(prisma);

  const [totalCount, items] = await Promise.all([
    scheduleEvents.count({ where }),
    scheduleEvents.findMany({
      where,
      include: {
        batch: {
          select: {
            code: true,
            name: true,
          },
        },
        linkedAssessmentPool: {
          select: {
            code: true,
            title: true,
          },
        },
        trainerAssignments: {
          where: { removedAt: null },
          select: {
            role: true,
            trainerProfile: { select: { user: { select: { name: true } } } },
          },
        },
      },
      orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
      skip,
      take: input.pageSize,
    }),
  ]);
  const mappedItems = items as Array<EventRecord & {
    batch: { code: string; name: string };
    linkedAssessmentPool: { code: string; title: string } | null;
    trainerAssignments: { role: string; trainerProfile: { user: { name: string } } }[];
  }>;

  return {
    items: mappedItems.map((item) => mapScheduleEvent(item)),
    totalCount,
    page: input.page,
    pageSize: input.pageSize,
    pageCount: Math.ceil(totalCount / input.pageSize),
  };
}

export async function listScheduleLearnerOptionsService(): Promise<ScheduleContextOption[]> {
  if (!isDatabaseConfigured) {
    return [];
  }

  const learners = await prisma.learner.findMany({
    where: {
      isActive: true,
      enrollments: {
        some: {
          status: EnrollmentStatus.ACTIVE,
        },
      },
    },
    select: {
      id: true,
      learnerCode: true,
      fullName: true,
      email: true,
      enrollments: {
        where: {
          status: EnrollmentStatus.ACTIVE,
        },
        select: {
          batch: {
            select: {
              code: true,
            },
          },
        },
      },
    },
    orderBy: {
      fullName: "asc",
    },
    take: 500,
  });

  return learners.map((learner) => {
    const batchCodes = Array.from(new Set(learner.enrollments.map((enrollment) => enrollment.batch.code))).filter(Boolean);
    return {
      id: learner.id,
      label: `${learner.fullName} (${learner.learnerCode})`,
      meta: batchCodes.length > 0 ? `${batchCodes.join(", ")} • ${learner.email}` : learner.email,
    };
  });
}

export async function listScheduleTrainerOptionsService(): Promise<ScheduleContextOption[]> {
  if (!isDatabaseConfigured) {
    return [];
  }

  const trainers = await prisma.trainerProfile.findMany({
    where: {
      isActive: true,
      OR: [
        { leadBatches: { some: {} } },
        { batches: { some: {} } },
        { sessionAssignments: { some: { removedAt: null } } },
      ],
    },
    select: {
      id: true,
      employeeCode: true,
      specialization: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      user: {
        name: "asc",
      },
    },
  });

  return trainers.map((trainer) => ({
    id: trainer.id,
    label: `${trainer.user.name} (${trainer.employeeCode})`,
    meta: trainer.specialization ?? trainer.user.email,
  }));
}

export async function getScheduleEventByIdService(eventId: string): Promise<ScheduleEventListItem | null> {
  if (!isDatabaseConfigured) {
    return null;
  }

  const event = (await batchScheduleEventDelegate(prisma).findUnique({
    where: { id: eventId },
    include: {
      batch: {
        select: {
          code: true,
          name: true,
        },
      },
      linkedAssessmentPool: {
        select: {
          code: true,
          title: true,
        },
      },
    },
  })) as (EventRecord & {
    batch: { code: string; name: string };
    linkedAssessmentPool: { code: string; title: string } | null;
  }) | null;

  return event ? mapScheduleEvent(event) : null;
}
