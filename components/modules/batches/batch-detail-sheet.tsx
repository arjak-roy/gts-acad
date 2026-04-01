"use client";

import { useEffect, useState } from "react";
import { BookOpen, Calendar, MapPin, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SheetLoadingSkeleton } from "@/components/ui/sheet-skeleton-variants";

type BatchStatus = "DRAFT" | "PLANNED" | "IN_SESSION" | "COMPLETED" | "ARCHIVED" | "CANCELLED";
type BatchMode = "ONLINE" | "OFFLINE";

type BatchDetail = {
  id: string;
  code: string;
  name: string;
  programName: string;
  campus: string | null;
  status: BatchStatus;
  mode: BatchMode;
  trainerIds: string[];
  trainerNames: string[];
  startDate?: string;
  endDate?: string | null;
  capacity?: number;
  schedule?: string[];
};

type BatchDetailSheetProps = {
  batchId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (batchId: string) => void;
};

function statusVariant(status: BatchStatus) {
  if (status === "IN_SESSION") return "success" as const;
  if (status === "PLANNED") return "info" as const;
  if (status === "COMPLETED") return "default" as const;
  if (status === "ARCHIVED" || status === "CANCELLED") return "danger" as const;
  return "default" as const;
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function BatchDetailSheet({ batchId, open, onOpenChange, onEdit }: BatchDetailSheetProps) {
  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !batchId) {
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);
    setBatch(null);

    fetch(`/api/batches/${batchId}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load batch details.");
        const payload = (await res.json()) as { data?: BatchDetail };
        if (active && payload.data) setBatch(payload.data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to load batch details.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => { active = false; };
  }, [batchId, open]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setBatch(null);
      setError(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex flex-col overflow-hidden">
        {isLoading ? (
          <SheetLoadingSkeleton isLoading={true} variant="detail" />
        ) : error ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-rose-600">{error}</p>
          </div>
        ) : batch ? (
          <>
            <SheetHeader>
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-primary">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <SheetTitle>{batch.name}</SheetTitle>
                  <SheetDescription className="mt-1 text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                    {batch.code}
                  </SheetDescription>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant={statusVariant(batch.status)}>{batch.status.replace("_", " ")}</Badge>
                    <Badge variant="default">{batch.mode}</Badge>
                  </div>
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-6">
              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Program</p>
                <div className="mt-3 flex items-start gap-3">
                  <BookOpen className="mt-0.5 h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-slate-900">{batch.programName}</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Schedule</p>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    <div className="flex items-start gap-3">
                      <Calendar className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <p className="font-semibold text-slate-900">Start</p>
                        <p>{formatDate(batch.startDate)}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Calendar className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <p className="font-semibold text-slate-900">End</p>
                        <p>{formatDate(batch.endDate)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Logistics</p>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <p className="font-semibold text-slate-900">Campus</p>
                        <p>{batch.campus ?? "Not specified"}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Users className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <p className="font-semibold text-slate-900">Capacity</p>
                        <p>{batch.capacity ?? "—"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Assigned Trainers</p>
                {batch.trainerNames.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">No trainers assigned.</p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {batch.trainerNames.map((name) => (
                      <span key={name} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                        {name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {batch.schedule && batch.schedule.length > 0 ? (
                <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Days</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {batch.schedule.map((day) => (
                      <span key={day} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {day}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <SheetFooter>
              <Button variant="secondary" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
              <Button onClick={() => onEdit(batch.id)}>
                Edit Batch
              </Button>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
