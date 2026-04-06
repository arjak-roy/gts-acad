"use client";

import { ReactNode, Suspense } from "react";
import { Toaster } from "sonner";
import { SessionExpiryWarning } from "@/components/layout/session-expiry-warning";
import { LoadingProgressBar } from "@/components/ui/loading-progress-bar";
import { useQueryLoadingProgress } from "@/hooks/use-query-loading-progress";

export function LayoutClient({ children }: { children: ReactNode }) {
  // Setup query loading progress tracking
  useQueryLoadingProgress();

  return (
    <>
      <LoadingProgressBar />
      <Toaster position="top-right" richColors closeButton />
      <Suspense fallback={null}>
        <SessionExpiryWarning />
      </Suspense>
      {children}
    </>
  );
}
