"use client";

import { useLoading } from "@/lib/loading-context";

export function LoadingProgressBar() {
  const { isLoading } = useLoading();

  return (
    <>
      {isLoading && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500 animate-pulse z-50 shadow-lg" />
      )}
    </>
  );
}
