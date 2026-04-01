"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function PortalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-[32px] border border-[#dde1e6] bg-white p-8 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.28em] text-accent">Portal Error</p>
      <h2 className="mt-3 text-2xl font-extrabold text-slate-950">This workspace segment failed to render.</h2>
      <p className="mt-2 text-sm text-slate-500">Reset the route segment and retry the request.</p>
      <Button className="mt-5" onClick={reset}>
        Reset Segment
      </Button>
    </div>
  );
}