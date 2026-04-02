"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SheetLoadingSkeleton } from "@/components/ui/sheet-skeleton-variants";

type CourseProgramSummary = {
  id: string;
  name: string;
  type: "LANGUAGE" | "CLINICAL" | "TECHNICAL";
  isActive: boolean;
};

type CourseDetail = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  programs: CourseProgramSummary[];
};

type EditCourseForm = {
  name: string;
  description: string;
  isActive: boolean;
};

const emptyForm: EditCourseForm = {
  name: "",
  description: "",
  isActive: true,
};

type EditCourseSheetProps = {
  courseId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditCourseSheet({ courseId, open, onOpenChange }: EditCourseSheetProps) {
  const router = useRouter();
  const [form, setForm] = useState<EditCourseForm>(emptyForm);
  const [programs, setPrograms] = useState<CourseProgramSummary[]>([]);
  const [step, setStep] = useState<"form" | "confirm" | "updated">("form");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !courseId) {
      return;
    }

    let active = true;

    const loadCourse = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/courses/${courseId}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to load course details.");
        }

        const payload = (await response.json()) as { data?: CourseDetail };
        if (!active || !payload.data) {
          return;
        }

        setForm({
          name: payload.data.name,
          description: payload.data.description ?? "",
          isActive: payload.data.isActive,
        });
        setPrograms(payload.data.programs);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load course details.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadCourse();

    return () => {
      active = false;
    };
  }, [courseId, open]);

  const reset = () => {
    setForm(emptyForm);
    setPrograms([]);
    setStep("form");
    setError(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      reset();
    }
  };

  const handleDone = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Please enter a course name before continuing.");
      return;
    }

    setError(null);
    setStep("confirm");
  };

  const handleUpdate = async () => {
    if (!courseId) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/courses/${courseId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update course.");
      }

      setStep("updated");
      router.refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update course.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async () => {
    if (!courseId) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/courses/${courseId}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to archive course.");
      }

      onOpenChange(false);
      router.refresh();
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Failed to archive course.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit Course</SheetTitle>
          <SheetDescription>Update the course details or archive this course.</SheetDescription>
        </SheetHeader>

        {step === "form" ? (
          <form className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto overflow-x-hidden p-6" onSubmit={handleDone}>
            {isLoading ? (
              <SheetLoadingSkeleton isLoading={true} variant="form" />
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Course Name</label>
                  <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Description</label>
                  <textarea
                    className="min-h-28 w-full rounded-xl border border-[#dde1e6] px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d3b84]"
                    value={form.description}
                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="course-active"
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                  />
                  <label htmlFor="course-active" className="text-sm text-slate-600">Course is active</label>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Mapped Programs</p>
                  {programs.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {programs.map((program) => (
                        <span key={program.id} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                          {program.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">No programs are currently mapped to this course.</p>
                  )}
                </div>
              </>
            )}

            {!isLoading ? (
              <>
                {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p> : null}
                <SheetFooter className="p-0 pt-2 sm:justify-end sm:border-0">
                  <Button variant="ghost" type="button" className="text-rose-600" onClick={handleArchive} disabled={isSubmitting}>
                    Archive
                  </Button>
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
          <div className="space-y-4 p-6">
            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent className="space-y-2 p-4">
                <p className="text-sm font-bold text-emerald-800">Confirmation</p>
                <p className="text-sm text-emerald-700">Click Update Course to save these changes.</p>
              </CardContent>
            </Card>
            <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p>
                <span className="font-semibold text-slate-900">Course:</span> {form.name.trim()}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Description:</span> {form.description.trim() || "N/A"}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Programs:</span> {programs.length}
              </p>
            </div>
            {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p> : null}
            <SheetFooter className="p-0 pt-2 sm:justify-end sm:border-0">
              <Button variant="secondary" type="button" onClick={() => setStep("form")} disabled={isSubmitting}>
                Back
              </Button>
              <Button type="button" onClick={handleUpdate} disabled={isSubmitting}>
                {isSubmitting ? "Updating..." : "Update Course"}
              </Button>
            </SheetFooter>
          </div>
        ) : null}

        {step === "updated" ? (
          <div className="space-y-4 p-6">
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="space-y-2 p-4">
                <p className="text-sm font-bold text-blue-800">Course Updated</p>
                <p className="text-sm text-blue-700">{form.name.trim()} has been updated successfully.</p>
              </CardContent>
            </Card>
            <SheetFooter className="p-0 pt-2 sm:justify-end sm:border-0">
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            </SheetFooter>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}