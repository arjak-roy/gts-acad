import "server-only";

import { randomUUID } from "node:crypto";
import { AssessmentMode, AssessmentType, AuditActionType, AuditEntityType, BatchMode, EvaluationStatus, Prisma } from "@prisma/client";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import {
  CancelScheduleEventInput,
  CreateScheduleEventInput,
  ListScheduleEventsQueryInput,
  UpdateScheduleEventInput,
} from "@/lib/validation-schemas/schedule";
import { createAuditLogEntry } from "@/services/logs-actions-service";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MAX_GENERATED_OCCURRENCES = 180;

type ScheduleEventType = "CLASS" | "TEST" | "QUIZ" | "CONTEST";
type BatchScheduleEventWhereInput = Record<string, unknown>;
type BatchScheduleEventDelegate = {
  count: (args: unknown) => Promise<number>;
  findMany: (args: unknown) => Promise<unknown[]>;
  findUnique: (args: unknown) => Promise<unknown>;
  create: (args: unknown) => Promise<unknown>;
  update: (args: unknown) => Promise<unknown>;
  updateMany: (args: unknown) => Promise<unknown>;
};

function batchScheduleEventDelegate(client: Prisma.TransactionClient | typeof prisma): BatchScheduleEventDelegate {
  return (client as unknown as { batchScheduleEvent: BatchScheduleEventDelegate }).batchScheduleEvent;
}

type EventRecord = {
  id: string;
  batchId: string;
  linkedAssessmentId: string | null;
  seriesId: string | null;
  occurrenceIndex: number;
  title: string;
  description: string | null;
  type: ScheduleEventType;
  classMode: BatchMode | null;
  status: EvaluationStatus;
  startsAt: Date;
  endsAt: Date | null;
  location: string | null;
  meetingUrl: string | null;
  recurrenceRule: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
};

export type ScheduleEventListItem = {
  id: string;
  batchId: string;
  batchCode: string;
  batchName: string;
  title: string;
  description: string | null;
  type: ScheduleEventType;
  classMode: BatchMode | null;
  status: EvaluationStatus;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  meetingUrl: string | null;
  linkedAssessmentId: string | null;
  seriesId: string | null;
  occurrenceIndex: number;
  isRecurring: boolean;
};

export type ScheduleEventListResponse = {
  items: ScheduleEventListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

function ensureScheduleWritesAvailable() {
  if (!isDatabaseConfigured) {
    throw new Error("Schedule operations require database configuration.");
  }
}

function toNullableText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function parseDate(rawValue: string, label: string) {
  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${label}.`);
  }

  return parsed;
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonths(value: Date, months: number) {
  const next = new Date(value);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function combineDateWithTime(dayDate: Date, timeTemplate: Date) {
  const combined = new Date(dayDate);
  combined.setUTCHours(
    timeTemplate.getUTCHours(),
    timeTemplate.getUTCMinutes(),
    timeTemplate.getUTCSeconds(),
    timeTemplate.getUTCMilliseconds(),
  );
  return combined;
}

function normalizeWeekdays(values: number[]) {
  const normalized = Array.from(new Set(values.filter((value) => Number.isFinite(value) && value >= 0 && value <= 6))).sort((a, b) => a - b);
  return normalized;
}

function shouldLinkAssessment(type: ScheduleEventType) {
  return type === "TEST" || type === "QUIZ";
}

function resolveAssessmentType(type: ScheduleEventType) {
  if (type === "QUIZ") {
    return AssessmentType.DIAGNOSTIC;
  }

  return AssessmentType.MODULE;
}

function resolveAssessmentMode(classMode: BatchMode | null) {
  if (classMode === "ONLINE") {
    return AssessmentMode.ONLINE;
  }

  return AssessmentMode.PAPER_BASED;
}

function mapScheduleEvent(item: EventRecord & { batch: { code: string; name: string } }): ScheduleEventListItem {
  return {
    id: item.id,
    batchId: item.batchId,
    batchCode: item.batch.code,
    batchName: item.batch.name,
    title: item.title,
    description: item.description,
    type: item.type,
    classMode: item.classMode,
    status: item.status,
    startsAt: item.startsAt.toISOString(),
    endsAt: item.endsAt?.toISOString() ?? null,
    location: item.location,
    meetingUrl: item.meetingUrl,
    linkedAssessmentId: item.linkedAssessmentId,
    seriesId: item.seriesId,
    occurrenceIndex: item.occurrenceIndex,
    isRecurring: Boolean(item.seriesId),
  };
}

function buildOccurrenceDates(input: CreateScheduleEventInput) {
  const startsAt = parseDate(input.startsAt, "start time");
  const endsAt = input.endsAt ? parseDate(input.endsAt, "end time") : null;

  if (endsAt && endsAt.getTime() <= startsAt.getTime()) {
    throw new Error("End time must be after start time.");
  }

  const durationMs = endsAt ? endsAt.getTime() - startsAt.getTime() : null;
  const recurrence = input.recurrence;

  if (!recurrence) {
    return [{ startsAt, endsAt, occurrenceIndex: 0, recurrenceRule: {} as Prisma.InputJsonValue, seriesId: null as string | null }];
  }

  const interval = recurrence.interval ?? 1;
  const until = recurrence.until ? parseDate(recurrence.until, "recurrence end") : null;
  const maxCount = Math.min(recurrence.count ?? MAX_GENERATED_OCCURRENCES, MAX_GENERATED_OCCURRENCES);
  const seriesId = randomUUID();

  const occurrences: Array<{
    startsAt: Date;
    endsAt: Date | null;
    occurrenceIndex: number;
    recurrenceRule: Prisma.InputJsonValue;
    seriesId: string;
  }> = [];

  if (recurrence.frequency === "DAILY") {
    let cursor = new Date(startsAt);

    while (occurrences.length < maxCount) {
      if (until && cursor.getTime() > until.getTime()) {
        break;
      }

      occurrences.push({
        startsAt: new Date(cursor),
        endsAt: durationMs ? new Date(cursor.getTime() + durationMs) : null,
        occurrenceIndex: occurrences.length,
        seriesId,
        recurrenceRule: {
          frequency: recurrence.frequency,
          interval,
          count: recurrence.count ?? null,
          until: recurrence.until ?? null,
          byWeekdays: [],
        },
      });

      cursor = addDays(cursor, interval);
    }
  } else if (recurrence.frequency === "MONTHLY") {
    let cursor = new Date(startsAt);

    while (occurrences.length < maxCount) {
      if (until && cursor.getTime() > until.getTime()) {
        break;
      }

      occurrences.push({
        startsAt: new Date(cursor),
        endsAt: durationMs ? new Date(cursor.getTime() + durationMs) : null,
        occurrenceIndex: occurrences.length,
        seriesId,
        recurrenceRule: {
          frequency: recurrence.frequency,
          interval,
          count: recurrence.count ?? null,
          until: recurrence.until ?? null,
          byWeekdays: [],
        },
      });

      cursor = addMonths(cursor, interval);
    }
  } else {
    const weekdays = normalizeWeekdays(recurrence.byWeekdays ?? []);
    const effectiveWeekdays = weekdays.length > 0 ? weekdays : [startsAt.getUTCDay()];

    const startDateOnly = new Date(Date.UTC(startsAt.getUTCFullYear(), startsAt.getUTCMonth(), startsAt.getUTCDate()));
    let cursor = new Date(startDateOnly);

    while (occurrences.length < maxCount) {
      const daysFromStart = Math.floor((cursor.getTime() - startDateOnly.getTime()) / DAY_IN_MS);
      const weekOffset = Math.floor(daysFromStart / 7);
      const inIntervalWeek = weekOffset % interval === 0;
      const weekdayMatch = effectiveWeekdays.includes(cursor.getUTCDay());

      if (inIntervalWeek && weekdayMatch) {
        const nextStart = combineDateWithTime(cursor, startsAt);

        if (nextStart.getTime() >= startsAt.getTime() && (!until || nextStart.getTime() <= until.getTime())) {
          occurrences.push({
            startsAt: nextStart,
            endsAt: durationMs ? new Date(nextStart.getTime() + durationMs) : null,
            occurrenceIndex: occurrences.length,
            seriesId,
            recurrenceRule: {
              frequency: recurrence.frequency,
              interval,
              count: recurrence.count ?? null,
              until: recurrence.until ?? null,
              byWeekdays: effectiveWeekdays,
            },
          });
        }
      }

      if (until && cursor.getTime() > until.getTime()) {
        break;
      }

      cursor = addDays(cursor, 1);
    }
  }

  if (occurrences.length === 0) {
    throw new Error("Recurrence rule did not produce any schedule events.");
  }

  return occurrences;
}

async function createAssessmentForEvent(tx: Prisma.TransactionClient, options: {
  title: string;
  type: ScheduleEventType;
  classMode: BatchMode | null;
  status: EvaluationStatus;
  batchId: string;
  programId: string;
  scheduledAt: Date;
}) {
  return tx.assessment.create({
    data: {
      title: options.title,
      type: resolveAssessmentType(options.type),
      mode: resolveAssessmentMode(options.classMode),
      status: options.status,
      batchId: options.batchId,
      programId: options.programId,
      scheduledAt: options.scheduledAt,
    },
    select: { id: true },
  });
}

async function syncAssessmentForEvent(tx: Prisma.TransactionClient, event: Pick<EventRecord, "linkedAssessmentId">, next: {
  title: string;
  type: ScheduleEventType;
  classMode: BatchMode | null;
  status: EvaluationStatus;
  startsAt: Date;
  batchId: string;
  programId: string;
}) {
  const shouldLink = shouldLinkAssessment(next.type);

  if (!shouldLink && event.linkedAssessmentId) {
    await tx.assessment.update({
      where: { id: event.linkedAssessmentId },
      data: {
        status: EvaluationStatus.CANCELLED,
      },
    });

    return null;
  }

  if (!shouldLink) {
    return null;
  }

  if (event.linkedAssessmentId) {
    await tx.assessment.update({
      where: { id: event.linkedAssessmentId },
      data: {
        title: next.title,
        type: resolveAssessmentType(next.type),
        mode: resolveAssessmentMode(next.classMode),
        status: next.status,
        batchId: next.batchId,
        programId: next.programId,
        scheduledAt: next.startsAt,
      },
    });

    return event.linkedAssessmentId;
  }

  const created = await createAssessmentForEvent(tx, {
    title: next.title,
    type: next.type,
    classMode: next.classMode,
    status: next.status,
    batchId: next.batchId,
    programId: next.programId,
    scheduledAt: next.startsAt,
  });

  return created.id;
}

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
      },
      orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
      skip,
      take: input.pageSize,
    }),
  ]);
  const mappedItems = items as Array<EventRecord & { batch: { code: string; name: string } }>;

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
    },
  })) as (EventRecord & { batch: { code: string; name: string } }) | null;

  return event ? mapScheduleEvent(event) : null;
}

export async function createScheduleEventService(input: CreateScheduleEventInput, actorUserId?: string | null) {
  ensureScheduleWritesAvailable();

  const batch = await prisma.batch.findUnique({
    where: { id: input.batchId },
    select: {
      id: true,
      code: true,
      name: true,
      programId: true,
    },
  });

  if (!batch) {
    throw new Error("Batch not found.");
  }

  const classMode = input.type === "CLASS" ? input.classMode ?? null : null;
  const title = input.title.trim();
  const description = toNullableText(input.description);
  const location = toNullableText(input.location);
  const meetingUrl = toNullableText(input.meetingUrl);
  const status = input.status;
  const occurrences = buildOccurrenceDates(input);

  const createdEvents = await prisma.$transaction(async (tx) => {
    const rows: EventRecord[] = [];
    const scheduleEvents = batchScheduleEventDelegate(tx);

    for (const occurrence of occurrences) {
      const linkedAssessmentId = shouldLinkAssessment(input.type)
        ? (
            await createAssessmentForEvent(tx, {
              title,
              type: input.type,
              classMode,
              status,
              batchId: batch.id,
              programId: batch.programId,
              scheduledAt: occurrence.startsAt,
            })
          ).id
        : null;

      const event = (await scheduleEvents.create({
        data: {
          batchId: batch.id,
          linkedAssessmentId,
          seriesId: occurrence.seriesId,
          occurrenceIndex: occurrence.occurrenceIndex,
          title,
          description,
          type: input.type,
          classMode,
          status,
          startsAt: occurrence.startsAt,
          endsAt: occurrence.endsAt,
          location,
          meetingUrl,
          recurrenceRule: occurrence.recurrenceRule,
          createdById: actorUserId ?? null,
        },
      })) as EventRecord;

      rows.push(event);
    }

    return rows;
  });

  await createAuditLogEntry({
    entityType: AuditEntityType.BATCH,
    entityId: batch.id,
    action: AuditActionType.CREATED,
    actorUserId: actorUserId ?? null,
    message: `Created ${createdEvents.length} schedule event(s) for batch ${batch.code}.`,
    metadata: {
      eventType: input.type,
      recurring: Boolean(input.recurrence),
      count: createdEvents.length,
    },
  });

  return {
    batch: {
      id: batch.id,
      code: batch.code,
      name: batch.name,
    },
    createdCount: createdEvents.length,
    events: createdEvents.map((event) => ({
      id: event.id,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt?.toISOString() ?? null,
      status: event.status,
      seriesId: event.seriesId,
      occurrenceIndex: event.occurrenceIndex,
      linkedAssessmentId: event.linkedAssessmentId,
    })),
  };
}

function resolveUpdateScopeFilter(
  event: Pick<EventRecord, "id" | "seriesId" | "startsAt">,
  scope: UpdateScheduleEventInput["scope"] | CancelScheduleEventInput["scope"],
): BatchScheduleEventWhereInput {
  if (scope === "SERIES" && event.seriesId) {
    return { seriesId: event.seriesId };
  }

  if (scope === "THIS_AND_FUTURE" && event.seriesId) {
    return {
      seriesId: event.seriesId,
      startsAt: {
        gte: event.startsAt,
      },
    };
  }

  return { id: event.id };
}

export async function updateScheduleEventService(input: UpdateScheduleEventInput, actorUserId?: string | null) {
  ensureScheduleWritesAvailable();

  const target = (await batchScheduleEventDelegate(prisma).findUnique({
    where: { id: input.eventId },
    include: {
      batch: {
        select: {
          id: true,
          code: true,
          programId: true,
        },
      },
    },
  })) as (EventRecord & { batch: { id: string; code: string; programId: string } }) | null;

  if (!target) {
    throw new Error("Schedule event not found.");
  }

  if (input.scope !== "SINGLE" && (input.startsAt !== undefined || input.endsAt !== undefined)) {
    throw new Error("Start/end time changes are only supported for single-event updates right now.");
  }

  const where = resolveUpdateScopeFilter(target, input.scope);
  const eventsToUpdate = (await batchScheduleEventDelegate(prisma).findMany({
    where,
    include: {
      batch: {
        select: {
          programId: true,
        },
      },
    },
    orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
  })) as Array<EventRecord & { batch: { programId: string } }>;

  if (eventsToUpdate.length === 0) {
    throw new Error("No schedule events matched this update scope.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const rows: EventRecord[] = [];
    const scheduleEvents = batchScheduleEventDelegate(tx);

    for (const event of eventsToUpdate) {
      const nextType = input.type ?? event.type;
      const nextClassMode = nextType === "CLASS" ? (input.classMode === undefined ? event.classMode : input.classMode) : null;

      if (nextType === "CLASS" && !nextClassMode) {
        throw new Error("Class mode is required for class events.");
      }

      const nextStartsAt = input.startsAt ? parseDate(input.startsAt, "start time") : event.startsAt;
      const nextEndsAt =
        input.endsAt === undefined
          ? event.endsAt
          : input.endsAt === null
            ? null
            : parseDate(input.endsAt, "end time");

      if (nextEndsAt && nextEndsAt.getTime() <= nextStartsAt.getTime()) {
        throw new Error("End time must be after start time.");
      }

      const nextTitle = input.title?.trim() ?? event.title;
      const nextDescription = input.description === undefined ? event.description : toNullableText(input.description);
      const nextLocation = input.location === undefined ? event.location : toNullableText(input.location);
      const nextMeetingUrl = input.meetingUrl === undefined ? event.meetingUrl : toNullableText(input.meetingUrl ?? "");
      const nextStatus = input.status ?? event.status;

      const linkedAssessmentId = await syncAssessmentForEvent(tx, event, {
        title: nextTitle,
        type: nextType,
        classMode: nextClassMode,
        status: nextStatus,
        startsAt: nextStartsAt,
        batchId: event.batchId,
        programId: event.batch.programId,
      });

      const row = (await scheduleEvents.update({
        where: { id: event.id },
        data: {
          title: nextTitle,
          description: nextDescription,
          type: nextType,
          classMode: nextClassMode,
          status: nextStatus,
          startsAt: nextStartsAt,
          endsAt: nextEndsAt,
          location: nextLocation,
          meetingUrl: nextMeetingUrl,
          linkedAssessmentId,
        },
      })) as EventRecord;

      rows.push(row);
    }

    return rows;
  });

  await createAuditLogEntry({
    entityType: AuditEntityType.BATCH,
    entityId: target.batchId,
    action: AuditActionType.UPDATED,
    actorUserId: actorUserId ?? null,
    message: `Updated ${updated.length} schedule event(s) for batch ${target.batch.code}.`,
    metadata: {
      scope: input.scope,
      eventId: target.id,
      updatedCount: updated.length,
    },
  });

  return {
    updatedCount: updated.length,
    items: updated.map((item) => ({
      id: item.id,
      startsAt: item.startsAt.toISOString(),
      endsAt: item.endsAt?.toISOString() ?? null,
      status: item.status,
      type: item.type,
      classMode: item.classMode,
      linkedAssessmentId: item.linkedAssessmentId,
    })),
  };
}

export async function cancelScheduleEventService(input: CancelScheduleEventInput, actorUserId?: string | null) {
  ensureScheduleWritesAvailable();

  const target = (await batchScheduleEventDelegate(prisma).findUnique({
    where: { id: input.eventId },
    select: {
      id: true,
      batchId: true,
      batch: {
        select: {
          code: true,
        },
      },
      seriesId: true,
      startsAt: true,
    },
  })) as { id: string; batchId: string; batch: { code: string }; seriesId: string | null; startsAt: Date } | null;

  if (!target) {
    throw new Error("Schedule event not found.");
  }

  const where = resolveUpdateScopeFilter(target, input.scope);

  const affected = (await batchScheduleEventDelegate(prisma).findMany({
    where,
    select: {
      id: true,
      linkedAssessmentId: true,
    },
  })) as Array<{ id: string; linkedAssessmentId: string | null }>;

  if (affected.length === 0) {
    throw new Error("No schedule events matched this cancellation scope.");
  }

  await prisma.$transaction(async (tx) => {
    await batchScheduleEventDelegate(tx).updateMany({
      where: {
        id: {
          in: affected.map((event: { id: string }) => event.id),
        },
      },
      data: {
        status: EvaluationStatus.CANCELLED,
      },
    });

    const assessmentIds = affected
      .map((event: { linkedAssessmentId: string | null }) => event.linkedAssessmentId)
      .filter((value: string | null): value is string => Boolean(value));
    if (assessmentIds.length > 0) {
      await tx.assessment.updateMany({
        where: {
          id: {
            in: assessmentIds,
          },
        },
        data: {
          status: EvaluationStatus.CANCELLED,
        },
      });
    }
  });

  await createAuditLogEntry({
    entityType: AuditEntityType.BATCH,
    entityId: target.batchId,
    action: AuditActionType.UPDATED,
    actorUserId: actorUserId ?? null,
    message: `Cancelled ${affected.length} schedule event(s) for batch ${target.batch.code}.`,
    metadata: {
      scope: input.scope,
      eventId: target.id,
      cancelledCount: affected.length,
    },
  });

  return {
    cancelledCount: affected.length,
    ids: affected.map((event: { id: string }) => event.id),
  };
}
