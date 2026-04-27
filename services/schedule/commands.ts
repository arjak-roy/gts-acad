import { AuditActionType, AuditEntityType, EvaluationStatus, SessionHistoryAction, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma-client";
import { CancelScheduleEventInput, CreateScheduleEventInput, UpdateScheduleEventInput } from "@/lib/validation-schemas/schedule";
import {
  sendCandidateAssessmentScheduledNotifications,
  sendCandidateBatchEventNotifications,
} from "@/services/candidate-notifications";
import { createAuditLogEntry } from "@/services/logs-actions-service";
import { checkMultipleTrainerConflicts } from "@/services/schedule/conflict-detection";
import { logSessionEvent } from "@/services/schedule/session-history";
import { assignTrainersToEvent } from "@/services/schedule/trainer-assignment";
import {
  notifyTrainersOfSessionCancelled,
  notifyTrainersOfSessionRescheduled,
} from "@/services/schedule/trainer-notifications";
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

async function syncLinkedAssessmentPoolForBatch(
  tx: Prisma.TransactionClient,
  options: {
    batchId: string;
    courseId: string;
    linkedAssessmentPoolId: string | null | undefined;
    scheduledAt: Date;
    actorUserId?: string | null;
  },
) {
  const linkedAssessmentPoolId = options.linkedAssessmentPoolId?.trim() || null;

  if (!linkedAssessmentPoolId) {
    return null;
  }

  const pool = await tx.assessmentPool.findFirst({
    where: {
      id: linkedAssessmentPoolId,
      status: "PUBLISHED",
      OR: [
        { courseAssessmentLinks: { some: { courseId: options.courseId } } },
        { courseAssessmentLinks: { none: {} } },
      ],
    },
    select: { id: true },
  });

  if (!pool) {
    throw new Error("Selected course-builder assessment is not available for this batch.");
  }

  await tx.batchAssessmentMapping.upsert({
    where: {
      batchId_assessmentPoolId: {
        batchId: options.batchId,
        assessmentPoolId: linkedAssessmentPoolId,
      },
    },
    update: {
      scheduledAt: options.scheduledAt,
      ...(options.actorUserId !== undefined ? { assignedById: options.actorUserId } : {}),
    },
    create: {
      batchId: options.batchId,
      assessmentPoolId: linkedAssessmentPoolId,
      scheduledAt: options.scheduledAt,
      assignedById: options.actorUserId ?? null,
    },
  });

  return pool.id;
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
      program: {
        select: {
          courseId: true,
        },
      },
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
  const liveProvider = input.type === "CLASS" && classMode === "ONLINE" ? (input.liveProvider ?? "MANUAL") : "MANUAL";
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
      const linkedAssessmentPoolId = shouldLinkAssessment(input.type)
        ? await syncLinkedAssessmentPoolForBatch(tx, {
            batchId: batch.id,
            courseId: batch.program.courseId,
            linkedAssessmentPoolId: input.linkedAssessmentPoolId ?? null,
            scheduledAt: occurrence.startsAt,
            actorUserId,
          })
        : null;

      const event = (await scheduleEvents.create({
        data: {
          batchId: batch.id,
          linkedAssessmentId,
          linkedAssessmentPoolId,
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
          liveProvider,
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
    status: "SCHEDULE",
    actorUserId: actorUserId ?? null,
    message: `Schedule created for batch ${batch.code}: ${title} (${createdEvents.length} event${createdEvents.length === 1 ? "" : "s"}).`,
    metadata: {
      batchCode: batch.code,
      batchName: batch.name,
      title,
      eventType: input.type,
      status,
      recurring: Boolean(input.recurrence),
      count: createdEvents.length,
      eventIds: createdEvents.map((event) => event.id),
    },
  });

  try {
    const notificationEvents = createdEvents.map((event) => ({
      id: event.id,
      title: event.title,
      type: event.type,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      location: event.location,
      meetingUrl: event.meetingUrl,
      liveProvider: event.liveProvider,
      linkedAssessmentPoolId: event.linkedAssessmentPoolId,
    }));

    const notificationSummary = shouldLinkAssessment(input.type)
      ? await sendCandidateAssessmentScheduledNotifications({
          batchId: batch.id,
          actorUserId: actorUserId ?? null,
          events: notificationEvents,
        })
      : await sendCandidateBatchEventNotifications({
          batchId: batch.id,
          actorUserId: actorUserId ?? null,
          events: notificationEvents,
        });

    if (notificationSummary.failedCount > 0) {
      console.warn("Candidate schedule notifications partially failed.", notificationSummary);
    }
  } catch (error) {
    console.warn("Candidate schedule notification dispatch failed.", error);
  }

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
      linkedAssessmentPoolId: event.linkedAssessmentPoolId,
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
          program: {
            select: {
              courseId: true,
            },
          },
        },
      },
    },
  })) as (EventRecord & { batch: { id: string; code: string; programId: string; program: { courseId: string } } }) | null;

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
          program: {
            select: {
              courseId: true,
            },
          },
        },
      },
    },
    orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
  })) as Array<EventRecord & { batch: { programId: string; program: { courseId: string } } }>;

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
      const nextLiveProvider = input.liveProvider ?? event.liveProvider;
      const nextStatus = input.status ?? event.status;
      const nextLinkedAssessmentPoolId = shouldLinkAssessment(nextType)
        ? await syncLinkedAssessmentPoolForBatch(tx, {
            batchId: event.batchId,
            courseId: event.batch.program.courseId,
            linkedAssessmentPoolId: input.linkedAssessmentPoolId === undefined ? event.linkedAssessmentPoolId : input.linkedAssessmentPoolId,
            scheduledAt: nextStartsAt,
            actorUserId,
          })
        : null;

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
          liveProvider: nextLiveProvider,
          linkedAssessmentId,
          linkedAssessmentPoolId: nextLinkedAssessmentPoolId,
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
    status: "SCHEDULE",
    actorUserId: actorUserId ?? null,
    message: `Schedule updated for batch ${target.batch.code}: ${updated.length} event${updated.length === 1 ? "" : "s"} changed.`,
    metadata: {
      batchCode: target.batch.code,
      scope: input.scope,
      eventId: target.id,
      updatedCount: updated.length,
      updates: {
        title: input.title?.trim(),
        type: input.type,
        classMode: input.classMode,
        status: input.status,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        location: input.location,
        meetingUrl: input.meetingUrl,
        linkedAssessmentPoolId: input.linkedAssessmentPoolId,
      },
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
      linkedAssessmentPoolId: item.linkedAssessmentPoolId,
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
    status: "SCHEDULE",
    actorUserId: actorUserId ?? null,
    message: `Schedule cancelled for batch ${target.batch.code}: ${affected.length} event${affected.length === 1 ? "" : "s"} marked cancelled.`,
    metadata: {
      batchCode: target.batch.code,
      scope: input.scope,
      eventId: target.id,
      cancelledCount: affected.length,
      cancelledEventIds: affected.map((event: { id: string }) => event.id),
    },
  });

  return {
    cancelledCount: affected.length,
    ids: affected.map((event: { id: string }) => event.id),
  };
}

// ── Extended Session Lifecycle ─────────────────────────────────

export async function rescheduleSessionService(
  eventId: string,
  newStartsAt: string,
  newEndsAt: string | null,
  reason: string,
  actorUserId: string | null,
) {
  ensureScheduleWritesAvailable();

  const event = (await batchScheduleEventDelegate(prisma).findUnique({
    where: { id: eventId },
    select: {
      id: true,
      batchId: true,
      title: true,
      startsAt: true,
      endsAt: true,
      status: true,
      batch: { select: { code: true } },
    },
  })) as {
    id: string; batchId: string; title: string; startsAt: Date; endsAt: Date | null;
    status: EvaluationStatus; batch: { code: string };
  } | null;

  if (!event) {
    throw new Error("Schedule event not found.");
  }

  if (event.status === EvaluationStatus.CANCELLED || event.status === EvaluationStatus.COMPLETED) {
    throw new Error("Cannot reschedule a cancelled or completed session.");
  }

  const parsedStartsAt = parseDate(newStartsAt, "new start time");
  const parsedEndsAt = newEndsAt ? parseDate(newEndsAt, "new end time") : null;

  if (parsedEndsAt && parsedEndsAt.getTime() <= parsedStartsAt.getTime()) {
    throw new Error("End time must be after start time.");
  }

  const oldStartsAt = event.startsAt.toISOString();
  const oldEndsAt = event.endsAt?.toISOString() ?? null;

  // Re-check conflicts for all assigned trainers with new times
  const assignments = await prisma.trainerSessionAssignment.findMany({
    where: { scheduleEventId: eventId, removedAt: null },
    select: { trainerProfileId: true, role: true },
  });

  const effectiveEndsAt = parsedEndsAt ?? new Date(parsedStartsAt.getTime() + 60 * 60 * 1000);
  let conflictWarnings: Record<string, unknown> = {};
  if (assignments.length > 0) {
    const results = await checkMultipleTrainerConflicts(
      assignments.map((a) => ({ trainerProfileId: a.trainerProfileId, role: a.role })),
      parsedStartsAt,
      effectiveEndsAt,
      eventId,
    );
    for (const [trainerId, result] of results.entries()) {
      if (result.hasConflict) {
        conflictWarnings[trainerId] = result;
      }
    }
  }

  await batchScheduleEventDelegate(prisma).update({
    where: { id: eventId },
    data: {
      startsAt: parsedStartsAt,
      endsAt: parsedEndsAt,
      status: EvaluationStatus.RESCHEDULED,
      rescheduleReason: reason.trim(),
    },
  });

  await logSessionEvent(eventId, SessionHistoryAction.RESCHEDULED, actorUserId, {
    oldStartsAt,
    oldEndsAt,
    newStartsAt: parsedStartsAt.toISOString(),
    newEndsAt: parsedEndsAt?.toISOString() ?? null,
    reason: reason.trim(),
  });

  await createAuditLogEntry({
    entityType: AuditEntityType.BATCH,
    entityId: event.batchId,
    action: AuditActionType.UPDATED,
    status: "SCHEDULE",
    actorUserId,
    message: `Session "${event.title}" rescheduled for batch ${event.batch.code}.`,
    metadata: {
      eventId,
      batchCode: event.batch.code,
      oldStartsAt,
      newStartsAt: parsedStartsAt.toISOString(),
      reason: reason.trim(),
    },
  });

  // Notify trainers and learners
  try {
    await notifyTrainersOfSessionRescheduled(eventId, reason.trim(), actorUserId);
    await sendCandidateBatchEventNotifications({
      batchId: event.batchId,
      actorUserId,
      events: [{
        id: eventId,
        title: event.title,
        type: "CLASS",
        startsAt: parsedStartsAt,
        endsAt: parsedEndsAt,
        location: null,
        meetingUrl: null,
      }],
    });
  } catch (error) {
    console.warn("Session reschedule notification dispatch failed.", error);
  }

  return {
    eventId,
    status: "RESCHEDULED",
    startsAt: parsedStartsAt.toISOString(),
    endsAt: parsedEndsAt?.toISOString() ?? null,
    reason: reason.trim(),
    conflictWarnings,
  };
}

export async function cancelSessionService(
  eventId: string,
  reason: string,
  actorUserId: string | null,
) {
  ensureScheduleWritesAvailable();

  const event = (await batchScheduleEventDelegate(prisma).findUnique({
    where: { id: eventId },
    select: {
      id: true,
      batchId: true,
      title: true,
      status: true,
      startsAt: true,
      endsAt: true,
      batch: { select: { code: true } },
    },
  })) as {
    id: string; batchId: string; title: string; status: EvaluationStatus;
    startsAt: Date; endsAt: Date | null; batch: { code: string };
  } | null;

  if (!event) {
    throw new Error("Schedule event not found.");
  }

  if (event.status === EvaluationStatus.CANCELLED) {
    throw new Error("Session is already cancelled.");
  }

  if (event.status === EvaluationStatus.COMPLETED) {
    throw new Error("Cannot cancel a completed session.");
  }

  await batchScheduleEventDelegate(prisma).update({
    where: { id: eventId },
    data: {
      status: EvaluationStatus.CANCELLED,
      cancellationReason: reason.trim(),
    },
  });

  await logSessionEvent(eventId, SessionHistoryAction.CANCELLED, actorUserId, {
    reason: reason.trim(),
    previousStatus: event.status,
  });

  await createAuditLogEntry({
    entityType: AuditEntityType.BATCH,
    entityId: event.batchId,
    action: AuditActionType.UPDATED,
    status: "SCHEDULE",
    actorUserId,
    message: `Session "${event.title}" cancelled for batch ${event.batch.code}.`,
    metadata: {
      eventId,
      batchCode: event.batch.code,
      reason: reason.trim(),
    },
  });

  // Notify trainers and learners
  try {
    await notifyTrainersOfSessionCancelled(eventId, reason.trim(), actorUserId);
    await sendCandidateBatchEventNotifications({
      batchId: event.batchId,
      actorUserId,
      events: [{
        id: eventId,
        title: event.title,
        type: "CLASS",
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        location: null,
        meetingUrl: null,
      }],
    });
  } catch (error) {
    console.warn("Session cancellation notification dispatch failed.", error);
  }

  return {
    eventId,
    status: "CANCELLED",
    reason: reason.trim(),
  };
}

export async function completeSessionService(
  eventId: string,
  completionNotes: string | null,
  attendanceCount: number | null,
  actorUserId: string | null,
) {
  ensureScheduleWritesAvailable();

  const event = (await batchScheduleEventDelegate(prisma).findUnique({
    where: { id: eventId },
    select: {
      id: true,
      batchId: true,
      title: true,
      status: true,
      batch: { select: { code: true } },
    },
  })) as {
    id: string; batchId: string; title: string; status: EvaluationStatus;
    batch: { code: string };
  } | null;

  if (!event) {
    throw new Error("Schedule event not found.");
  }

  if (event.status !== EvaluationStatus.SCHEDULED && event.status !== EvaluationStatus.RESCHEDULED) {
    throw new Error("Only scheduled or rescheduled sessions can be marked as completed.");
  }

  const completedAt = new Date();

  await batchScheduleEventDelegate(prisma).update({
    where: { id: eventId },
    data: {
      status: EvaluationStatus.COMPLETED,
      completedAt,
      completionNotes: completionNotes?.trim() ?? null,
      attendanceCount,
    },
  });

  await logSessionEvent(eventId, SessionHistoryAction.COMPLETED, actorUserId, {
    completedAt: completedAt.toISOString(),
    completionNotes: completionNotes?.trim() ?? null,
    attendanceCount,
  });

  await createAuditLogEntry({
    entityType: AuditEntityType.BATCH,
    entityId: event.batchId,
    action: AuditActionType.UPDATED,
    status: "SCHEDULE",
    actorUserId,
    message: `Session "${event.title}" marked as completed for batch ${event.batch.code}.`,
    metadata: {
      eventId,
      batchCode: event.batch.code,
      completedAt: completedAt.toISOString(),
      attendanceCount,
    },
  });

  return {
    eventId,
    status: "COMPLETED",
    completedAt: completedAt.toISOString(),
    completionNotes: completionNotes?.trim() ?? null,
    attendanceCount,
  };
}
