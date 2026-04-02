"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useDebounce } from "@/hooks/use-debounce";
import { cn, formatGeneratedCode } from "@/lib/utils";

type ProgramOption = {
  id: string;
  courseId: string;
  courseName: string;
  name: string;
  type: "LANGUAGE" | "CLINICAL" | "TECHNICAL";
  isActive: boolean;
};

type AddCourseForm = {
  code: string;
  name: string;
  description: string;
  programIds: string[];
};

const initialForm: AddCourseForm = {
  code: "",
  name: "",
  description: "",
  programIds: [],
};

export function AddCourseSheet() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "confirm" | "created">("form");
  const [form, setForm] = useState<AddCourseForm>(initialForm);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [programSearchTerm, setProgramSearchTerm] = useState("");
  const [isLoadingPrograms, setIsLoadingPrograms] = useState(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debouncedCourseName = useDebounce(form.name, 300);

  useEffect(() => {
    if (!open) {
      return;
    }

    const normalizedName = debouncedCourseName.trim();
    if (!normalizedName) {
      setIsGeneratingCode(false);
      setForm((prev) => (prev.code ? { ...prev, code: "" } : prev));
      return;
    }

    let active = true;

    const generateCode = async () => {
      setIsGeneratingCode(true);

      try {
        const response = await fetch("/api/courses/generate-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseName: normalizedName }),
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to generate course code.");
        }

        const result = (await response.json()) as { data: { code: string } };
        if (active) {
          setForm((prev) => ({ ...prev, code: result.data.code }));
        }
      } catch (generateError) {
        console.warn("Course code generation failed, using client fallback:", generateError);
        if (active) {
          setForm((prev) => ({ ...prev, code: formatGeneratedCode("C", normalizedName, 1) }));
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
  }, [debouncedCourseName, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;

    const loadPrograms = async () => {
      setIsLoadingPrograms(true);

      try {
        const response = await fetch("/api/programs", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to load programs.");
        }

        const payload = (await response.json()) as { data?: ProgramOption[] };
        if (!active) {
          return;
        }

        setPrograms((payload.data ?? []).filter((program) => program.isActive));
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Failed to load programs.");
      } finally {
        if (active) {
          setIsLoadingPrograms(false);
        }
      }
    };

    void loadPrograms();

    return () => {
      active = false;
    };
  }, [open]);

  const filteredPrograms = useMemo(() => {
    if (!programSearchTerm.trim()) {
      return [];
    }

    const term = programSearchTerm.toLowerCase();
    return programs.filter(
      (program) =>
        !form.programIds.includes(program.id) &&
        (program.name.toLowerCase().includes(term) ||
          program.type.toLowerCase().includes(term) ||
          program.courseName.toLowerCase().includes(term)),
    );
  }, [form.programIds, programSearchTerm, programs]);

  const selectedProgramNames = useMemo(
    () => programs.filter((program) => form.programIds.includes(program.id)).map((program) => program.name),
    [form.programIds, programs],
  );

  const toggleProgram = (programId: string) => {
    setForm((prev) => ({
      ...prev,
      programIds: prev.programIds.includes(programId)
        ? prev.programIds.filter((id) => id !== programId)
        : [...prev.programIds, programId],
    }));
  };

  const resetFlow = () => {
    setStep("form");
    setForm(initialForm);
    setProgramSearchTerm("");
    setError(null);
  };

  const onOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetFlow();
    }
  };

  const handleDone = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Please enter a course name before continuing.");
      return;
    }

    if (isGeneratingCode || !form.code.trim()) {
      setError("Please wait while the course code is generated.");
      return;
    }

    setError(null);
    setStep("confirm");
  };

  const handleCreate = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/courses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: form.code,
          name: form.name,
          description: form.description,
          isActive: true,
          programIds: form.programIds,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Failed to create course.");
      }

      setStep("created");
      router.refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create course.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button>Add Course</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Add Course</SheetTitle>
          <SheetDescription>Create a top-level course and optionally map existing programs into it.</SheetDescription>
        </SheetHeader>

        {step === "form" ? (
          <form className="space-y-4 p-6" onSubmit={handleDone}>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Course Code</label>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                {!form.name.trim() ? (
                  <p className="text-sm text-slate-400">Enter a course name to generate code</p>
                ) : isGeneratingCode ? (
                  <p className="text-sm text-slate-500">Generating code...</p>
                ) : (
                  <p className="text-sm font-semibold text-slate-700">{form.code}</p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Course Name</label>
              <Input value={form.name} placeholder="Clinical Career Track" onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Description</label>
              <textarea
                className="min-h-28 w-full rounded-xl border border-[#dde1e6] px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d3b84]"
                placeholder="What this course covers and why it exists"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Map Programs</label>
                <span className="text-xs font-medium text-slate-500">{form.programIds.length} selected</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <Input
                  type="text"
                  placeholder="Search programs by name, type, or current course"
                  value={programSearchTerm}
                  onChange={(event) => setProgramSearchTerm(event.target.value)}
                  className="mb-3"
                />
                {isLoadingPrograms ? <p className="text-sm text-slate-500">Loading programs...</p> : null}
                {!isLoadingPrograms && programSearchTerm.trim() && filteredPrograms.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {filteredPrograms.map((program) => (
                      <button
                        key={program.id}
                        type="button"
                        onClick={() => toggleProgram(program.id)}
                        className="rounded-2xl border border-emerald-300 bg-emerald-50 px-3 py-3 text-left transition hover:bg-emerald-100"
                      >
                        <p className="text-sm font-semibold text-emerald-900">{program.name}</p>
                        <p className="mt-1 text-xs text-emerald-700">{program.type}</p>
                        <p className="mt-1 text-xs text-emerald-600">Current course: {program.courseName}</p>
                      </button>
                    ))}
                  </div>
                ) : null}
                {!isLoadingPrograms && programSearchTerm.trim() && filteredPrograms.length === 0 ? <p className="text-sm text-slate-500">No programs found.</p> : null}
                {form.programIds.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {programs
                      .filter((program) => form.programIds.includes(program.id))
                      .map((program) => (
                        <button
                          key={program.id}
                          type="button"
                          onClick={() => toggleProgram(program.id)}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-semibold transition",
                            "border-slate-300 bg-white text-slate-700 hover:border-slate-400",
                          )}
                        >
                          {program.name} ×
                        </button>
                      ))}
                  </div>
                ) : null}
              </div>
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
                <p className="text-sm text-emerald-700">Course details are ready. Click Create Course to finish.</p>
              </CardContent>
            </Card>

            <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p>
                <span className="font-semibold text-slate-900">Code:</span> {form.code.trim().toUpperCase()}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Course:</span> {form.name.trim()}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Description:</span> {form.description.trim() || "N/A"}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Programs:</span> {selectedProgramNames.length > 0 ? selectedProgramNames.join(", ") : "None selected"}
              </p>
            </div>

            {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p> : null}

            <SheetFooter className="p-0 pt-2 sm:justify-end sm:border-0">
              <Button variant="secondary" type="button" onClick={() => setStep("form")} disabled={isSubmitting}>
                Back
              </Button>
              <Button type="button" onClick={handleCreate} disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Course"}
              </Button>
            </SheetFooter>
          </div>
        ) : null}

        {step === "created" ? (
          <div className="space-y-4 p-6">
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="space-y-2 p-4">
                <p className="text-sm font-bold text-blue-800">Course Created</p>
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