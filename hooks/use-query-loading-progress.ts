"use client";

import { useIsMutating, useIsFetching } from "@tanstack/react-query";
import { useEffect } from "react";
import { useLoading } from "@/lib/loading-context";

/**
 * Hook that automatically tracks React Query loading state and updates the global loading context.
 * Call this once at the top level of your app (e.g., in the main layout).
 */
export function useQueryLoadingProgress() {
  const { incrementLoadingCount, decrementLoadingCount } = useLoading();
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();

  useEffect(() => {
    const totalRequests = isFetching + isMutating;

    if (totalRequests > 0) {
      incrementLoadingCount();
    } else {
      decrementLoadingCount();
    }
  }, [isFetching, isMutating, incrementLoadingCount, decrementLoadingCount]);
}
