"use client";

import { useEffect, useState } from "react";
import { BookOpen, Calendar, Tag } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/ui/can-access";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SheetLoadingSkeleton } from "@/components/ui/sheet-skeleton-variants";

type ProgramType = "LANGUAGE" | "CLINICAL" | "TECHNICAL";

type BatchSummary = {
  id: string;
  code: string;
  name: string;
};

type TrainerSummary = {
  id: string;
  fullName: string;
  specialization: string;
};

type BatchLearner = {
  id: string;
  learnerCode: string;
  fullName: string;
};

type LearnersResponse = {
  items: BatchLearner[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

type ProgramDetail = {
  id: string;
  courseId: string;
  courseName: string;
  name: string;
  type: ProgramType;
  durationWeeks: number;
  category: string | null;
  description: string | null;
  isActive: boolean;
  batches?: BatchSummary[];
  trainers?: TrainerSummary[];
};

type ProgramDetailSheetProps = {
  programId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (programId: string) => void;
};

const TYPE_LABEL: Record<ProgramType, string> = {
  LANGUAGE: "Language",
  CLINICAL: "Clinical",
  TECHNICAL: "Technical",
};

export function ProgramDetailSheet({ programId, open, onOpenChange, onEdit }: ProgramDetailSheetProps) {
  const [program, setProgram] = useState<ProgramDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openStudentSections, setOpenStudentSections] = useState<Record<string, boolean>>({});
  const [batchLearners, setBatchLearners] = useState<Record<string, BatchLearner[]>>({});
  const [batchLearnerCounts, setBatchLearnerCounts] = useState<Record<string, number>>({});
  const [loadingStudentsByBatch, setLoadingStudentsByBatch] = useState<Record<string, boolean>>({});
  const [studentErrorByBatch, setStudentErrorByBatch] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!open || !programId) {
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);
    setProgram(null);

    fetch(`/api/programs/${programId}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load program details.");
        const payload = (await res.json()) as { data?: ProgramDetail };
        if (!active || !payload.data) return;

        // Fetch batches and trainers in parallel
        const [batchesRes, trainersRes] = await Promise.all([
          fetch(`/api/programs/${programId}/batches`, { cache: "no-store" }),
          fetch(`/api/programs/${programId}/trainers`, { cache: "no-store" }),
        ]);

        const batchesPayload = batchesRes.ok ? ((await batchesRes.json()) as { data?: BatchSummary[] }) : {};
        const trainersPayload = trainersRes.ok ? ((await trainersRes.json()) as { data?: TrainerSummary[] }) : {};

        if (active) {
          setProgram({
            ...payload.data,
            batches: batchesPayload.data ?? [],
            trainers: trainersPayload.data ?? [],
          });
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to load program details.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => { active = false; };
  }, [programId, open]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setProgram(null);
      setError(null);
      setOpenStudentSections({});
      setBatchLearners({});
      setBatchLearnerCounts({});
      setLoadingStudentsByBatch({});
      setStudentErrorByBatch({});
    }
  };

  const handleToggleStudents = async (batch: BatchSummary) => {
    const currentlyOpen = Boolean(openStudentSections[batch.id]);
    if (currentlyOpen) {
      setOpenStudentSections((prev) => ({ ...prev, [batch.id]: false }));
      return;
    }

    setOpenStudentSections((prev) => ({ ...prev, [batch.id]: true }));

    if (batchLearners[batch.id]) {
      return;
    }

    setLoadingStudentsByBatch((prev) => ({ ...prev, [batch.id]: true }));
    setStudentErrorByBatch((prev) => ({ ...prev, [batch.id]: null }));

    try {
      const params = new URLSearchParams({
        batchCode: batch.code,
        page: "1",
        pageSize: "50",
        sortBy: "fullName",
        sortDirection: "asc",
      });

      const response = await fetch(`/api/learners?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load students for this batch.");
      }

      const payload = (await response.json()) as { data?: LearnersResponse };
      const items = payload.data?.items ?? [];
      const totalCount = payload.data?.totalCount ?? items.length;

      setBatchLearners((prev) => ({ ...prev, [batch.id]: items }));
      setBatchLearnerCounts((prev) => ({ ...prev, [batch.id]: totalCount }));
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load students for this batch.";
      setStudentErrorByBatch((prev) => ({ ...prev, [batch.id]: message }));
    } finally {
      setLoadingStudentsByBatch((prev) => ({ ...prev, [batch.id]: false }));
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
        ) : program ? (
          <>
            <SheetHeader>
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <SheetTitle>{program.name}</SheetTitle>
                  <SheetDescription className="mt-1 text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                    {TYPE_LABEL[program.type]} Program
                  </SheetDescription>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant={program.isActive ? "success" : "danger"}>
                      {program.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant="info">{TYPE_LABEL[program.type]}</Badge>
                  </div>
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Course</p>
                  <div className="mt-3 flex items-start gap-3">
                    <BookOpen className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{program.courseName}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Duration</p>
                  <div className="mt-3 flex items-start gap-3">
                    <Calendar className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{program.durationWeeks} weeks</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Category</p>
                  <div className="mt-3 flex items-start gap-3">
                    <Tag className="mt-0.5 h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold text-slate-900">{program.category ?? "Not specified"}</p>
                  </div>
                </div>
              </div>

              {program.description ? (
                <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Description</p>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{program.description}</p>
                </div>
              ) : null}

              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Program Type</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800">
                    {TYPE_LABEL[program.type]}
                  </span>
                </div>
              </div>

              {/* BATCHES SECTION */}
              {program.batches && program.batches.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400 px-1">Batches ({program.batches.length})</p>
                  {program.batches.map((batch) => (
                    <div key={batch.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{batch.name}</p>
                          <p className="mt-1 text-xs text-slate-500 font-medium">{batch.code}</p>
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-8 px-3 text-xs"
                          onClick={() => void handleToggleStudents(batch)}
                        >
                          {openStudentSections[batch.id] ? "Hide Students" : "Show Students"}
                        </Button>
                      </div>

                      {openStudentSections[batch.id] ? (
                        <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                          {loadingStudentsByBatch[batch.id] ? (
                            <p className="text-xs text-slate-500">Loading students...</p>
                          ) : studentErrorByBatch[batch.id] ? (
                            <p className="text-xs text-rose-600">{studentErrorByBatch[batch.id]}</p>
                          ) : (
                            <>
                              <p className="text-xs font-semibold text-slate-600">
                                Students ({batchLearnerCounts[batch.id] ?? batchLearners[batch.id]?.length ?? 0})
                              </p>
                              {batchLearners[batch.id] && batchLearners[batch.id].length > 0 ? (
                                <div className="mt-2 space-y-1.5">
                                  {batchLearners[batch.id].map((learner) => (
                                    <div key={learner.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                                      <span className="text-xs font-medium text-slate-800">{learner.fullName}</span>
                                      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{learner.learnerCode}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-2 text-xs text-slate-500">No students found in this batch.</p>
                              )}
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {/* TRAINERS SECTION */}
              {program.trainers && program.trainers.length > 0 ? (
                <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Assigned Trainers ({program.trainers.length})</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {program.trainers.map((trainer) => (
                      <span key={trainer.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {trainer.fullName}
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
              <CanAccess permission="programs.edit">
                <Button onClick={() => onEdit(program.id)}>
                  Edit Program
                </Button>
              </CanAccess>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
