"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BookOpen, ClipboardList, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { AddAssessmentSheet } from "@/components/modules/assessment-pool/add-assessment-sheet";
import { AssessmentDetailSheet } from "@/components/modules/assessment-pool/assessment-detail-sheet";
import { AssessmentPoolTab } from "@/components/modules/assessment-pool/assessment-pool-tab";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const selectClassName = "block w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84]";

type CourseOption = {
  id: string;
  name: string;
  isActive: boolean;
};

export default function AssessmentsPage() {
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [detailPoolId, setDetailPoolId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const selectedCourse = courses.find((course) => course.id === selectedCourseId) ?? null;

  const loadCourses = useCallback(async () => {
    setIsLoadingCourses(true);

    try {
      const response = await fetch("/api/courses", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load courses.");
      }

      const result = (await response.json()) as { data?: CourseOption[] };
      const activeCourses = (result.data ?? []).filter((course) => course.isActive);
      const requestedCourseId = typeof window === "undefined"
        ? ""
        : new URLSearchParams(window.location.search).get("courseId")?.trim() ?? "";
      const preferredCourseId = activeCourses.some((course) => course.id === requestedCourseId) ? requestedCourseId : "";

      setCourses(activeCourses);
      setSelectedCourseId((current) => {
        if (current && activeCourses.some((course) => course.id === current)) {
          return current;
        }

        return preferredCourseId;
      });
    } catch {
      toast.error("Failed to load courses.");
    } finally {
      setIsLoadingCourses(false);
    }
  }, []);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  const handleCreated = (poolId: string) => {
    setRefreshKey((previous) => previous + 1);
    setDetailPoolId(poolId);
  };

  const handleAssessmentUpdated = () => {
    setRefreshKey((previous) => previous + 1);
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-slate-200 bg-white/95">
        <CardContent className="py-4">
          <div className="space-y-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-primary shadow-sm">
                    <ClipboardList className="h-4 w-4" />
                  </div>
                  <h1 className="text-xl font-semibold tracking-tight text-slate-950">Assessment Builder</h1>
                  <Badge variant={selectedCourseId ? "info" : "default"} className="px-2 py-0.5 text-[9px] tracking-[0.16em]">
                    {selectedCourseId ? "Course Links" : "Pool View"}
                  </Badge>
                  <div className="group relative">
                    <button
                      type="button"
                      aria-label="Assessment builder guidance"
                      title="Assessment builder guidance"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84]"
                    >
                      <span className="text-[11px] font-bold leading-none">i</span>
                    </button>
                    <div
                      role="tooltip"
                      className="pointer-events-none absolute left-0 top-8 z-20 w-72 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-600 opacity-0 shadow-lg transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
                    >
                      Create reusable assessments here first, then attach them to curriculum stages, batch mappings, or schedule events from their operational workspaces.
                    </div>
                  </div>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Build, review, and publish reusable assessments in one place, then assign them to courses separately.
                </p>
              </div>

              <div className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 p-3 xl:max-w-3xl">
                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-end">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Show linked course</label>
                    <select
                      value={selectedCourseId}
                      onChange={(event) => setSelectedCourseId(event.target.value)}
                      className={selectClassName}
                      disabled={isLoadingCourses}
                    >
                      <option value="">All Assessments (Pool View)</option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>{course.name}</option>
                      ))}
                    </select>
                  </div>
                  <Button type="button" variant="secondary" onClick={() => setSelectedCourseId("")} disabled={!selectedCourseId || isLoadingCourses}>
                    Clear
                  </Button>
                  <Button asChild variant="ghost">
                    <Link href={selectedCourseId ? `/assessments/question-bank?courseId=${encodeURIComponent(selectedCourseId)}` : "/assessments/question-bank"}>
                      <BookOpen className="h-4 w-4" />
                      Question Bank
                    </Link>
                  </Button>
                  <Button asChild variant="ghost">
                    <Link href="/course-builder/content">
                      <ExternalLink className="h-4 w-4" />
                      Content Library
                    </Link>
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default" className="px-2 py-0.5 text-[9px] tracking-[0.16em]">View: {selectedCourse ? `${selectedCourse.name} links` : "Shared assessment pool"}</Badge>
              <Badge variant="default" className="px-2 py-0.5 text-[9px] tracking-[0.16em]">Create mode: Pool-first</Badge>
              <Badge variant="default" className="px-2 py-0.5 text-[9px] tracking-[0.16em]">Status: {isLoadingCourses ? "Loading courses" : "Ready"}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[#edf2f7] bg-white/90">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle>Reusable Assessments</CardTitle>
              <CardDescription>
                Review the shared pool, open a saved assessment for detail, or create a new one before linking it into course delivery.
              </CardDescription>
            </div>
            <Badge variant="info" className="self-start px-2.5 py-1 text-[9px] tracking-[0.16em]">
              {selectedCourse ? `Linked: ${selectedCourse.name}` : "Linked: All Courses"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <AssessmentPoolTab
            key={`pool-${selectedCourseId}-${refreshKey}`}
            courseId={selectedCourseId || undefined}
            onAddAssessment={() => setAddSheetOpen(true)}
            onSelectAssessment={(poolId) => setDetailPoolId(poolId)}
            onAiGenerate={() => {
              toast.info(
                "AI-powered assessment generation is coming soon. This feature will use tool calling to automatically create questions based on your prompt.",
              );
            }}
          />
        </CardContent>
      </Card>

      <AddAssessmentSheet
        open={addSheetOpen}
        onOpenChange={setAddSheetOpen}
        onCreated={handleCreated}
      />

      <AssessmentDetailSheet
        poolId={detailPoolId}
        open={Boolean(detailPoolId)}
        onOpenChange={(open) => {
          if (!open) {
            setDetailPoolId(null);
          }
        }}
        onUpdated={handleAssessmentUpdated}
      />
    </div>
  );
}