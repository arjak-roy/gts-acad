import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { ListScheduleEventsQueryInput } from "@/lib/validation-schemas/schedule";
import { batchScheduleEventDelegate, mapScheduleEvent, parseDate } from "@/services/schedule/internal-helpers";
import { BatchScheduleEventWhereInput, EventRecord, ScheduleEventListItem, ScheduleEventListResponse } from "@/services/schedule/types";

export async function listScheduleEventsService(input: ListScheduleEventsQueryInput): Promise<ScheduleEventListResponse> {
  if (!isDatabaseConfigured) {
    return {
      items: [],
      totalCount: 0,
      page: input.page,
      pageSize: input.pageSize,
      pageCount: 0,
    };
  }

  const where: BatchScheduleEventWhereInput = {
    ...(input.batchId ? { batchId: input.batchId } : {}),
    ...(input.type ? { type: input.type } : {}),
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
      },
      orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
      skip,
      take: input.pageSize,
    }),
  ]);
  const mappedItems = items as Array<EventRecord & {
    batch: { code: string; name: string };
    linkedAssessmentPool: { code: string; title: string } | null;
  }>;

  return {
    items: mappedItems.map((item) => mapScheduleEvent(item)),
    totalCount,
    page: input.page,
    pageSize: input.pageSize,
    pageCount: Math.ceil(totalCount / input.pageSize),
  };
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
