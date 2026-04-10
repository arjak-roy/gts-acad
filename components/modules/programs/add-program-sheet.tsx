"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useDebounce } from "@/hooks/use-debounce";
import { cn, formatGeneratedCode } from "@/lib/utils";

type ProgramTypeValue = "LANGUAGE" | "CLINICAL" | "TECHNICAL";

type AddProgramForm = {
  code: string;
  courseId: string;
  name: string;
  type: ProgramTypeValue;
  durationWeeks: string;
  category: string;
  description: string;
  batchIds: string[];
};

type CourseOption = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  programCount: number;
};

type ProgramBatchOption = {
  id: string;
  code: string;
  name: string;
  programName: string;
  status: "DRAFT" | "PLANNED" | "IN_SESSION" | "COMPLETED" | "ARCHIVED" | "CANCELLED";
};

const initialForm: AddProgramForm = {
  code: "",
  courseId: "",
  name: "",
  type: "LANGUAGE",
  durationWeeks: "",
  category: "",
  description: "",
  batchIds: [],
};

export function AddProgramSheet() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "confirm" | "created">("form");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [batches, setBatches] = useState<ProgramBatchOption[]>([]);
  const [batchSearchTerm, setBatchSearchTerm] = useState("");
  const [form, setForm] = useState<AddProgramForm>(initialForm);
  const debouncedProgramName = useDebounce(form.name, 300);

  useEffect(() => {
    if (!open) {
      return;
    }

    const normalizedName = debouncedProgramName.trim();
    if (!normalizedName) {
      setIsGeneratingCode(false);
      setForm((prev) => (prev.code ? { ...prev, code: "" } : prev));
      return;
    }

    let active = true;

    const generateCode = async () => {
      setIsGeneratingCode(true);

      try {
        const response = await fetch("/api/programs/generate-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ programName: normalizedName }),
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to generate program code.");
        }

        const result = (await response.json()) as { data: { code: string } };
        if (active) {
          setForm((prev) => ({ ...prev, code: result.data.code }));
        }
      } catch (generateError) {
        console.warn("Program code generation failed, using client fallback:", generateError);
        if (active) {
          setForm((prev) => ({ ...prev, code: formatGeneratedCode("P", normalizedName, 1) }));
        }
      } finally {
        if (active) {
          setIsGeneratingCode(false);
        }
      }
    };

    void generateCode();

    return () => {
      active = false;
    };
  }, [debouncedProgramName, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;

    const loadOptions = async () => {
      setIsLoadingOptions(true);

      try {
        const [coursesResponse, batchesResponse] = await Promise.all([
          fetch("/api/courses", { cache: "no-store" }),
          fetch("/api/batches", { cache: "no-store" }),
        ]);

        if (!coursesResponse.ok || !batchesResponse.ok) {
          throw new Error("Failed to load course and batch options.");
        }

        const coursesPayload = (await coursesResponse.json()) as { data?: CourseOption[] };
        const batchesPayload = (await batchesResponse.json()) as { data?: ProgramBatchOption[] };

        if (!active) {
          return;
        }

        setCourses((coursesPayload.data ?? []).filter((course) => course.isActive));
        setBatches((batchesPayload.data ?? []).filter((batch) => batch.status !== "ARCHIVED"));
      } catch (loadError) {
        if (!active) {
          return;
        }

        const message = loadError instanceof Error ? loadError.message : "Failed to load course and batch options.";
        setError(message);
      } finally {
        if (active) {
          setIsLoadingOptions(false);
        }
      }
    };

    void loadOptions();

    return () => {
      active = false;
    };
  }, [open]);

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

  const resetFlow = () => {
    setStep("form");
    setError(null);
    setForm(initialForm);
    setBatchSearchTerm("");
  };

  const onOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetFlow();
    }
  };

  const handleDone = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const duration = Number(form.durationWeeks);

    if (!form.courseId || !form.name.trim() || !form.type || !Number.isFinite(duration) || duration < 1) {
      setError("Please complete Course, Program Name, Type, and a valid Duration before continuing.");
      return;
    }

    if (isGeneratingCode || !form.code.trim()) {
      setError("Please wait while the program code is generated.");
      return;
    }

    setError(null);
    setStep("confirm");
  };

  const toggleBatch = (batchId: string) => {
    setForm((prev) => ({
      ...prev,
      batchIds: prev.batchIds.includes(batchId)
        ? prev.batchIds.filter((id) => id !== batchId)
        : [...prev.batchIds, batchId],
    }));
  };

  const handleCreate = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/programs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: form.code,
          courseId: form.courseId,
          name: form.name,
          type: form.type,
          durationWeeks: Number(form.durationWeeks),
          category: form.category,
          description: form.description,
          isActive: true,
          batchIds: form.batchIds,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Failed to create program.");
      }

      setStep("created");
      router.refresh();
      toast.success("Program created successfully.");
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Failed to create program.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button>Add Program</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Add Program</SheetTitle>
          <SheetDescription>Add program details, click Done to confirm, then create the program.</SheetDescription>
        </SheetHeader>

        {step === "form" ? (
          <form className="space-y-4 p-6" onSubmit={handleDone}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Program Code</label>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  {!form.name.trim() ? (
                    <p className="text-sm text-slate-400">Enter a program name to generate code</p>
                  ) : isGeneratingCode ? (
                    <p className="text-sm text-slate-500">Generating code...</p>
                  ) : (
                    <p className="text-sm font-semibold text-slate-700">{form.code}</p>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Course</label>
                <select
                  className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700"
                  value={form.courseId}
                  onChange={(event) => setForm((prev) => ({ ...prev, courseId: event.target.value }))}
                >
                  <option value="">{isLoadingOptions ? "Loading courses..." : courses.length === 0 ? "No courses available" : "Select a course"}</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Program Name</label>
                <Input
                  placeholder="German Language B2"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                />
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
                  placeholder="24"
                  value={form.durationWeeks}
                  onChange={(event) => setForm((prev) => ({ ...prev, durationWeeks: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Category</label>
                <Input
                  placeholder="Nursing"
                  value={form.category}
                  onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Assign Batches</label>
                  <span className="text-xs font-medium text-slate-500">{form.batchIds.length} selected</span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <Input
                    type="text"
                    placeholder="Search batches by code, name, program"
                    value={batchSearchTerm}
                    onChange={(event) => setBatchSearchTerm(event.target.value)}
                    className="mb-3"
                  />
                  {isLoadingOptions ? <p className="text-sm text-slate-500">Loading batches...</p> : null}
                  {!isLoadingOptions && batchSearchTerm.trim() && filteredBatchResults.length > 0 ? (
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
                  {!isLoadingOptions && batchSearchTerm.trim() && filteredBatchResults.length === 0 ? (
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
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Description</label>
              <textarea
                className="min-h-28 w-full rounded-xl border border-[#dde1e6] px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d3b84]"
                placeholder="Program overview and outcomes"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>

            {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p> : null}

            <SheetFooter className="p-0 pt-2 sm:justify-end sm:border-0">
              <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Done</Button>
            </SheetFooter>
          </form>
        ) : null}

        {step === "confirm" ? (
          <div className="space-y-4 p-6">
            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent className="space-y-2 p-4">
                <p className="text-sm font-bold text-emerald-800">Confirmation</p>
                <p className="text-sm text-emerald-700">Details captured. Click Create Program to finish setup.</p>
              </CardContent>
            </Card>

            <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p>
                <span className="font-semibold text-slate-900">Code:</span> {form.code.trim().toUpperCase()}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Course:</span> {courses.find((course) => course.id === form.courseId)?.name ?? "N/A"}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Program:</span> {form.name.trim()}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Type:</span> {form.type}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Duration:</span> {Number(form.durationWeeks)} weeks
              </p>
              <p>
                <span className="font-semibold text-slate-900">Category:</span> {form.category.trim() || "N/A"}
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
              <Button type="button" onClick={handleCreate} disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Program"}
              </Button>
            </SheetFooter>
          </div>
        ) : null}

        {step === "created" ? (
          <div className="space-y-4 p-6">
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="space-y-2 p-4">
                <p className="text-sm font-bold text-blue-800">Program Created</p>
                <p className="text-sm text-blue-700">{form.code.trim().toUpperCase()} · {form.name.trim()} has been added successfully.</p>
              </CardContent>
            </Card>

            <SheetFooter className="p-0 pt-2 sm:justify-end sm:border-0">
              <Button type="button" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </SheetFooter>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
