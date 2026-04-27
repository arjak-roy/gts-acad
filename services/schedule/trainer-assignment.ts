import "server-only";

import { EvaluationStatus, SessionHistoryAction, TrainerSessionRole, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma-client";
import { checkTrainerConflicts, type ConflictCheckResult } from "@/services/schedule/conflict-detection";
import { logSessionEvent } from "@/services/schedule/session-history";

// ── Types ──────────────────────────────────────────────────────

export type TrainerAssignmentDetail = {
  id: string;
  trainerProfileId: string;
  trainerName: string;
  employeeCode: string;
  role: string;
  assignedAt: string;
  assignedByName: string | null;
};

export type AssignTrainerInput = {
  scheduleEventId: string;
  trainerProfileId: string;
  role?: TrainerSessionRole;
};

export type AssignTrainersToEventResult = {
  assignments: TrainerAssignmentDetail[];
  conflicts: Record<string, ConflictCheckResult>;
};

// ── Queries ────────────────────────────────────────────────────

export async function listTrainerAssignments(scheduleEventId: string): Promise<TrainerAssignmentDetail[]> {
  const rows = await prisma.trainerSessionAssignment.findMany({
    where: { scheduleEventId, removedAt: null },
    orderBy: [{ role: "asc" }, { assignedAt: "asc" }],
    select: {
      id: true,
      trainerProfileId: true,
      role: true,
      assignedAt: true,
      trainerProfile: {
        select: {
          employeeCode: true,
          user: { select: { name: true } },
        },
      },
      assignedBy: { select: { name: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    trainerProfileId: r.trainerProfileId,
    trainerName: r.trainerProfile.user.name,
    employeeCode: r.trainerProfile.employeeCode,
    role: r.role,
    assignedAt: r.assignedAt.toISOString(),
    assignedByName: r.assignedBy?.name ?? null,
  }));
}

// ── Commands ───────────────────────────────────────────────────

/**
 * Assign a trainer to a schedule event. Runs conflict detection first.
 * If conflicts exist, returns them in the response but still creates the assignment
 * (the caller/UI decides whether to block based on `schedule.edit` permission).
 */
export async function assignTrainerToSession(
  input: AssignTrainerInput,
  actorUserId: string | null,
): Promise<{ assignment: TrainerAssignmentDetail; conflictCheck: ConflictCheckResult }> {
  const event = await prisma.batchScheduleEvent.findUnique({
    where: { id: input.scheduleEventId },
    select: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
      status: true,
    },
  });

  if (!event) {
    throw new Error("Schedule event not found.");
  }

  if (event.status === EvaluationStatus.CANCELLED) {
    throw new Error("Cannot assign trainers to a cancelled session.");
  }

  // Check for existing active assignment (unique constraint handles races, but give a nicer error)
  const existing = await prisma.trainerSessionAssignment.findFirst({
    where: {
      scheduleEventId: input.scheduleEventId,
      trainerProfileId: input.trainerProfileId,
      removedAt: null,
    },
  });

  if (existing) {
    throw new Error("This trainer is already assigned to this session.");
  }

  // Conflict detection
  const endsAt = event.endsAt ?? new Date(event.startsAt.getTime() + 60 * 60 * 1000); // default 1h if no end
  const conflictCheck = await checkTrainerConflicts(input.trainerProfileId, event.startsAt, endsAt, event.id);

  const role = input.role ?? TrainerSessionRole.PRIMARY;

  const created = await prisma.trainerSessionAssignment.create({
    data: {
      scheduleEventId: input.scheduleEventId,
      trainerProfileId: input.trainerProfileId,
      role,
      assignedById: actorUserId,
    },
    select: {
      id: true,
      trainerProfileId: true,
      role: true,
      assignedAt: true,
      trainerProfile: {
        select: {
          employeeCode: true,
          user: { select: { name: true } },
        },
      },
      assignedBy: { select: { name: true } },
    },
  });

  await logSessionEvent(input.scheduleEventId, SessionHistoryAction.TRAINER_ASSIGNED, actorUserId, {
    trainerProfileId: input.trainerProfileId,
    trainerName: created.trainerProfile.user.name,
    role,
    hadConflicts: conflictCheck.hasConflict,
  });

  return {
    assignment: {
      id: created.id,
      trainerProfileId: created.trainerProfileId,
      trainerName: created.trainerProfile.user.name,
      employeeCode: created.trainerProfile.employeeCode,
      role: created.role,
      assignedAt: created.assignedAt.toISOString(),
      assignedByName: created.assignedBy?.name ?? null,
    },
    conflictCheck,
  };
}

/**
 * Assign multiple trainers to an event at once (used during event creation).
 */
export async function assignTrainersToEvent(
  scheduleEventId: string,
  trainers: Array<{ trainerProfileId: string; role?: TrainerSessionRole }>,
  actorUserId: string | null,
): Promise<AssignTrainersToEventResult> {
  const assignments: TrainerAssignmentDetail[] = [];
  const conflicts: Record<string, ConflictCheckResult> = {};

  for (const t of trainers) {
    const result = await assignTrainerToSession(
      { scheduleEventId, trainerProfileId: t.trainerProfileId, role: t.role },
      actorUserId,
    );
    assignments.push(result.assignment);
    if (result.conflictCheck.hasConflict) {
      conflicts[t.trainerProfileId] = result.conflictCheck;
    }
  }

  return { assignments, conflicts };
}

/**
 * Remove a trainer from a session (soft-delete).
 */
export async function removeTrainerFromSession(
  assignmentId: string,
  actorUserId: string | null,
): Promise<void> {
  const assignment = await prisma.trainerSessionAssignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      scheduleEventId: true,
      trainerProfileId: true,
      role: true,
      removedAt: true,
      trainerProfile: {
        select: {
          user: { select: { name: true } },
        },
      },
    },
  });

  if (!assignment) {
    throw new Error("Trainer assignment not found.");
  }

  if (assignment.removedAt) {
    throw new Error("This trainer assignment has already been removed.");
  }

  await prisma.trainerSessionAssignment.update({
    where: { id: assignmentId },
    data: {
      removedAt: new Date(),
      removedById: actorUserId,
    },
  });

  await logSessionEvent(assignment.scheduleEventId, SessionHistoryAction.TRAINER_REMOVED, actorUserId, {
    trainerProfileId: assignment.trainerProfileId,
    trainerName: assignment.trainerProfile.user.name,
    previousRole: assignment.role,
  });
}

/**
 * Update a trainer's role on a session.
 */
export async function updateTrainerSessionRole(
  assignmentId: string,
  newRole: TrainerSessionRole,
  actorUserId: string | null,
): Promise<TrainerAssignmentDetail> {
  const assignment = await prisma.trainerSessionAssignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      scheduleEventId: true,
      trainerProfileId: true,
      role: true,
      removedAt: true,
      trainerProfile: {
        select: {
          employeeCode: true,
          user: { select: { name: true } },
        },
      },
    },
  });

  if (!assignment) {
    throw new Error("Trainer assignment not found.");
  }

  if (assignment.removedAt) {
    throw new Error("Cannot update a removed assignment.");
  }

  const previousRole = assignment.role;

  const updated = await prisma.trainerSessionAssignment.update({
    where: { id: assignmentId },
    data: { role: newRole },
    select: {
      id: true,
      trainerProfileId: true,
      role: true,
      assignedAt: true,
      trainerProfile: {
        select: {
          employeeCode: true,
          user: { select: { name: true } },
        },
      },
      assignedBy: { select: { name: true } },
    },
  });

  await logSessionEvent(assignment.scheduleEventId, SessionHistoryAction.TRAINER_ROLE_CHANGED, actorUserId, {
    trainerProfileId: assignment.trainerProfileId,
    trainerName: assignment.trainerProfile.user.name,
    previousRole,
    newRole,
  });

  return {
    id: updated.id,
    trainerProfileId: updated.trainerProfileId,
    trainerName: updated.trainerProfile.user.name,
    employeeCode: updated.trainerProfile.employeeCode,
    role: updated.role,
    assignedAt: updated.assignedAt.toISOString(),
    assignedByName: updated.assignedBy?.name ?? null,
  };
}
