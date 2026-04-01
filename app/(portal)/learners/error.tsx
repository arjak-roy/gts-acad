"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function LearnersError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-[32px] border border-[#dde1e6] bg-white p-8 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.28em] text-accent">Learners Error</p>
      <h2 className="mt-3 text-2xl font-extrabold text-slate-950">The learner registry could not be loaded.</h2>
      <Button className="mt-5" onClick={reset}>
        Retry Learners
      </Button>
    </div>
  );
}