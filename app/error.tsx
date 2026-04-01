"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function RootError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md rounded-3xl border border-academy-border bg-white p-8 text-center shadow-shell">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-accent">System Error</p>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-950">The admin portal failed to load.</h1>
        <p className="mt-3 text-sm text-slate-500">Retry the request after the segment tree is reset.</p>
        <Button className="mt-6" onClick={reset}>
          Retry
        </Button>
      </div>
    </div>
  );
}