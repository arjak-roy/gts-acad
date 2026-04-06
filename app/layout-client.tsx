"use client";

import { ReactNode, Suspense } from "react";
import { SessionExpiryWarning } from "@/components/layout/session-expiry-warning";
import { LoadingProgressBar } from "@/components/ui/loading-progress-bar";
import { useQueryLoadingProgress } from "@/hooks/use-query-loading-progress";

export function LayoutClient({ children }: { children: ReactNode }) {
  // Setup query loading progress tracking
  useQueryLoadingProgress();

  return (
    <>
      <LoadingProgressBar />
      <Suspense fallback={null}>
        <SessionExpiryWarning />
      </Suspense>
      {children}
    </>
  );
}
