"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { syncReadinessStatus } from "@/app/actions/readiness";

/**
 * Exposes a mutation for pushing readiness state to downstream systems.
 * Delegates payload validation and sync logic to the server action layer.
 * Refreshes related query data after success to avoid stale readiness badges.
 */
export function useSyncReadiness() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: syncReadinessStatus,
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    },
  });
}