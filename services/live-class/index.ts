import "server-only";

import { AttendanceStatus, EvaluationStatus, LiveClassProvider } from "@prisma/client";

import { prisma } from "@/lib/prisma-client";
import { batchScheduleEventDelegate } from "@/services/schedule/internal-helpers";
import { EventRecord } from "@/services/schedule/types";
import { markAttendanceService } from "@/services/attendance/mark-attendance";
import { createHmsRoom, disableHmsRoom, generateAuthToken, type HmsRoomInfo } from "@/services/live-class/hms-service";

const EARLY_JOIN_MINUTES = 10;

type LiveClassEventRecord = EventRecord & {
  batch: { id: string; code: string; name: string };
};

export async function resolveOrCreateLiveRoom(eventId: string, actorUserId: string): Promise<{
  roomId: string;
  roomCode: string | null;
  authToken: string;
}> {
  const scheduleEvents = batchScheduleEventDelegate(prisma);

  const event = (await scheduleEvents.findUnique({
    where: { id: eventId },
    include: {
      batch: { select: { id: true, code: true, name: true } },
    },
  })) as LiveClassEventRecord | null;

  if (!event) {
    throw new Error("Schedule event not found.");
  }

  if (event.liveProvider !== LiveClassProvider.HMS) {
    throw new Error("This event is not configured for 100ms live classes.");
  }

  if (event.status === EvaluationStatus.CANCELLED) {
    throw new Error("This event has been cancelled.");
  }

  if (event.status === EvaluationStatus.COMPLETED) {
    throw new Error("This live class has already ended.");
  }

  let roomId = event.liveRoomId;
  let roomCode = event.liveRoomCode;

  if (!roomId) {
    const roomName = `${event.batch.code}-${event.id.slice(0, 8)}`;
    const roomInfo: HmsRoomInfo = await createHmsRoom(roomName);

    roomId = roomInfo.roomId;
    roomCode = roomInfo.roomCodes.host;

    await scheduleEvents.update({
      where: { id: eventId },
      data: {
        liveRoomId: roomInfo.roomId,
        liveRoomCode: roomInfo.roomCodes.guest,
      },
    });
  }

  const authToken = await generateAuthToken({
    roomId,
    role: "broadcaster",
    userId: actorUserId,
  });

  return { roomId, roomCode, authToken };
}

export async function startLiveClass(eventId: string, actorUserId: string): Promise<{
  roomId: string;
  authToken: string;
}> {
  const result = await resolveOrCreateLiveRoom(eventId, actorUserId);

  const scheduleEvents = batchScheduleEventDelegate(prisma);

  await scheduleEvents.update({
    where: { id: eventId },
    data: {
      status: EvaluationStatus.IN_PROGRESS,
      liveStartedAt: new Date(),
    },
  });

  return { roomId: result.roomId, authToken: result.authToken };
}

export async function endLiveClass(eventId: string, _actorUserId: string): Promise<void> {
  const scheduleEvents = batchScheduleEventDelegate(prisma);

  const event = (await scheduleEvents.findUnique({
    where: { id: eventId },
    include: {
      batch: { select: { id: true, code: true, name: true } },
    },
  })) as LiveClassEventRecord | null;

  if (!event) {
    throw new Error("Schedule event not found.");
  }

  if (event.liveProvider !== LiveClassProvider.HMS) {
    throw new Error("This event is not configured for 100ms live classes.");
  }

  if (event.status === EvaluationStatus.COMPLETED) {
    return;
  }

  await scheduleEvents.update({
    where: { id: eventId },
    data: {
      status: EvaluationStatus.COMPLETED,
      liveEndedAt: new Date(),
    },
  });

  if (event.liveRoomId) {
    try {
      await disableHmsRoom(event.liveRoomId);
    } catch (error) {
      console.warn(`Failed to disable 100ms room ${event.liveRoomId}:`, error);
    }
  }

  // Auto-sync attendance: mark all enrolled learners as PRESENT for this live class.
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { batchId: event.batch.id },
      include: { learner: { select: { learnerCode: true } } },
    });

    if (enrollments.length > 0) {
      await markAttendanceService(
        {
          batchCode: event.batch.code,
          sessionDate: event.startsAt,
          sessionSourceType: "SCHEDULE_EVENT",
          scheduleEventId: event.id,
          records: enrollments.map((enrollment) => ({
            learnerId: enrollment.learner.learnerCode,
            status: "PRESENT" as const,
          })),
        },
        { actorUserId: _actorUserId },
      );
    }
  } catch (attendanceError) {
    console.warn(`Failed to auto-sync attendance for event ${eventId}:`, attendanceError);
  }
}

export async function generateCandidateJoinToken(eventId: string, candidateUserId: string, candidateName?: string): Promise<{
  authToken: string;
  roomCode: string | null;
  roomId: string;
}> {
  const scheduleEvents = batchScheduleEventDelegate(prisma);

  const event = (await scheduleEvents.findUnique({
    where: { id: eventId },
    include: {
      batch: { select: { id: true, code: true, name: true } },
    },
  })) as LiveClassEventRecord | null;

  if (!event) {
    throw new Error("Schedule event not found.");
  }

  if (event.liveProvider !== LiveClassProvider.HMS) {
    throw new Error("This event is not configured for live class join.");
  }

  if (event.status === EvaluationStatus.CANCELLED) {
    throw new Error("This event has been cancelled.");
  }

  if (event.status === EvaluationStatus.COMPLETED) {
    throw new Error("This live class has already ended.");
  }

  const now = new Date();
  const earlyJoinThreshold = new Date(event.startsAt.getTime() - EARLY_JOIN_MINUTES * 60 * 1000);

  if (now < earlyJoinThreshold && event.status !== EvaluationStatus.IN_PROGRESS) {
    throw new Error("This live class is not open for joining yet.");
  }

  if (!event.liveRoomId) {
    throw new Error("The host has not started this live class yet.");
  }

  const authToken = await generateAuthToken({
    roomId: event.liveRoomId,
    role: "viewer-on-stage",
    userId: candidateUserId,
    userName: candidateName,
  });

  return {
    authToken,
    roomCode: event.liveRoomCode,
    roomId: event.liveRoomId,
  };
}
