"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SheetLoadingSkeleton } from "@/components/ui/sheet-skeleton-variants";
import { buildTrainerCourseSelections, type TrainerCourseOption } from "@/components/modules/trainers/course-selection";
import type { TrainerDetail } from "@/services/trainers/types";
import { cn } from "@/lib/utils";

type CourseOption = {
  id: string;
  name: string;
  isActive: boolean;
};

type AssignTrainerCoursesSheetProps = {
  trainerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
};

export function AssignTrainerCoursesSheet({ trainerId, open, onOpenChange, onUpdated }: AssignTrainerCoursesSheetProps) {
  const [trainer, setTrainer] = useState<TrainerDetail | null>(null);
  const [courses, setCourses] = useState<TrainerCourseOption[]>([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !trainerId) {
      return;
    }

    let active = true;

    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [trainerResponse, coursesResponse] = await Promise.all([
          fetch(`/api/trainers/${trainerId}`, { cache: "no-store" }),
          fetch("/api/courses", { cache: "no-store" }),
        ]);

        if (!trainerResponse.ok || !coursesResponse.ok) {
          throw new Error("Failed to load trainer courses.");
        }

        const trainerPayload = (await trainerResponse.json()) as { data?: TrainerDetail };
        const coursesPayload = (await coursesResponse.json()) as { data?: CourseOption[] };

        if (!active || !trainerPayload.data) {
          return;
        }

        const { options, selectedValues } = buildTrainerCourseSelections(
          coursesPayload.data ?? [],
          trainerPayload.data.courses,
        );

        setTrainer(trainerPayload.data);
        setCourses(options);
        setSelectedCourseIds(selectedValues);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Failed to load trainer courses.");
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      active = false;
    };
  }, [open, trainerId]);

  const toggleCourse = (courseId: string) => {
    setSelectedCourseIds((prev) => (
      prev.includes(courseId)
        ? prev.filter((currentCourseId) => currentCourseId !== courseId)
        : [...prev, courseId]
    ));
  };

  const handleSubmit = async () => {
    if (!trainerId || selectedCourseIds.length === 0) {
      setError("Select at least one course.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/trainers/${trainerId}/courses`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          courses: selectedCourseIds,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update trainer courses.");
      }

      toast.success("Trainer courses updated successfully.");
      onUpdated?.();
      onOpenChange(false);
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "Failed to update trainer courses.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setTrainer(null);
      setCourses([]);
      setSelectedCourseIds([]);
      setError(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Assign Courses</SheetTitle>
          <SheetDescription>
            {trainer ? `Update the courses assigned to ${trainer.fullName}.` : "Update the courses assigned to this trainer."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex h-full flex-col overflow-hidden p-6">
          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
            {isLoading ? (
              <SheetLoadingSkeleton isLoading={true} variant="form" />
            ) : (
              <>
                {trainer ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <p className="font-semibold text-slate-900">{trainer.fullName}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">{trainer.employeeCode}</p>
                  </div>
                ) : null}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Assigned Courses</label>
                  <div className="grid max-h-72 gap-3 overflow-y-auto rounded-xl border border-[#dde1e6] p-3 sm:grid-cols-2">
                    {courses.length === 0 ? (
                      <p className="text-sm text-slate-500">No courses available.</p>
                    ) : (
                      courses.map((course) => {
                        const selected = selectedCourseIds.includes(course.id);

                        return (
                          <button
                            key={course.id}
                            type="button"
                            onClick={() => toggleCourse(course.id)}
                            className={cn(
                              "rounded-xl border px-3 py-3 text-left transition-colors",
                              selected
                                ? "border-[#0d3b84] bg-blue-50 text-slate-900"
                                : "border-[#dde1e6] bg-white text-slate-700 hover:bg-slate-50",
                            )}
                            aria-pressed={selected}
                          >
                            <div className="space-y-1">
                              <p className="text-sm font-semibold">{course.name}</p>
                              {!course.isActive ? (
                                <p className="text-[11px] font-medium text-amber-700">
                                  {course.source === "legacy" ? "Saved assignment not found in the course catalog." : "Inactive course retained from the current assignment."}
                                </p>
                              ) : null}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p> : null}
              </>
            )}
          </div>

          {!isLoading ? (
            <SheetFooter className="p-0 pt-4 sm:justify-end sm:border-0">
              <Button variant="secondary" type="button" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Courses"}
              </Button>
            </SheetFooter>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}