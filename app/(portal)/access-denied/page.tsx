"use client";

import Link from "next/link";
import { ShieldX } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AccessDeniedPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <ShieldX className="h-16 w-16 text-red-400" />
      <h1 className="text-2xl font-bold text-slate-900">Access Denied</h1>
      <p className="max-w-md text-sm text-slate-500">
        You don&apos;t have permission to access this page. Contact your administrator if you believe this is an error.
      </p>
      <Button asChild variant="secondary" className="mt-2">
        <Link href="/dashboard">Back to Dashboard</Link>
      </Button>
    </div>
  );
}
