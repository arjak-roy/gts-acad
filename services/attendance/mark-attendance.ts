import { AttendanceStatus } from "@prisma/client";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { MarkAttendanceInput } from "@/lib/validation-schemas/attendance";
import { createAuditLogEntry } from "@/services/logs-actions-service";
import { AUDIT_ACTION_TYPE, AUDIT_ENTITY_TYPE } from "@/services/logs-actions/constants";
import { normalizeAttendanceDate, resolveAttendanceSessionTarget, upsertAttendanceSessionForSelection } from "@/services/attendance/session-utils";
import { recomputeLearnerReadiness } from "@/services/readiness-service";

function summarizeAttendanceStatuses(records: MarkAttendanceInput["records"]) {
  return records.reduce(
    (summary, record) => {
      summary[record.status] += 1;
      return summary;
    },
    {
      PRESENT: 0,
      ABSENT: 0,
      LATE: 0,
      EXCUSED: 0,
    },
  );
}

export async function markAttendanceService(input: MarkAttendanceInput, options?: { actorUserId?: string | null }) {
  const normalizedSessionDate = normalizeAttendanceDate(input.sessionDate);

  if (!isDatabaseConfigured) {
    return {
      batchCode: input.batchCode,
      recordsUpdated: input.records.length,
      attendanceSessionId: null,
      sessionDate: normalizedSessionDate.toISOString(),
      sessionSourceType: input.sessionSourceType,
      scheduleEventId: input.scheduleEventId ?? null,
      overwrittenRecordCount: 0,
    };
  }

  const batch = await prisma.batch.findUnique({
    where: { code: input.batchCode },
    include: {
      enrollments: {
        where: {
          learner: {
            learnerCode: { in: input.records.map((record) => record.learnerId) },
          },
        },
        include: {
          learner: true,
        },
      },
    },
  });

  if (!batch) {
    throw new Error("Batch not found.");
  }

  const enrollmentMap = new Map(batch.enrollments.map((enrollment) => [enrollment.learner.learnerCode, enrollment]));
  const missingLearners = input.records.filter((record) => !enrollmentMap.has(record.learnerId));
  if (missingLearners.length > 0) {
    throw new Error(`Learners missing from batch ${input.batchCode}: ${missingLearners.map((row) => row.learnerId).join(", ")}`);
  }

  const touchedEnrollmentIds = input.records
    .map((record) => enrollmentMap.get(record.learnerId)?.id)
    .filter((value): value is string => Boolean(value));

  const attendanceSession = await prisma.$transaction(async (transaction) => {
    const sessionTarget = await resolveAttendanceSessionTarget(
      transaction,
      { id: batch.id, code: batch.code },
      input,
    );
    const existingSession = await transaction.attendanceSession.findUnique({
      where: {
        batchId_sessionKey: {
          batchId: batch.id,
          sessionKey: sessionTarget.sessionKey,
        },
      },
      select: {
        id: true,
      },
    });
    const resolvedSession = await upsertAttendanceSessionForSelection(
      transaction,
      { id: batch.id, code: batch.code },
      input,
    );

    const overwrittenRecordCount = existingSession
      ? await transaction.attendanceRecord.count({
          where: {
            attendanceSessionId: existingSession.id,
            enrollmentId: { in: touchedEnrollmentIds },
          },
        })
      : 0;

    for (const record of input.records) {
      const enrollment = enrollmentMap.get(record.learnerId);
      if (!enrollment) {
        continue;
      }

      await transaction.attendanceRecord.upsert({
        where: {
          enrollmentId_attendanceSessionId: {
            enrollmentId: enrollment.id,
            attendanceSessionId: resolvedSession.id,
          },
        },
        update: {
          status: record.status as AttendanceStatus,
          notes: record.notes,
          markedById: input.markedByUserId,
          sessionDate: resolvedSession.sessionDate,
        },
        create: {
          enrollmentId: enrollment.id,
          attendanceSessionId: resolvedSession.id,
          sessionDate: resolvedSession.sessionDate,
          status: record.status as AttendanceStatus,
          notes: record.notes,
          markedById: input.markedByUserId,
        },
      });
    }

    return {
      ...resolvedSession,
      overwrittenRecordCount,
    };
  });

  await Promise.all(batch.enrollments.map((enrollment) => recomputeLearnerReadiness(enrollment.learnerId)));

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.ATTENDANCE_SESSION,
    entityId: attendanceSession.id,
    action: AUDIT_ACTION_TYPE.MARKED,
    message: `Attendance marked for ${input.records.length} learners in batch ${batch.code}.`,
    metadata: {
      batchId: batch.id,
      batchCode: batch.code,
      attendanceSessionId: attendanceSession.id,
      sessionDate: attendanceSession.sessionDate.toISOString(),
      sessionTitle: attendanceSession.title,
      sessionSourceType: attendanceSession.sourceType,
      scheduleEventId: attendanceSession.linkedScheduleEventId,
      recordsUpdated: input.records.length,
      overwrittenRecordCount: attendanceSession.overwrittenRecordCount,
      statusBreakdown: summarizeAttendanceStatuses(input.records),
      learnerCodes: input.records.map((record) => record.learnerId),
    },
    actorUserId: options?.actorUserId ?? input.markedByUserId ?? null,
  });

  return {
    batchCode: batch.code,
    recordsUpdated: input.records.length,
    attendanceSessionId: attendanceSession.id,
    sessionDate: attendanceSession.sessionDate.toISOString(),
    sessionSourceType: attendanceSession.sourceType,
    scheduleEventId: attendanceSession.linkedScheduleEventId,
    sessionTitle: attendanceSession.title,
    overwrittenRecordCount: attendanceSession.overwrittenRecordCount,
  };
}
