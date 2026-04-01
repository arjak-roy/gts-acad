import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md rounded-[32px] border border-[#dde1e6] bg-white p-8 text-center shadow-shell">
        <p className="text-xs font-black uppercase tracking-[0.32em] text-accent">Not Found</p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950">This route is not part of the academy workspace.</h1>
        <p className="mt-3 text-sm text-slate-500">Use the dashboard shell to return to a supported admin module.</p>
        <Button asChild className="mt-6">
          <Link href="/dashboard">Return to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}