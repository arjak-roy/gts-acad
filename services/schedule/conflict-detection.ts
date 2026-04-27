import "server-only";

import { EvaluationStatus, SessionHistoryAction, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma-client";

// ── Types ──────────────────────────────────────────────────────

export type ConflictInfo = {
  eventId: string;
  eventTitle: string;
  startsAt: string;
  endsAt: string | null;
  batchCode: string;
  role: string;
};

export type ConflictCheckResult = {
  hasConflict: boolean;
  conflicts: ConflictInfo[];
  availabilityIssue: string | null;
};

// ── Conflict Detection ─────────────────────────────────────────

/**
 * Check whether a trainer has scheduling conflicts for a given time window.
 * Returns overlapping active session assignments and availability issues.
 */
export async function checkTrainerConflicts(
  trainerProfileId: string,
  startsAt: Date,
  endsAt: Date,
  excludeEventId?: string | null,
): Promise<ConflictCheckResult> {
  // 1. Check trainer availability status
  const trainer = await prisma.trainerProfile.findUnique({
    where: { id: trainerProfileId },
    select: {
      availabilityStatus: true,
      user: { select: { name: true } },
    },
  });

  if (!trainer) {
    throw new Error("Trainer not found.");
  }

  let availabilityIssue: string | null = null;
  if (trainer.availabilityStatus === "UNAVAILABLE") {
    availabilityIssue = `${trainer.user.name} is currently marked as unavailable.`;
  } else if (trainer.availabilityStatus === "ON_LEAVE") {
    availabilityIssue = `${trainer.user.name} is currently on leave.`;
  }

  // 2. Find overlapping active assignments
  // An overlap occurs when: existingStart < newEnd AND existingEnd > newStart
  const overlapping = await prisma.trainerSessionAssignment.findMany({
    where: {
      trainerProfileId,
      removedAt: null,
      ...(excludeEventId ? { scheduleEventId: { not: excludeEventId } } : {}),
      scheduleEvent: {
        status: { notIn: [EvaluationStatus.CANCELLED] },
        startsAt: { lt: endsAt },
        OR: [
          { endsAt: { gt: startsAt } },
          // If endsAt is null, treat event as a point-in-time; overlap if it starts during the window
          { endsAt: null, startsAt: { gte: startsAt } },
        ],
      },
    },
    select: {
      role: true,
      scheduleEvent: {
        select: {
          id: true,
          title: true,
          startsAt: true,
          endsAt: true,
          batch: { select: { code: true } },
        },
      },
    },
    orderBy: { scheduleEvent: { startsAt: "asc" } },
  });

  const conflicts: ConflictInfo[] = overlapping.map((a) => ({
    eventId: a.scheduleEvent.id,
    eventTitle: a.scheduleEvent.title,
    startsAt: a.scheduleEvent.startsAt.toISOString(),
    endsAt: a.scheduleEvent.endsAt?.toISOString() ?? null,
    batchCode: a.scheduleEvent.batch.code,
    role: a.role,
  }));

  return {
    hasConflict: conflicts.length > 0 || availabilityIssue !== null,
    conflicts,
    availabilityIssue,
  };
}

/**
 * Batch-check conflicts for multiple trainers against a time window.
 */
export async function checkMultipleTrainerConflicts(
  trainers: Array<{ trainerProfileId: string; role: string }>,
  startsAt: Date,
  endsAt: Date,
  excludeEventId?: string | null,
): Promise<Map<string, ConflictCheckResult>> {
  const results = new Map<string, ConflictCheckResult>();

  for (const trainer of trainers) {
    const result = await checkTrainerConflicts(trainer.trainerProfileId, startsAt, endsAt, excludeEventId);
    results.set(trainer.trainerProfileId, result);
  }

  return results;
}
