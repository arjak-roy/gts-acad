"use client";

import { startTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, GraduationCap, MapPin, Phone, ShieldCheck, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { createSearchParams } from "@/lib/utils";
import { useSyncReadiness } from "@/hooks/use-sync-readiness";
import { LearnerDetail, PlacementStatus, SyncStatus } from "@/types";

type LearnerSheetProps = {
  learner: LearnerDetail | null;
};

function getStatusBadge(status: PlacementStatus) {
  if (status === PlacementStatus.PLACEMENT_READY) return "success" as const;
  if (status === PlacementStatus.IN_REVIEW) return "warning" as const;
  return "default" as const;
}

function getSyncBadge(status: SyncStatus) {
  if (status === SyncStatus.SYNCED) return "info" as const;
  if (status === SyncStatus.FAILED) return "danger" as const;
  if (status === SyncStatus.QUEUED) return "warning" as const;
  return "default" as const;
}

export function LearnerSheet({ learner }: LearnerSheetProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const syncMutation = useSyncReadiness();
  const open = Boolean(learner);

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      return;
    }

    const next = new URLSearchParams(searchParams.toString());
    next.delete("id");
    startTransition(() => {
      const queryString = next.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    });
  };

  const handleSync = async () => {
    if (!learner) {
      return;
    }

    await syncMutation.mutateAsync({ learnerCode: learner.learnerCode });
    startTransition(() => router.refresh());
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent>
        {learner ? (
          <>
            <SheetHeader>
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-lg font-black text-primary">
                  {learner.fullName
                    .split(" ")
                    .map((part) => part[0])
                    .join("")}
                </div>
                <div>
                  <SheetTitle>{learner.fullName}</SheetTitle>
                  <SheetDescription className="mt-1 text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">ID: {learner.learnerCode}</SheetDescription>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant={getStatusBadge(learner.placementStatus)}>{learner.placementStatus.replaceAll("_", " ")}</Badge>
                    <Badge variant={getSyncBadge(learner.recruiterSyncStatus)}>{learner.recruiterSyncStatus.replaceAll("_", " ")}</Badge>
                  </div>
                </div>
              </div>
            </SheetHeader>
            <div className="flex-1 space-y-6 overflow-y-auto bg-slate-50 p-6">
              <div className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-5">
                  <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-8 border-blue-50 text-2xl font-black text-primary">
                    {learner.readinessPercentage}%
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Readiness Benchmark</p>
                    <p className="mt-1 text-sm text-slate-500">Aggregated scoring across academics, attendance, and soft-skills readiness.</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Pathway</p>
                  <div className="mt-4 space-y-3 text-sm text-slate-600">
                    <div className="flex items-start gap-3">
                      <GraduationCap className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <p className="font-bold text-slate-900">{learner.programName ?? "Program not assigned"}</p>
                        <p>{learner.batchCode ?? "Batch pending"}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <UserRound className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <p className="font-bold text-slate-900">Trainer</p>
                        <p>{learner.trainerName ?? "Unassigned"}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Profile</p>
                  <div className="mt-4 space-y-3 text-sm text-slate-600">
                    <div className="flex items-start gap-3">
                      <Phone className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <p className="font-bold text-slate-900">Phone</p>
                        <p>{learner.phone ?? "Not available"}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <p className="font-bold text-slate-900">Country</p>
                        <p>{learner.country ?? "Not available"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Performance Snapshot</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Attendance</p>
                    <p className="mt-2 text-2xl font-black text-primary">{learner.attendancePercentage.toFixed(1)}%</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Assessment</p>
                    <p className="mt-2 text-2xl font-black text-primary">{learner.averageScore.toFixed(0)}/100</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Soft Skills</p>
                    <p className="mt-2 text-2xl font-black text-primary">{learner.softSkillsScore ?? 0}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-4 w-4 text-accent" />
                  <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">Recruiter Sync</p>
                </div>
                <p className="mt-3 text-sm text-slate-600">{learner.latestSyncMessage ?? "No recruiter sync has been triggered yet."}</p>
              </div>
            </div>
            <SheetFooter>
              <Button variant="secondary" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
              <Button onClick={handleSync} disabled={syncMutation.isPending}>
                <ExternalLink className="h-4 w-4" />
                {syncMutation.isPending ? "Syncing..." : "Push to Recruiter Workspace"}
              </Button>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}