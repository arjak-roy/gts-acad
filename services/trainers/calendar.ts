import "server-only";

import { EvaluationStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma-client";

// ── Types ──────────────────────────────────────────────────────

export type TrainerCalendarEvent = {
  id: string;
  eventId: string;
  title: string;
  sessionType: string | null;
  eventType: string;
  status: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  meetingUrl: string | null;
  batchCode: string;
  batchName: string;
  courseName: string | null;
  role: string;
};

export type TrainerCalendarStats = {
  upcomingCount: number;
  completedCount: number;
  cancelledCount: number;
  totalScheduledHours: number;
  currentWeekHours: number;
  currentWeekSessions: number;
};

// ── Queries ────────────────────────────────────────────────────

/**
 * Get all session assignments for a trainer within a date range.
 * This is the primary query for the trainer calendar view.
 */
export async function getTrainerCalendar(
  trainerProfileId: string,
  from: Date,
  to: Date,
): Promise<TrainerCalendarEvent[]> {
  const assignments = await prisma.trainerSessionAssignment.findMany({
    where: {
      trainerProfileId,
      removedAt: null,
      scheduleEvent: {
        startsAt: { gte: from, lte: to },
        status: { not: EvaluationStatus.CANCELLED },
      },
    },
    orderBy: { scheduleEvent: { startsAt: "asc" } },
    select: {
      id: true,
      role: true,
      scheduleEvent: {
        select: {
          id: true,
          title: true,
          sessionType: true,
          type: true,
          status: true,
          startsAt: true,
          endsAt: true,
          location: true,
          meetingUrl: true,
          batch: {
            select: {
              code: true,
              name: true,
              program: {
                select: {
                  course: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  return assignments.map((a) => ({
    id: a.id,
    eventId: a.scheduleEvent.id,
    title: a.scheduleEvent.title,
    sessionType: a.scheduleEvent.sessionType,
    eventType: a.scheduleEvent.type,
    status: a.scheduleEvent.status,
    startsAt: a.scheduleEvent.startsAt.toISOString(),
    endsAt: a.scheduleEvent.endsAt?.toISOString() ?? null,
    location: a.scheduleEvent.location,
    meetingUrl: a.scheduleEvent.meetingUrl,
    batchCode: a.scheduleEvent.batch.code,
    batchName: a.scheduleEvent.batch.name,
    courseName: a.scheduleEvent.batch.program?.course?.name ?? null,
    role: a.role,
  }));
}

/**
 * Compute summary statistics for a trainer's sessions.
 */
export async function getTrainerCalendarStats(trainerProfileId: string): Promise<TrainerCalendarStats> {
  const now = new Date();

  // Current week boundaries (Monday to Sunday)
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() + mondayOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [upcoming, completed, cancelled, weekEvents] = await Promise.all([
    prisma.trainerSessionAssignment.count({
      where: {
        trainerProfileId,
        removedAt: null,
        scheduleEvent: {
          startsAt: { gte: now },
          status: { in: [EvaluationStatus.SCHEDULED, EvaluationStatus.RESCHEDULED] },
        },
      },
    }),
    prisma.trainerSessionAssignment.count({
      where: {
        trainerProfileId,
        removedAt: null,
        scheduleEvent: { status: EvaluationStatus.COMPLETED },
      },
    }),
    prisma.trainerSessionAssignment.count({
      where: {
        trainerProfileId,
        removedAt: null,
        scheduleEvent: { status: EvaluationStatus.CANCELLED },
      },
    }),
    prisma.trainerSessionAssignment.findMany({
      where: {
        trainerProfileId,
        removedAt: null,
        scheduleEvent: {
          startsAt: { gte: weekStart, lt: weekEnd },
          status: { notIn: [EvaluationStatus.CANCELLED] },
        },
      },
      select: {
        scheduleEvent: {
          select: { startsAt: true, endsAt: true },
        },
      },
    }),
  ]);

  // Calculate hours from all non-cancelled upcoming + completed sessions
  const allScheduled = await prisma.trainerSessionAssignment.findMany({
    where: {
      trainerProfileId,
      removedAt: null,
      scheduleEvent: {
        status: { notIn: [EvaluationStatus.CANCELLED] },
      },
    },
    select: {
      scheduleEvent: {
        select: { startsAt: true, endsAt: true },
      },
    },
  });

  const totalScheduledHours = computeHours(allScheduled.map((a) => a.scheduleEvent));
  const currentWeekHours = computeHours(weekEvents.map((a) => a.scheduleEvent));

  return {
    upcomingCount: upcoming,
    completedCount: completed,
    cancelledCount: cancelled,
    totalScheduledHours: Math.round(totalScheduledHours * 10) / 10,
    currentWeekHours: Math.round(currentWeekHours * 10) / 10,
    currentWeekSessions: weekEvents.length,
  };
}

/**
 * Get upcoming sessions for a trainer (for the trainer profile panel).
 */
export async function getTrainerUpcomingSessions(
  trainerProfileId: string,
  limit = 10,
): Promise<TrainerCalendarEvent[]> {
  const now = new Date();
  return getTrainerCalendarRange(trainerProfileId, now, null, limit, "asc");
}

/**
 * Get past (completed) sessions for a trainer.
 */
export async function getTrainerPastSessions(
  trainerProfileId: string,
  limit = 10,
): Promise<TrainerCalendarEvent[]> {
  const now = new Date();
  return getTrainerCalendarRange(trainerProfileId, null, now, limit, "desc");
}

// ── Helpers ────────────────────────────────────────────────────

function computeHours(events: Array<{ startsAt: Date; endsAt: Date | null }>): number {
  let total = 0;
  for (const e of events) {
    const end = e.endsAt ?? new Date(e.startsAt.getTime() + 60 * 60 * 1000); // default 1h
    total += (end.getTime() - e.startsAt.getTime()) / (1000 * 60 * 60);
  }
  return total;
}

async function getTrainerCalendarRange(
  trainerProfileId: string,
  from: Date | null,
  to: Date | null,
  limit: number,
  sortDir: "asc" | "desc",
): Promise<TrainerCalendarEvent[]> {
  const assignments = await prisma.trainerSessionAssignment.findMany({
    where: {
      trainerProfileId,
      removedAt: null,
      scheduleEvent: {
        ...(from ? { startsAt: { gte: from } } : {}),
        ...(to ? { startsAt: { lt: to } } : {}),
        status: { notIn: [EvaluationStatus.CANCELLED] },
      },
    },
    orderBy: { scheduleEvent: { startsAt: sortDir } },
    take: limit,
    select: {
      id: true,
      role: true,
      scheduleEvent: {
        select: {
          id: true,
          title: true,
          sessionType: true,
          type: true,
          status: true,
          startsAt: true,
          endsAt: true,
          location: true,
          meetingUrl: true,
          batch: {
            select: {
              code: true,
              name: true,
              program: {
                select: {
                  course: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  return assignments.map((a) => ({
    id: a.id,
    eventId: a.scheduleEvent.id,
    title: a.scheduleEvent.title,
    sessionType: a.scheduleEvent.sessionType,
    eventType: a.scheduleEvent.type,
    status: a.scheduleEvent.status,
    startsAt: a.scheduleEvent.startsAt.toISOString(),
    endsAt: a.scheduleEvent.endsAt?.toISOString() ?? null,
    location: a.scheduleEvent.location,
    meetingUrl: a.scheduleEvent.meetingUrl,
    batchCode: a.scheduleEvent.batch.code,
    batchName: a.scheduleEvent.batch.name,
    courseName: a.scheduleEvent.batch.program?.course?.name ?? null,
    role: a.role,
  }));
}
