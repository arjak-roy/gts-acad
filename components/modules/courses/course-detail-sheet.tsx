"use client";

import { useEffect, useState } from "react";
import { BookOpenText, Layers } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/ui/can-access";
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

type CourseDetailSheetProps = {
  courseId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (courseId: string) => void;
};

export function CourseDetailSheet({ courseId, open, onOpenChange, onEdit }: CourseDetailSheetProps) {
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !courseId) {
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    fetch(`/api/courses/${courseId}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load course details.");
        }

        const payload = (await response.json()) as { data?: CourseDetail };
        if (active) {
          setCourse(payload.data ?? null);
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load course details.");
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [courseId, open]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setCourse(null);
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
        ) : course ? (
          <>
            <SheetHeader>
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <BookOpenText className="h-5 w-5" />
                </div>
                <div>
                  <SheetTitle>{course.name}</SheetTitle>
                  <SheetDescription className="mt-1 text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                    Top-level course grouping
                  </SheetDescription>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant={course.isActive ? "success" : "danger"}>{course.isActive ? "Active" : "Inactive"}</Badge>
                    <Badge variant="info">{course.programs.length} programs</Badge>
                  </div>
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-6">
              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Description</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{course.description ?? "No description provided."}</p>
              </div>

              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Programs ({course.programs.length})</p>
                </div>
                {course.programs.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {course.programs.map((program) => (
                      <div key={program.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-sm font-semibold text-slate-900">{program.name}</p>
                        <p className="mt-1 text-xs font-medium text-slate-500">{program.type}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">No programs are mapped to this course yet.</p>
                )}
              </div>
            </div>

            <SheetFooter>
              <Button variant="secondary" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
              <CanAccess permission="courses.edit">
                <Button onClick={() => onEdit(course.id)}>Edit Course</Button>
              </CanAccess>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}