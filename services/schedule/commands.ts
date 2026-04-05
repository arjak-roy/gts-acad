import { AuditActionType, AuditEntityType, EvaluationStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma-client";
import { CancelScheduleEventInput, CreateScheduleEventInput, UpdateScheduleEventInput } from "@/lib/validation-schemas/schedule";
import { createAuditLogEntry } from "@/services/logs-actions-service";
import {
  batchScheduleEventDelegate,
  buildOccurrenceDates,
  createAssessmentForEvent,
  ensureScheduleWritesAvailable,
  parseDate,
  resolveUpdateScopeFilter,
  shouldLinkAssessment,
  syncAssessmentForEvent,
  toNullableText,
} from "@/services/schedule/internal-helpers";
import { EventRecord } from "@/services/schedule/types";

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
