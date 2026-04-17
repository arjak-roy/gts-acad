import "server-only";

import { AttendanceSessionSource, Prisma } from "@prisma/client";

import { AttendanceSessionSelectionInput } from "@/lib/validation-schemas/attendance";

type AttendanceSessionClient = Pick<Prisma.TransactionClient, "attendanceSession" | "batchScheduleEvent">;

type AttendanceBatchReference = {
  id: string;
  code: string;
};

type AttendanceSessionTarget = {
  sourceType: AttendanceSessionSource;
  sessionKey: string;
  sessionDate: Date;
  title: string | null;
  linkedScheduleEventId: string | null;
};

export function normalizeAttendanceDate(value: Date) {
  return new Date(`${value.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

export function formatAttendanceDateKey(value: Date) {
  return normalizeAttendanceDate(value).toISOString().slice(0, 10);
}

function buildManualAttendanceSessionKey(value: Date) {
  return `manual:${formatAttendanceDateKey(value)}`;
}

function buildScheduleAttendanceSessionKey(scheduleEventId: string) {
  return `schedule:${scheduleEventId}`;
}

function buildManualAttendanceSessionTitle(batchCode: string, value: Date) {
  return `Manual attendance • ${batchCode} • ${formatAttendanceDateKey(value)}`;
}

export async function resolveAttendanceSessionTarget(
  client: AttendanceSessionClient,
  batch: AttendanceBatchReference,
  selection: AttendanceSessionSelectionInput & { sessionLabel?: string | undefined },
): Promise<AttendanceSessionTarget> {
  if (selection.sessionSourceType === "SCHEDULE_EVENT") {
    if (!selection.scheduleEventId) {
      throw new Error("A schedule event is required for schedule-linked attendance.");
    }

    const scheduleEvent = await client.batchScheduleEvent.findUnique({
      where: { id: selection.scheduleEventId },
      select: {
        id: true,
        batchId: true,
        title: true,
        startsAt: true,
      },
    });

    if (!scheduleEvent || scheduleEvent.batchId !== batch.id) {
      throw new Error("Schedule event not found for the selected batch.");
    }

    return {
      sourceType: AttendanceSessionSource.SCHEDULE_EVENT,
      sessionKey: buildScheduleAttendanceSessionKey(scheduleEvent.id),
      sessionDate: normalizeAttendanceDate(scheduleEvent.startsAt),
      title: scheduleEvent.title,
      linkedScheduleEventId: scheduleEvent.id,
    };
  }

  const sessionDate = normalizeAttendanceDate(selection.sessionDate);

  return {
    sourceType: AttendanceSessionSource.MANUAL,
    sessionKey: buildManualAttendanceSessionKey(sessionDate),
    sessionDate,
    title: selection.sessionLabel?.trim() || buildManualAttendanceSessionTitle(batch.code, sessionDate),
    linkedScheduleEventId: null,
  };
}

export async function upsertAttendanceSessionForSelection(
  client: AttendanceSessionClient,
  batch: AttendanceBatchReference,
  selection: AttendanceSessionSelectionInput & { markedByUserId?: string | undefined; sessionLabel?: string | undefined },
) {
  const target = await resolveAttendanceSessionTarget(client, batch, selection);

  return client.attendanceSession.upsert({
    where: {
      batchId_sessionKey: {
        batchId: batch.id,
        sessionKey: target.sessionKey,
      },
    },
    update: {
      sourceType: target.sourceType,
      sessionDate: target.sessionDate,
      title: target.title,
      linkedScheduleEventId: target.linkedScheduleEventId,
      createdById: selection.markedByUserId ?? undefined,
    },
    create: {
      batchId: batch.id,
      sourceType: target.sourceType,
      sessionKey: target.sessionKey,
      sessionDate: target.sessionDate,
      title: target.title,
      linkedScheduleEventId: target.linkedScheduleEventId,
      createdById: selection.markedByUserId,
    },
  });
}