"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, GraduationCap, Layers, BookOpen, UserCog, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type ProgramType = "LANGUAGE" | "CLINICAL" | "TECHNICAL";

type ProgramOption = {
  id: string;
  name: string;
  type: ProgramType;
  isActive: boolean;
};

type BatchOption = {
  id: string;
  code: string;
  name: string;
  programName: string;
  campus: string | null;
  status: string;
  trainerIds: string[];
  trainerNames: string[];
  startDate?: string;
  endDate?: string | null;
  capacity?: number;
  mode?: string;
};

type LearnerItem = {
  id: string;
  learnerCode: string;
  fullName: string;
};

type LearnersResponse = {
  items: LearnerItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const PROGRAM_TYPE_LABELS: Record<ProgramType, string> = {
  LANGUAGE: "Language",
  CLINICAL: "Clinical",
  TECHNICAL: "Technical",
};

const PROGRAM_TYPE_COLORS: Record<ProgramType, string> = {
  LANGUAGE: "bg-violet-50 text-violet-700 border-violet-200",
  CLINICAL: "bg-rose-50 text-rose-700 border-rose-200",
  TECHNICAL: "bg-sky-50 text-sky-700 border-sky-200",
};

const BATCH_STATUS_COLORS: Record<string, string> = {
  IN_SESSION: "bg-green-50 text-green-700 border-green-200",
  PLANNED: "bg-blue-50 text-blue-700 border-blue-200",
  COMPLETED: "bg-slate-50 text-slate-600 border-slate-200",
  DRAFT: "bg-yellow-50 text-yellow-700 border-yellow-200",
  ARCHIVED: "bg-slate-50 text-slate-500 border-slate-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
};

function formatDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ExpandableBox({
  label,
  count,
  accentClass,
  iconClass,
  Icon,
  isOpen,
  isLoading,
  error,
  onToggle,
  children,
}: {
  label: string;
  count: number | null;
  accentClass: string;
  iconClass: string;
  Icon: React.ElementType;
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-2xl border", accentClass)}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:opacity-80"
      >
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4 shrink-0", iconClass)} />
          <span className="text-sm font-semibold">{label}</span>
          {count !== null && (
            <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs font-bold">{count}</span>
          )}
        </div>
        {isLoading ? (
          <span className="text-xs opacity-60">Loading…</span>
        ) : (
          <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", !isOpen && "-rotate-90")} />
        )}
      </button>

      {isOpen && !isLoading && (
        <div className="border-t border-current/10 px-4 pb-4 pt-3">
          {error ? (
            <p className="text-xs font-medium text-red-600">{error}</p>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ProgramTreeView() {
  // Programs
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [programsError, setProgramsError] = useState<string | null>(null);

  // Batches per program
  const [expandedPrograms, setExpandedPrograms] = useState<Set<string>>(new Set());
  const [programBatches, setProgramBatches] = useState<Record<string, BatchOption[]>>({});
  const [loadingBatches, setLoadingBatches] = useState<Record<string, boolean>>({});
  const [batchesError, setBatchesError] = useState<Record<string, string | null>>({});

  // Trainers box per batch (data already in BatchOption — just toggle visibility)
  const [expandedTrainers, setExpandedTrainers] = useState<Set<string>>(new Set());

  // Students per batch
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [batchStudents, setBatchStudents] = useState<Record<string, LearnerItem[]>>({});
  const [loadingStudents, setLoadingStudents] = useState<Record<string, boolean>>({});
  const [studentsError, setStudentsError] = useState<Record<string, string | null>>({});
  const [studentsCounts, setStudentsCounts] = useState<Record<string, number>>({});

  // ── Load programs on mount ──
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/programs", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load programs.");
        const payload = (await res.json()) as { data: ProgramOption[] };
        if (!cancelled) setPrograms(payload.data ?? []);
      } catch (err) {
        if (!cancelled) setProgramsError(err instanceof Error ? err.message : "Failed to load programs.");
      } finally {
        if (!cancelled) setLoadingPrograms(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Toggle program row (lazy-load batches) ──
  const toggleProgram = async (programId: string) => {
    const isExpanding = !expandedPrograms.has(programId);

    setExpandedPrograms((prev) => {
      const next = new Set(prev);
      isExpanding ? next.add(programId) : next.delete(programId);
      return next;
    });

    if (!isExpanding || programBatches[programId] !== undefined) return;

    setLoadingBatches((prev) => ({ ...prev, [programId]: true }));
    setBatchesError((prev) => ({ ...prev, [programId]: null }));

    try {
      const res = await fetch(`/api/programs/${programId}/batches`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load batches.");
      const payload = (await res.json()) as { data: BatchOption[] };
      setProgramBatches((prev) => ({ ...prev, [programId]: payload.data ?? [] }));
    } catch (err) {
      setBatchesError((prev) => ({
        ...prev,
        [programId]: err instanceof Error ? err.message : "Failed to load batches.",
      }));
    } finally {
      setLoadingBatches((prev) => ({ ...prev, [programId]: false }));
    }
  };

  // ── Toggle trainers box (no fetch — data already in BatchOption) ──
  const toggleTrainers = (batchId: string) => {
    setExpandedTrainers((prev) => {
      const next = new Set(prev);
      prev.has(batchId) ? next.delete(batchId) : next.add(batchId);
      return next;
    });
  };

  // ── Toggle students box (lazy-load learners by batchCode) ──
  const toggleStudents = async (batchCode: string) => {
    const isExpanding = !expandedStudents.has(batchCode);

    setExpandedStudents((prev) => {
      const next = new Set(prev);
      isExpanding ? next.add(batchCode) : next.delete(batchCode);
      return next;
    });

    if (!isExpanding || batchStudents[batchCode] !== undefined) return;

    setLoadingStudents((prev) => ({ ...prev, [batchCode]: true }));
    setStudentsError((prev) => ({ ...prev, [batchCode]: null }));

    try {
      const params = new URLSearchParams({
        batchCode,
        page: "1",
        pageSize: "50",
        sortBy: "fullName",
        sortDirection: "asc",
      });
      const res = await fetch(`/api/learners?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load students.");
      const payload = (await res.json()) as { data: LearnersResponse };
      setBatchStudents((prev) => ({ ...prev, [batchCode]: payload.data?.items ?? [] }));
      setStudentsCounts((prev) => ({ ...prev, [batchCode]: payload.data?.totalCount ?? 0 }));
    } catch (err) {
      setStudentsError((prev) => ({
        ...prev,
        [batchCode]: err instanceof Error ? err.message : "Failed to load students.",
      }));
    } finally {
      setLoadingStudents((prev) => ({ ...prev, [batchCode]: false }));
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loadingPrograms) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl bg-white" />
        ))}
      </div>
    );
  }

  if (programsError) {
    return (
      <div className="rounded-[32px] border border-rose-200 bg-rose-50 p-6">
        <p className="text-sm font-semibold text-rose-700">{programsError}</p>
      </div>
    );
  }

  if (programs.length === 0) {
    return (
      <div className="rounded-[32px] border border-slate-100 bg-white p-10 text-center">
        <BookOpen className="mx-auto mb-3 h-8 w-8 text-slate-300" />
        <p className="text-sm font-semibold text-slate-500">No programs found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {programs.map((program) => {
        const isExpanded = expandedPrograms.has(program.id);
        const isBatchLoading = !!loadingBatches[program.id];
        const batchError = batchesError[program.id] ?? null;
        const batches = programBatches[program.id] ?? [];

        return (
          <div key={program.id} className="overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-sm">
            {/* Program Row */}
            <button
              type="button"
              onClick={() => void toggleProgram(program.id)}
              className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50"
            >
              <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", PROGRAM_TYPE_COLORS[program.type])}>
                <GraduationCap className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-slate-900">{program.name}</span>
                  <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", PROGRAM_TYPE_COLORS[program.type])}>
                    {PROGRAM_TYPE_LABELS[program.type]}
                  </span>
                  {!program.isActive && (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                      Inactive
                    </span>
                  )}
                </div>
              </div>

              {isBatchLoading ? (
                <span className="text-xs text-slate-400">Loading…</span>
              ) : (
                <ChevronRight className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", isExpanded && "rotate-90")} />
              )}
            </button>

            {/* Batches */}
            {isExpanded && (
              <div className="border-t border-slate-100 bg-slate-50/50 px-5 pb-5 pt-4">
                {isBatchLoading && (
                  <div className="space-y-3">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <Skeleton key={i} className="h-32 w-full rounded-2xl" />
                    ))}
                  </div>
                )}

                {batchError && (
                  <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                    {batchError}
                  </p>
                )}

                {!isBatchLoading && !batchError && batches.length === 0 && (
                  <div className="flex items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center">
                    <Layers className="mx-auto h-5 w-5 text-slate-300" />
                    <p className="text-sm text-slate-400">No batches for this program.</p>
                  </div>
                )}

                {!isBatchLoading && !batchError && batches.length > 0 && (
                  <div className="space-y-4">
                    {batches.map((batch) => {
                      const trainersOpen = expandedTrainers.has(batch.id);
                      const studentsOpen = expandedStudents.has(batch.code);
                      const studentsLoading = !!loadingStudents[batch.code];
                      const studentsErr = studentsError[batch.code] ?? null;
                      const students = batchStudents[batch.code] ?? [];
                      const studentCount = studentsCounts[batch.code] ?? null;
                      const studentsLoaded = batchStudents[batch.code] !== undefined;

                      return (
                        <div key={batch.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                          {/* Batch Header */}
                          <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
                                <Layers className="h-3.5 w-3.5 text-slate-500" />
                              </div>
                              <div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-bold text-slate-900">{batch.name}</span>
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-mono font-semibold text-slate-500">
                                    {batch.code}
                                  </span>
                                  <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", BATCH_STATUS_COLORS[batch.status] ?? "bg-slate-50 text-slate-600 border-slate-200")}>
                                    {batch.status.replace("_", " ")}
                                  </span>
                                </div>
                                <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-500">
                                  {batch.campus && <span>{batch.campus}</span>}
                                  {batch.mode && <span>{batch.mode}</span>}
                                  <span>{formatDate(batch.startDate)} → {formatDate(batch.endDate)}</span>
                                  {batch.capacity !== undefined && <span>Cap: {batch.capacity}</span>}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Expandable boxes */}
                          <div className="grid gap-2 px-4 pb-4 sm:grid-cols-2">
                            {/* Trainers box */}
                            <ExpandableBox
                              label="Trainers"
                              count={batch.trainerNames.length}
                              accentClass="border-indigo-200 bg-indigo-50 text-indigo-700"
                              iconClass="text-indigo-500"
                              Icon={UserCog}
                              isOpen={trainersOpen}
                              isLoading={false}
                              error={null}
                              onToggle={() => toggleTrainers(batch.id)}
                            >
                              {batch.trainerNames.length === 0 ? (
                                <p className="text-xs text-indigo-600/70">No trainers assigned.</p>
                              ) : (
                                <ul className="space-y-1.5">
                                  {batch.trainerNames.map((name, idx) => (
                                    <li key={idx} className="flex items-center gap-2 text-sm text-indigo-800">
                                      <UserCog className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
                                      {name}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </ExpandableBox>

                            {/* Students box */}
                            <ExpandableBox
                              label="Students"
                              count={studentsLoaded ? (studentCount ?? students.length) : null}
                              accentClass="border-amber-200 bg-amber-50 text-amber-700"
                              iconClass="text-amber-500"
                              Icon={Users}
                              isOpen={studentsOpen}
                              isLoading={studentsLoading}
                              error={studentsErr}
                              onToggle={() => void toggleStudents(batch.code)}
                            >
                              {studentsLoaded && students.length === 0 ? (
                                <p className="text-xs text-amber-600/70">No students enrolled.</p>
                              ) : (
                                <ul className="max-h-48 space-y-1.5 overflow-y-auto">
                                  {students.map((learner) => (
                                    <li key={learner.id} className="flex items-center justify-between gap-2 text-sm">
                                      <span className="font-medium text-amber-900">{learner.fullName}</span>
                                      <span className="shrink-0 font-mono text-[11px] text-amber-600">{learner.learnerCode}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </ExpandableBox>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
