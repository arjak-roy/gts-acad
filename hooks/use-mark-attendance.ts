"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { markAttendance } from "@/app/actions/attendance";

type AttendanceMutationStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

type MarkAttendanceMutationInput = {
  batchCode: string;
  sessionDate: unknown;
  sessionSourceType?: "MANUAL" | "SCHEDULE_EVENT";
  scheduleEventId?: string;
  markedByUserId?: string;
  sessionLabel?: string;
  records: Array<{
    learnerId: string;
    status: AttendanceMutationStatus;
    notes?: string;
  }>;
};

function normalizeSessionDateValue(sessionDate: unknown) {
  if (typeof sessionDate === "string") {
    return sessionDate;
  }

  if (sessionDate instanceof Date) {
    return sessionDate.toISOString().slice(0, 10);
  }

  // Guard against accidentally passing a lazy initializer or other function
  // into the server action boundary.
  if (typeof sessionDate === "function") {
    return normalizeSessionDateValue(sessionDate());
  }

  throw new Error("Invalid attendance session date.");
}

function normalizeMarkAttendanceInput(input: MarkAttendanceMutationInput) {
  return {
    batchCode: input.batchCode,
    sessionDate: normalizeSessionDateValue(input.sessionDate),
    sessionSourceType: input.sessionSourceType ?? "MANUAL",
    scheduleEventId: input.scheduleEventId ?? undefined,
    markedByUserId: input.markedByUserId ?? undefined,
    sessionLabel: input.sessionLabel?.trim() || undefined,
    records: input.records.map((record) => ({
      learnerId: record.learnerId,
      status: record.status,
      notes: record.notes?.trim() || undefined,
    })),
  };
}

/**
 * Creates the attendance mutation used by learner and batch workflows.
 * Uses the server action as the mutation function for consistent validation.
 * Invalidates cached queries on success so dashboard and tables stay fresh.
 */
export function useMarkAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: MarkAttendanceMutationInput) => markAttendance(normalizeMarkAttendanceInput(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    },
  });
}