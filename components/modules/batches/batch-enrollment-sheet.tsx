"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Download, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import {
  EnrollmentFilterCourseOption,
  EnrollmentFilterProgramOption,
  EnrollmentSearchFilterBar,
} from "@/components/modules/batches/enrollment-search-filter-bar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type BatchEnrollmentSheetProps = {
  open: boolean;
  batch: { id: string; code: string } | null;
  onOpenChange: (open: boolean) => void;
  onDataChange?: () => void;
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

type CourseOption = EnrollmentFilterCourseOption & {
  id: string;
  name: string;
  isActive: boolean;
};

type ProgramOption = EnrollmentFilterProgramOption & {
  id: string;
  courseId: string;
  name: string;
  type: "LANGUAGE" | "CLINICAL" | "TECHNICAL";
  isActive: boolean;
};

type EnrollmentCandidate = {
  id: string;
  learnerCode: string;
  fullName: string;
  email: string;
  programName: string | null;
  courseName: string | null;
  currentBatchCode: string | null;
};

type EnrollmentCandidatesResponse = {
  items: EnrollmentCandidate[];
  totalCount: number;
};

type BulkEnrollResponse = {
  enrolled: number;
  skipped: number;
  failed: number;
};

export function BatchEnrollmentSheet({ open, batch, onOpenChange, onDataChange }: BatchEnrollmentSheetProps) {
  const [batchStudents, setBatchStudents] = useState<BatchLearner[]>([]);
  const [studentsTotal, setStudentsTotal] = useState(0);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);

  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [courseId, setCourseId] = useState("");
  const [programId, setProgramId] = useState("");
  const [search, setSearch] = useState("");

  const [candidates, setCandidates] = useState<EnrollmentCandidate[]>([]);
  const [candidateTotal, setCandidateTotal] = useState(0);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [candidateError, setCandidateError] = useState<string | null>(null);

  const [selectedLearnerCodes, setSelectedLearnerCodes] = useState<string[]>([]);
  const [activeEnrollCode, setActiveEnrollCode] = useState<string | null>(null);
  const [isBulkEnrolling, setIsBulkEnrolling] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const allVisibleSelected = useMemo(
    () => candidates.length > 0 && candidates.every((candidate) => selectedLearnerCodes.includes(candidate.learnerCode)),
    [candidates, selectedLearnerCodes],
  );

  const someVisibleSelected = useMemo(
    () => candidates.some((candidate) => selectedLearnerCodes.includes(candidate.learnerCode)),
    [candidates, selectedLearnerCodes],
  );

  const loadBatchStudents = async (batchId: string) => {
    setIsLoadingStudents(true);
    setStudentsError(null);

    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "100",
      });

      const response = await fetch(`/api/batches/${batchId}/enrollments?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { data?: LearnersResponse; error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to load enrolled candidates.");
      }

      setBatchStudents(payload?.data?.items ?? []);
      setStudentsTotal(payload?.data?.totalCount ?? 0);
    } catch (error) {
      setStudentsError(error instanceof Error ? error.message : "Failed to load enrolled candidates.");
      setBatchStudents([]);
      setStudentsTotal(0);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const loadCourses = async () => {
    try {
      const response = await fetch("/api/courses", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { data?: CourseOption[] } | null;

      if (!response.ok) {
        throw new Error("Failed to load courses.");
      }

      setCourses((payload?.data ?? []).filter((course) => course.isActive));
    } catch {
      setCourses([]);
    }
  };

  const loadPrograms = async (selectedCourseId: string) => {
    try {
      const params = new URLSearchParams();
      if (selectedCourseId) {
        params.set("courseId", selectedCourseId);
      }

      const query = params.toString();
      const response = await fetch(query.length > 0 ? `/api/programs?${query}` : "/api/programs", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { data?: ProgramOption[] } | null;

      if (!response.ok) {
        throw new Error("Failed to load programs.");
      }

      setPrograms((payload?.data ?? []).filter((program) => program.isActive));
    } catch {
      setPrograms([]);
    }
  };

  const loadCandidates = async (nextSearch: string, nextCourseId: string, nextProgramId: string) => {
    if (!batch) {
      return;
    }

    setIsLoadingCandidates(true);
    setCandidateError(null);

    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "25",
      });

      if (nextSearch.trim().length > 0) {
        params.set("search", nextSearch.trim());
      }

      if (nextCourseId.length > 0) {
        params.set("courseId", nextCourseId);
      }

      if (nextProgramId.length > 0) {
        params.set("programId", nextProgramId);
      }

      const response = await fetch(`/api/batches/${batch.id}/enrollment-candidates?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { data?: EnrollmentCandidatesResponse; error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to load candidates.");
      }

      setCandidates(payload?.data?.items ?? []);
      setCandidateTotal(payload?.data?.totalCount ?? 0);
    } catch (error) {
      setCandidateError(error instanceof Error ? error.message : "Failed to load candidates.");
      setCandidates([]);
      setCandidateTotal(0);
    } finally {
      setIsLoadingCandidates(false);
    }
  };

  const refreshLists = async () => {
    if (!batch) {
      return;
    }

    await Promise.all([
      loadBatchStudents(batch.id),
      loadCandidates(search, courseId, programId),
    ]);
  };

  useEffect(() => {
    if (!open || !batch) {
      return;
    }

    setCourseId("");
    setProgramId("");
    setSearch("");
    setSelectedLearnerCodes([]);
    setActionMessage(null);

    void Promise.all([
      loadBatchStudents(batch.id),
      loadCourses(),
      loadPrograms(""),
      loadCandidates("", "", ""),
    ]);
  }, [open, batch]);

  const handleFindCandidates = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSelectedLearnerCodes([]);
    await loadCandidates(search, courseId, programId);
  };

  const handleCourseChange = (nextCourseId: string) => {
    setCourseId(nextCourseId);
    setProgramId("");
    void loadPrograms(nextCourseId);
  };

  const toggleSelection = (learnerCode: string, shouldSelect: boolean) => {
    setSelectedLearnerCodes((prev) => {
      if (shouldSelect) {
        return prev.includes(learnerCode) ? prev : [...prev, learnerCode];
      }

      return prev.filter((code) => code !== learnerCode);
    });
  };

  const toggleSelectAllVisible = (checked: boolean) => {
    if (checked) {
      const visibleCodes = candidates.map((candidate) => candidate.learnerCode);
      setSelectedLearnerCodes((prev) => Array.from(new Set([...prev, ...visibleCodes])));
      return;
    }

    setSelectedLearnerCodes((prev) => prev.filter((code) => !candidates.some((candidate) => candidate.learnerCode === code)));
  };

  const enrollSingle = async (learnerCode: string) => {
    if (!batch) {
      return;
    }

    setActiveEnrollCode(learnerCode);
    setActionMessage(null);

    try {
      const response = await fetch(`/api/batches/${batch.id}/enrollments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ learnerCode }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to enroll candidate.");
      }

      setActionMessage(`${learnerCode} enrolled successfully.`);
      toast.success(`${learnerCode} enrolled successfully.`);
      setSelectedLearnerCodes((prev) => prev.filter((code) => code !== learnerCode));
      await refreshLists();
      onDataChange?.();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Failed to enroll candidate.");
      toast.error(error instanceof Error ? error.message : "Failed to enroll candidate.");
    } finally {
      setActiveEnrollCode(null);
    }
  };

  const enrollBulk = async () => {
    if (!batch || selectedLearnerCodes.length === 0) {
      return;
    }

    setIsBulkEnrolling(true);
    setActionMessage(null);

    try {
      const response = await fetch(`/api/batches/${batch.id}/enrollments/bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ learnerCodes: selectedLearnerCodes }),
      });

      const payload = (await response.json().catch(() => null)) as { data?: BulkEnrollResponse; error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Bulk enrollment failed.");
      }

      const result = payload?.data;
      setActionMessage(
        result
          ? `Bulk enrollment complete. Enrolled: ${result.enrolled}, skipped: ${result.skipped}, failed: ${result.failed}.`
          : "Bulk enrollment complete.",
      );
      toast.success(result ? `Bulk enrollment: ${result.enrolled} enrolled, ${result.skipped} skipped.` : "Bulk enrollment complete.");
      setSelectedLearnerCodes([]);
      await refreshLists();
      onDataChange?.();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Bulk enrollment failed.");
      toast.error(error instanceof Error ? error.message : "Bulk enrollment failed.");
    } finally {
      setIsBulkEnrolling(false);
    }
  };

  const exportCsv = async () => {
    if (!batch) {
      return;
    }

    setIsExporting(true);
    setActionMessage(null);

    try {
      const response = await fetch(`/api/batches/${batch.id}/export`, { cache: "no-store" });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to export CSV.");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition");
      const match = disposition?.match(/filename=\"?([^\";]+)\"?/i);
      const filename = match?.[1] ?? `${batch.code.toLowerCase()}-enrollments.csv`;
      const objectUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Failed to export CSV.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-full flex-col overflow-hidden sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>Batch Enrollment</SheetTitle>
          <SheetDescription>{batch ? `Manage enrollments for batch ${batch.code}` : "Manage enrollments"}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Enrolled Students</p>
              <Button type="button" variant="secondary" size="sm" onClick={exportCsv} disabled={isExporting || !batch}>
                <Download className="mr-1 h-4 w-4" />
                {isExporting ? "Exporting..." : "Export CSV"}
              </Button>
            </div>

            {isLoadingStudents ? <p className="text-sm text-slate-500">Loading enrolled candidates...</p> : null}
            {studentsError ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{studentsError}</p> : null}

            {!isLoadingStudents && !studentsError ? (
              <>
                <p className="text-sm font-semibold text-slate-700">Total enrolled: {studentsTotal}</p>
                {batchStudents.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {batchStudents.map((learner) => (
                      <div key={learner.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <p className="text-sm font-semibold text-slate-900">{learner.fullName}</p>
                        <p className="text-xs text-slate-500">{learner.learnerCode}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No candidates enrolled in this batch.</p>
                )}
              </>
            ) : null}
          </section>

          <EnrollmentSearchFilterBar
            search={search}
            courseId={courseId}
            programId={programId}
            courses={courses}
            programs={programs}
            matchCount={candidateTotal}
            onSearchChange={setSearch}
            onCourseChange={handleCourseChange}
            onProgramChange={setProgramId}
            onSubmit={handleFindCandidates}
          />

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                  onCheckedChange={(checked) => toggleSelectAllVisible(checked === true)}
                  aria-label="Select all visible candidates"
                />
                <span className="text-sm font-medium text-slate-700">Select visible</span>
              </div>
              <Button
                type="button"
                onClick={enrollBulk}
                disabled={selectedLearnerCodes.length === 0 || isBulkEnrolling || !batch}
              >
                <Users className="mr-1 h-4 w-4" />
                {isBulkEnrolling ? "Enrolling..." : `Enroll Selected (${selectedLearnerCodes.length})`}
              </Button>
            </div>

            {candidateError ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{candidateError}</p> : null}
            {actionMessage ? <p className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700">{actionMessage}</p> : null}

            {isLoadingCandidates ? <p className="text-sm text-slate-500">Loading candidates...</p> : null}

            {!isLoadingCandidates && candidates.length === 0 ? <p className="text-sm text-slate-500">No candidates matched the current filters.</p> : null}

            {!isLoadingCandidates && candidates.length > 0 ? (
              <div className="space-y-2">
                {candidates.map((candidate) => {
                  const isSelected = selectedLearnerCodes.includes(candidate.learnerCode);
                  const isEnrolling = activeEnrollCode === candidate.learnerCode;

                  return (
                    <div key={candidate.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => toggleSelection(candidate.learnerCode, checked === true)}
                          aria-label={`Select ${candidate.learnerCode}`}
                        />
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{candidate.fullName}</p>
                          <p className="text-xs text-slate-500">{candidate.learnerCode} • {candidate.email}</p>
                          <p className="text-xs text-slate-500">
                            {candidate.courseName ?? "No course"} / {candidate.programName ?? "No program"}
                            {candidate.currentBatchCode ? ` • Current batch ${candidate.currentBatchCode}` : ""}
                          </p>
                        </div>
                      </div>
                      <Button type="button" size="sm" variant="secondary" onClick={() => void enrollSingle(candidate.learnerCode)} disabled={isEnrolling || !batch}>
                        <UserPlus className="mr-1 h-4 w-4" />
                        {isEnrolling ? "Enrolling..." : "Enroll"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </section>
        </div>

        <SheetFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
