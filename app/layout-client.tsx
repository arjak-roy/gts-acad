"use client";

import { ReactNode } from "react";
import { LoadingProgressBar } from "@/components/ui/loading-progress-bar";
import { useQueryLoadingProgress } from "@/hooks/use-query-loading-progress";

export function LayoutClient({ children }: { children: ReactNode }) {
  // Setup query loading progress tracking
  useQueryLoadingProgress();

  return (
    <>
      <LoadingProgressBar />
      {children}
    </>
  );
}
