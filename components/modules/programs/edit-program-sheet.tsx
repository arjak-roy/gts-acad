"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/ui/can-access";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SheetLoadingSkeleton } from "@/components/ui/sheet-skeleton-variants";

type ProgramTypeValue = "LANGUAGE" | "CLINICAL" | "TECHNICAL";

type BatchSummary = {
  id: string;
  code: string;
  name: string;
  programName: string;
  status: "DRAFT" | "PLANNED" | "IN_SESSION" | "COMPLETED" | "ARCHIVED" | "CANCELLED";
};

type ProgramDetail = {
  id: string;
  courseId: string;
  courseName: string;
  name: string;
  type: ProgramTypeValue;
  durationWeeks: number;
  category: string | null;
  description: string | null;
  isActive: boolean;
};

type EditProgramForm = {
  courseId: string;
  name: string;
  type: ProgramTypeValue;
  durationWeeks: string;
  category: string;
  description: string;
  isActive: boolean;
  batchIds: string[];
};

const emptyForm: EditProgramForm = {
  courseId: "",
  name: "",
  type: "LANGUAGE",
  durationWeeks: "",
  category: "",
  description: "",
  isActive: true,
  batchIds: [],
};

type EditProgramSheetProps = {
  programId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type CourseOption = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  programCount: number;
};

export function EditProgramSheet({ programId, open, onOpenChange }: EditProgramSheetProps) {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "confirm" | "updated">("form");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [batchSearchTerm, setBatchSearchTerm] = useState("");
  const [form, setForm] = useState<EditProgramForm>(emptyForm);

  useEffect(() => {
    if (!open || !programId) {
      return;
    }

    let active = true;

    const loadProgram = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [programResponse, coursesResponse, batchesResponse] = await Promise.all([
          fetch(`/api/programs/${programId}`, { cache: "no-store" }),
          fetch("/api/courses", { cache: "no-store" }),
          fetch("/api/batches", { cache: "no-store" }),
        ]);

        if (!programResponse.ok || !coursesResponse.ok || !batchesResponse.ok) {
          throw new Error("Failed to load program details.");
        }

        const payload = (await programResponse.json()) as { data?: ProgramDetail };
        const coursesPayload = (await coursesResponse.json()) as { data?: CourseOption[] };
        const batchesPayload = (await batchesResponse.json()) as { data?: BatchSummary[] };

        if (!active || !payload.data) {
          return;
        }

        const availableBatches = (batchesPayload.data ?? []).filter((batch) => batch.status !== "ARCHIVED");
        const availableCourses = (coursesPayload.data ?? []).filter((course) => course.isActive);
        const selectedBatchIds: string[] = [];

        setCourses(availableCourses);
        setBatches(availableBatches);

        setForm({
          courseId: payload.data.courseId,
          name: payload.data.name,
          type: payload.data.type,
          durationWeeks: String(payload.data.durationWeeks),
          category: payload.data.category ?? "",
          description: payload.data.description ?? "",
          isActive: payload.data.isActive,
          batchIds: selectedBatchIds,
        });
      } catch (loadError) {
        if (!active) {
          return;
        }

        const message = loadError instanceof Error ? loadError.message : "Failed to load program details.";
        setError(message);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadProgram();

    return () => {
      active = false;
    };
  }, [open, programId]);

  const filteredBatchResults = useMemo(() => {
    if (!batchSearchTerm.trim()) {
      return [];
    }

    const term = batchSearchTerm.toLowerCase();
    return batches.filter(
      (batch) =>
        !form.batchIds.includes(batch.id) &&
        (batch.code.toLowerCase().includes(term) ||
          batch.name.toLowerCase().includes(term) ||
          batch.programName.toLowerCase().includes(term)),
    );
  }, [batchSearchTerm, batches, form.batchIds]);

  const selectedBatchNames = useMemo(
    () => batches.filter((batch) => form.batchIds.includes(batch.id)).map((batch) => `${batch.code} - ${batch.name}`),
    [batches, form.batchIds],
  );

  const toggleBatch = (batchId: string) => {
    setForm((prev) => ({
      ...prev,
      batchIds: prev.batchIds.includes(batchId)
        ? prev.batchIds.filter((id) => id !== batchId)
        : [...prev.batchIds, batchId],
    }));
  };

  const handleDone = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const duration = Number(form.durationWeeks);
    if (!form.courseId || !form.name.trim() || !form.type || !Number.isFinite(duration) || duration < 1) {
      setError("Please complete Course, Program Name, Type, and a valid Duration before continuing.");
      return;
    }

    setError(null);
    setStep("confirm");
  };

  const handleUpdate = async () => {
    if (!programId) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/programs/${programId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          courseId: form.courseId,
          name: form.name,
          type: form.type,
          durationWeeks: Number(form.durationWeeks),
          category: form.category,
          description: form.description,
          isActive: form.isActive,
          batchIds: form.batchIds,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update program.");
      }

      setStep("updated");
      router.refresh();
      toast.success("Program updated successfully.");
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "Failed to update program.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async () => {
    if (!programId) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/programs/${programId}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to archive program.");
      }

      onOpenChange(false);
      router.refresh();
      toast.success("Program archived successfully.");
    } catch (archiveError) {
      const message = archiveError instanceof Error ? archiveError.message : "Failed to archive program.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const reset = () => {
    setStep("form");
    setError(null);
    setForm(emptyForm);
    setBatchSearchTerm("");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      reset();
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit Program</SheetTitle>
          <SheetDescription>Update program details or archive this program.</SheetDescription>
        </SheetHeader>

        {step === "form" ? (
          <form className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto overflow-x-hidden p-6" onSubmit={handleDone}>
            {isLoading ? (
              <SheetLoadingSkeleton isLoading={true} variant="form" />
            ) : (
              <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Course</label>
                <select
                  className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700"
                  value={form.courseId}
                  onChange={(event) => setForm((prev) => ({ ...prev, courseId: event.target.value }))}
                >
                  <option value="">Select a course</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Program Name</label>
                <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Program Type</label>
                <select
                  className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700"
                  value={form.type}
                  onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as ProgramTypeValue }))}
                >
                  <option value="LANGUAGE">Language</option>
                  <option value="CLINICAL">Clinical</option>
                  <option value="TECHNICAL">Technical</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Duration (Weeks)</label>
                <Input
                  type="number"
                  min={1}
                  value={form.durationWeeks}
                  onChange={(event) => setForm((prev) => ({ ...prev, durationWeeks: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Category</label>
                <Input value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Description</label>
              <textarea
                className="min-h-28 w-full rounded-xl border border-[#dde1e6] px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d3b84]"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Add Batches To Program</label>
                <span className="text-xs font-medium text-slate-500">{form.batchIds.length} selected</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <Input
                  type="text"
                  placeholder="Search batches by code, name, program to add"
                  value={batchSearchTerm}
                  onChange={(event) => setBatchSearchTerm(event.target.value)}
                  className="mb-3"
                />
                {batchSearchTerm.trim() && filteredBatchResults.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {filteredBatchResults.map((batch) => (
                      <button
                        key={batch.id}
                        type="button"
                        onClick={() => toggleBatch(batch.id)}
                        className="rounded-2xl border border-amber-300 bg-amber-50 px-3 py-3 text-left transition hover:bg-amber-100"
                      >
                        <p className="text-sm font-semibold text-amber-900">{batch.code}</p>
                        <p className="mt-1 text-xs text-amber-700">{batch.name}</p>
                        <p className="mt-1 text-xs text-amber-600">Current program: {batch.programName}</p>
                      </button>
                    ))}
                  </div>
                ) : null}
                {batchSearchTerm.trim() && filteredBatchResults.length === 0 ? (
                  <p className="text-sm text-slate-500">No batches found.</p>
                ) : null}
                {form.batchIds.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {batches
                      .filter((batch) => form.batchIds.includes(batch.id))
                      .map((batch) => (
                        <button
                          key={batch.id}
                          type="button"
                          onClick={() => toggleBatch(batch.id)}
                          className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
                        >
                          {batch.code} ×
                        </button>
                      ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="program-active"
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
              />
              <label htmlFor="program-active" className="text-sm text-slate-600">Program is active</label>
            </div>
              </>
            )}

            {!isLoading ? (
              <>
                {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p> : null}
                <SheetFooter className="p-0 pt-2 sm:justify-end sm:border-0">
                  <CanAccess permission="programs.delete">
                    <Button variant="ghost" type="button" className="text-rose-600" onClick={handleArchive} disabled={isSubmitting}>
                      Archive
                    </Button>
                  </CanAccess>
                  <Button variant="secondary" type="button" onClick={() => handleOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Done</Button>
                </SheetFooter>
              </>
            ) : null}
          </form>
        ) : null}

        {step === "confirm" ? (
          <div className="h-full overflow-y-auto p-6">
            <div className="space-y-4">
            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent className="space-y-2 p-4">
                <p className="text-sm font-bold text-emerald-800">Confirmation</p>
                <p className="text-sm text-emerald-700">Details captured. Click Update Program to save changes.</p>
                <p className="text-sm text-emerald-700">Batches to add: {form.batchIds.length}</p>
              </CardContent>
            </Card>

            <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p>
                <span className="font-semibold text-slate-900">Course:</span> {courses.find((course) => course.id === form.courseId)?.name ?? "N/A"}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Batches:</span> {selectedBatchNames.length > 0 ? selectedBatchNames.join(", ") : "Unassigned"}
              </p>
            </div>

            {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p> : null}

            <SheetFooter className="p-0 pt-2 sm:justify-end sm:border-0">
              <Button variant="secondary" type="button" onClick={() => setStep("form")} disabled={isSubmitting}>
                Back
              </Button>
              <Button type="button" onClick={handleUpdate} disabled={isSubmitting}>
                {isSubmitting ? "Updating..." : "Update Program"}
              </Button>
            </SheetFooter>
            </div>
          </div>
        ) : null}

        {step === "updated" ? (
          <div className="h-full overflow-y-auto p-6">
            <div className="space-y-4">
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="space-y-2 p-4">
                <p className="text-sm font-bold text-blue-800">Program Updated</p>
                <p className="text-sm text-blue-700">{form.name.trim()} has been updated successfully.</p>
              </CardContent>
            </Card>

            <SheetFooter className="p-0 pt-2 sm:justify-end sm:border-0">
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            </SheetFooter>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
