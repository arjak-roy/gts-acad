import { randomUUID } from "node:crypto";

import { AssessmentMode, AssessmentType, BatchMode, EvaluationStatus, Prisma } from "@prisma/client";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { CreateScheduleEventInput } from "@/lib/validation-schemas/schedule";
import { BatchScheduleEventWhereInput, EventRecord, ScheduleEventListItem, ScheduleEventType } from "@/services/schedule/types";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MAX_GENERATED_OCCURRENCES = 180;

type BatchScheduleEventDelegate = {
  count: (args: unknown) => Promise<number>;
  findMany: (args: unknown) => Promise<unknown[]>;
  findUnique: (args: unknown) => Promise<unknown>;
  create: (args: unknown) => Promise<unknown>;
  update: (args: unknown) => Promise<unknown>;
  updateMany: (args: unknown) => Promise<unknown>;
};

type UpdateScope = "SINGLE" | "THIS_AND_FUTURE" | "SERIES";

export function ensureScheduleWritesAvailable() {
  if (!isDatabaseConfigured) {
    throw new Error("Schedule operations require database configuration.");
  }
}

export function batchScheduleEventDelegate(client: Prisma.TransactionClient | typeof prisma): BatchScheduleEventDelegate {
  return (client as unknown as { batchScheduleEvent: BatchScheduleEventDelegate }).batchScheduleEvent;
}

export function toNullableText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function parseDate(rawValue: string, label: string) {
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

export function shouldLinkAssessment(type: ScheduleEventType) {
  return type === "TEST";
}

function resolveAssessmentType(type: ScheduleEventType) {
  void type;
  return AssessmentType.MODULE;
}

function resolveAssessmentMode(classMode: BatchMode | null) {
  if (classMode === "ONLINE") {
    return AssessmentMode.ONLINE;
  }

  return AssessmentMode.PAPER_BASED;
}

export function mapScheduleEvent(item: EventRecord & {
  batch: { code: string; name: string };
  linkedAssessmentPool?: { code: string; title: string } | null;
}): ScheduleEventListItem {
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
    liveProvider: item.liveProvider,
    liveRoomId: item.liveRoomId,
    liveRoomCode: item.liveRoomCode,
    liveStartedAt: item.liveStartedAt?.toISOString() ?? null,
    liveEndedAt: item.liveEndedAt?.toISOString() ?? null,
    linkedAssessmentId: item.linkedAssessmentId,
    linkedAssessmentPoolId: item.linkedAssessmentPoolId,
    linkedAssessmentPoolCode: item.linkedAssessmentPool?.code ?? null,
    linkedAssessmentPoolTitle: item.linkedAssessmentPool?.title ?? null,
    sessionType: item.sessionType,
    seriesId: item.seriesId,
    occurrenceIndex: item.occurrenceIndex,
    isRecurring: Boolean(item.seriesId),
  };
}

export function buildOccurrenceDates(input: CreateScheduleEventInput) {
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

export async function createAssessmentForEvent(
  tx: Prisma.TransactionClient,
  options: {
    title: string;
    type: ScheduleEventType;
    classMode: BatchMode | null;
    status: EvaluationStatus;
    batchId: string;
    programId: string;
    scheduledAt: Date;
  },
) {
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

export async function syncAssessmentForEvent(
  tx: Prisma.TransactionClient,
  event: Pick<EventRecord, "linkedAssessmentId">,
  next: {
    title: string;
    type: ScheduleEventType;
    classMode: BatchMode | null;
    status: EvaluationStatus;
    startsAt: Date;
    batchId: string;
    programId: string;
  },
) {
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

export function resolveUpdateScopeFilter(
  event: Pick<EventRecord, "id" | "seriesId" | "startsAt">,
  scope: UpdateScope,
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
