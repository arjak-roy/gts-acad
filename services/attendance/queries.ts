import "server-only";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { AttendanceWorkspaceQueryInput } from "@/lib/validation-schemas/attendance";
import { listBatchesService } from "@/services/batches-service";
import { getLearnersService } from "@/services/learners/queries";

import { formatAttendanceDateKey, normalizeAttendanceDate, resolveAttendanceSessionTarget } from "@/services/attendance/session-utils";
import {
  AttendanceScheduledEventSummary,
  AttendanceStatusValue,
  AttendanceWorkspaceData,
  AttendanceWorkspaceRow,
  AttendanceWorkspaceSummary,
} from "@/services/attendance/types";

function buildWorkspaceSummary(rows: AttendanceWorkspaceRow[]): AttendanceWorkspaceSummary {
  const counts = rows.reduce(
    (summary, row) => {
      if (!row.existingStatus) {
        return summary;
      }

      summary.markedCount += 1;

      if (row.existingStatus === "PRESENT") {
        summary.presentCount += 1;
      } else if (row.existingStatus === "ABSENT") {
        summary.absentCount += 1;
      } else if (row.existingStatus === "LATE") {
        summary.lateCount += 1;
      } else if (row.existingStatus === "EXCUSED") {
        summary.excusedCount += 1;
      }

      return summary;
    },
    {
      totalLearners: rows.length,
      markedCount: 0,
      presentCount: 0,
      absentCount: 0,
      lateCount: 0,
      excusedCount: 0,
    },
  );

  return counts;
}

function mapScheduledEvent(event: {
  id: string;
  title: string;
  type: "CLASS" | "TEST";
  status: string;
  classMode: "ONLINE" | "OFFLINE" | null;
  startsAt: Date;
  endsAt: Date | null;
}): AttendanceScheduledEventSummary {
  return {
    id: event.id,
    title: event.title,
    type: event.type,
    status: event.status,
    classMode: event.classMode,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt?.toISOString() ?? null,
  };
}

export async function getAttendanceWorkspaceService(input: AttendanceWorkspaceQueryInput): Promise<AttendanceWorkspaceData> {
  const normalizedDate = normalizeAttendanceDate(input.sessionDate);

  if (!isDatabaseConfigured) {
    const [batches, learners] = await Promise.all([
      listBatchesService(),
      getLearnersService({
        search: "",
        batchCode: input.batchCode,
        placementStatus: undefined,
        page: 1,
        pageSize: 250,
        sortBy: "fullName",
        sortDirection: "asc",
      }),
    ]);

    const batch = batches.find((item) => item.code.toLowerCase() === input.batchCode.trim().toLowerCase());

    if (!batch) {
      throw new Error("Batch not found.");
    }

    const roster = learners.items.map<AttendanceWorkspaceRow>((learner) => ({
      enrollmentId: learner.id,
      learnerId: learner.id,
      learnerCode: learner.learnerCode,
      learnerName: learner.fullName,
      attendancePercentage: learner.attendancePercentage,
      readinessPercentage: learner.readinessPercentage,
      existingStatus: null,
      existingNotes: null,
    }));

    return {
      batch: {
        id: batch.id,
        code: batch.code,
        name: batch.name,
        programName: batch.programName,
        campus: batch.campus,
        activeLearnerCount: roster.length,
      },
      selection: {
        sessionDate: formatAttendanceDateKey(normalizedDate),
        sessionSourceType: input.sessionSourceType,
        scheduleEventId: input.scheduleEventId ?? null,
      },
      session: null,
      scheduledEvents: [],
      roster,
      summary: buildWorkspaceSummary(roster),
    };
  }

  const batch = await prisma.batch.findUnique({
    where: { code: input.batchCode },
    select: {
      id: true,
      code: true,
      name: true,
      campus: true,
      program: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!batch) {
    throw new Error("Batch not found.");
  }

  const dayStart = normalizedDate;
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const sessionTarget =
    input.sessionSourceType === "MANUAL" || input.scheduleEventId
      ? await resolveAttendanceSessionTarget(prisma, { id: batch.id, code: batch.code }, input)
      : null;

  const selectedSession = sessionTarget
    ? await prisma.attendanceSession.findUnique({
        where: {
          batchId_sessionKey: {
            batchId: batch.id,
            sessionKey: sessionTarget.sessionKey,
          },
        },
        select: {
          id: true,
          sourceType: true,
          sessionDate: true,
          title: true,
          linkedScheduleEventId: true,
          updatedAt: true,
          createdBy: {
            select: {
              name: true,
            },
          },
          _count: {
            select: {
              attendanceRecords: true,
            },
          },
        },
      })
    : null;

  const [activeLearnerCount, scheduledEvents, enrollments] = await prisma.$transaction([
    prisma.batchEnrollment.count({
      where: {
        batchId: batch.id,
        status: "ACTIVE",
      },
    }),
    prisma.batchScheduleEvent.findMany({
      where: {
        batchId: batch.id,
        startsAt: {
          gte: dayStart,
          lt: dayEnd,
        },
      },
      orderBy: [{ startsAt: "asc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        classMode: true,
        startsAt: true,
        endsAt: true,
      },
    }),
    prisma.batchEnrollment.findMany({
      where: {
        batchId: batch.id,
        status: "ACTIVE",
      },
      orderBy: {
        learner: {
          fullName: "asc",
        },
      },
      select: {
        id: true,
        learnerId: true,
        learner: {
          select: {
            learnerCode: true,
            fullName: true,
            latestAttendancePercentage: true,
            readinessPercentage: true,
          },
        },
      },
    }),
  ]);

  const attendanceRecords = selectedSession
    ? await prisma.attendanceRecord.findMany({
        where: {
          attendanceSessionId: selectedSession.id,
          enrollmentId: { in: enrollments.map((enrollment) => enrollment.id) },
        },
        select: {
          enrollmentId: true,
          status: true,
          notes: true,
        },
      })
    : [];

  const attendanceMap = new Map(attendanceRecords.map((record) => [record.enrollmentId, record]));

  const roster = enrollments.map<AttendanceWorkspaceRow>((enrollment) => {
    const existingRecord = attendanceMap.get(enrollment.id);

    return {
      enrollmentId: enrollment.id,
      learnerId: enrollment.learnerId,
      learnerCode: enrollment.learner.learnerCode,
      learnerName: enrollment.learner.fullName,
      attendancePercentage: Number(enrollment.learner.latestAttendancePercentage),
      readinessPercentage: enrollment.learner.readinessPercentage,
      existingStatus: (existingRecord?.status as AttendanceStatusValue | undefined) ?? null,
      existingNotes: existingRecord?.notes ?? null,
    };
  });

  return {
    batch: {
      id: batch.id,
      code: batch.code,
      name: batch.name,
      programName: batch.program.name,
      campus: batch.campus,
      activeLearnerCount,
    },
    selection: {
      sessionDate: formatAttendanceDateKey(normalizedDate),
      sessionSourceType: input.sessionSourceType,
      scheduleEventId: input.scheduleEventId ?? null,
    },
    session: selectedSession
      ? {
          id: selectedSession.id,
          sourceType: selectedSession.sourceType,
          sessionDate: selectedSession.sessionDate.toISOString(),
          title: selectedSession.title,
          linkedScheduleEventId: selectedSession.linkedScheduleEventId,
          existingRecordCount: selectedSession._count.attendanceRecords,
          updatedAt: selectedSession.updatedAt.toISOString(),
          createdByName: selectedSession.createdBy?.name ?? null,
        }
      : null,
    scheduledEvents: scheduledEvents.map(mapScheduledEvent),
    roster,
    summary: buildWorkspaceSummary(roster),
  };
}