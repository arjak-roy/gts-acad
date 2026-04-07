"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ClipboardList, ExternalLink, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { AddAssessmentSheet } from "@/components/modules/assessment-pool/add-assessment-sheet";
import { AssessmentDetailSheet } from "@/components/modules/assessment-pool/assessment-detail-sheet";
import { AssessmentPoolTab } from "@/components/modules/assessment-pool/assessment-pool-tab";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const selectClassName = "block w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84]";

type CourseOption = {
  id: string;
  name: string;
  isActive: boolean;
};

export default function AssessmentPoolPage() {
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
      setCourses((result.data ?? []).filter((course) => course.isActive));
    } catch {
      toast.error("Failed to load courses.");
    } finally {
      setIsLoadingCourses(false);
    }
  }, []);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  const handleCreated = () => {
    setRefreshKey((previous) => previous + 1);
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-slate-200 bg-[linear-gradient(135deg,_#ffffff_0%,_#fbfcff_52%,_#eef5ff_100%)]">
        <CardContent className="pt-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5">
              <div className="space-y-3">
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Course Builder</p>
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-white text-primary shadow-sm">
                    <ClipboardList className="h-6 w-6" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Assessment Pool</h1>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                      Centralize reusable assessments by course, review them in one place, and keep item creation separate from the content upload workflow.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Scope</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{selectedCourse ? selectedCourse.name : "All active courses"}</p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Filter Mode</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{selectedCourseId ? "Course-specific" : "Pool-wide"}</p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">AI Assist</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">Prompt-driven generation queued</p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">Workspace Context</p>
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Filter by course</label>
                  <select
                    value={selectedCourseId}
                    onChange={(event) => setSelectedCourseId(event.target.value)}
                    className={selectClassName}
                    disabled={isLoadingCourses}
                  >
                    <option value="">All Courses (Pool View)</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>{course.name}</option>
                    ))}
                  </select>
                </div>

                <div className="rounded-2xl border border-[#e2e8f0] bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Creation note
                  </div>
                  <p className="mt-2 leading-6">
                    Use the pool to create reusable assessments first, then attach them to curriculum stages in the curriculum builder.
                  </p>
                </div>

                <Button asChild variant="ghost">
                  <Link href="/course-builder/content">
                    <ExternalLink className="h-4 w-4" />
                    Open Content Library
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[#edf2f7] bg-white/90">
          <CardTitle>Reusable Assessments</CardTitle>
          <CardDescription>
            Review the active pool, open a saved assessment for detail, or create a new one within the current course scope.
          </CardDescription>
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
        courseId={selectedCourseId || undefined}
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
        onUpdated={handleCreated}
      />
    </div>
  );
}
