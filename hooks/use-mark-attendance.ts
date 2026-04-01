"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { markAttendance } from "@/app/actions/attendance";

/**
 * Creates the attendance mutation used by learner and batch workflows.
 * Uses the server action as the mutation function for consistent validation.
 * Invalidates cached queries on success so dashboard and tables stay fresh.
 */
export function useMarkAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAttendance,
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    },
  });
}