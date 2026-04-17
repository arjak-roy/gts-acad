import { FilterX, Layers3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardStats } from "@/types";

type StatsGridProps = {
  stats: DashboardStats;
  searchQuery: string;
  filterOptions: {
    categories: Array<{ id: string; label: string }>;
    courses: Array<{ id: string; label: string; helper: string | null }>;
    programs: Array<{ id: string; courseId: string; type: DashboardStats["filters"]["programType"] | null; label: string; helper: string | null }>;
    batches: Array<{ id: string; courseId: string | null; programId: string | null; programType: DashboardStats["filters"]["programType"] | null; label: string; helper: string | null }>;
  };
  draftFilters: {
    programType: string;
    courseId: string;
    programId: string;
    batchId: string;
  };
  isRefreshing: boolean;
  onCategoryChange: (value: string) => void;
  onCourseChange: (value: string) => void;
  onProgramChange: (value: string) => void;
  onBatchChange: (value: string) => void;
  onApplyFilters: () => void;
  onResetFilters: () => void;
  onApplyGlobalView: () => void;
};

const summaryCards = (stats: DashboardStats) => [
  {
    label: "Courses",
    value: stats.totalCourses.toLocaleString("en-IN"),
    helper: `${stats.publishedCourses} published · ${stats.draftCourses} draft · ${stats.archivedCourses} archived`,
  },
  {
    label: "Programs In Scope",
    value: stats.activePrograms.toLocaleString("en-IN"),
    helper: `${stats.activeCourses} active course${stats.activeCourses === 1 ? "" : "s"} represented`,
  },
  {
    label: "Live Batches",
    value: stats.liveBatches.toLocaleString("en-IN"),
    helper: `${stats.totalEnrolled.toLocaleString("en-IN")} enrolled learner${stats.totalEnrolled === 1 ? "" : "s"} in scope`,
  },
  {
    label: "Quiz Pools",
    value: stats.totalQuizzes.toLocaleString("en-IN"),
    helper: `${stats.publishedAssessments} published reusable assessment pool${stats.publishedAssessments === 1 ? "" : "s"}`,
  },
  {
    label: "Trainers",
    value: stats.totalTrainers.toLocaleString("en-IN"),
    helper: `${stats.trainerWorkload.length} trainer${stats.trainerWorkload.length === 1 ? "" : "s"} carrying active workload`,
  },
  {
    label: "Active Learners",
    value: stats.activeLearners.toLocaleString("en-IN"),
    helper: `${stats.learnersStarted} started · ${stats.learnersCompletedRequired} completed required items`,
  },
  {
    label: "Approvals Queue",
    value: stats.pendingCourseApprovals.toLocaleString("en-IN"),
    helper: stats.pendingCourseApprovals > 0 ? "Courses waiting for review before publishing" : "No approvals waiting right now",
  },
  {
    label: "Overdue Assignments",
    value: stats.overdueAssignments.toLocaleString("en-IN"),
    helper: stats.overdueAssignments > 0 ? "Scheduled assessments that crossed their planned start time" : "No overdue assessment schedules in scope",
  },
];

function buildScopeLabel(stats: DashboardStats) {
  if (stats.scope.batchName) {
    return `${stats.scope.batchName} · ${stats.scope.programName ?? "Program"} · ${stats.scope.courseName ?? "Course"}`;
  }

  if (stats.scope.programName) {
    return `${stats.scope.programName} · ${stats.scope.courseName ?? "Course"}`;
  }

  if (stats.scope.courseName) {
    return stats.scope.programTypeLabel ? `${stats.scope.courseName} · ${stats.scope.programTypeLabel}` : stats.scope.courseName;
  }

  if (stats.scope.programTypeLabel) {
    return `${stats.scope.programTypeLabel} programs across the LMS catalog`;
  }

  return `${stats.totalCourses} course${stats.totalCourses === 1 ? "" : "s"} across the LMS catalog`;
}

const selectClassName = "block w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84]";

export function StatsGrid({
  stats,
  searchQuery,
  filterOptions,
  draftFilters,
  isRefreshing,
  onCategoryChange,
  onCourseChange,
  onProgramChange,
  onBatchChange,
  onApplyFilters,
  onResetFilters,
  onApplyGlobalView,
}: StatsGridProps) {
  const scopeLabel = buildScopeLabel(stats);
  const viewLabel = stats.scope.viewMode === "GLOBAL" ? "Global View" : "Filtered View";
  const hasActiveFilters = Boolean(draftFilters.programType || draftFilters.courseId || draftFilters.programId || draftFilters.batchId);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">LMS Dashboard</h1>
          <p className="mt-2 text-sm font-medium text-slate-500">{scopeLabel}. {viewLabel} for course lifecycle, delivery performance, learner progress, and operational follow-through.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={stats.scope.viewMode === "GLOBAL" ? "info" : "accent"}>{viewLabel}</Badge>
          <Button type="button" variant="secondary" className="w-full sm:w-auto" disabled={isRefreshing || !hasActiveFilters} onClick={onApplyGlobalView}>
            <FilterX className="h-4 w-4" />
            Reset To Global
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Dashboard Scope</p>
            <CardTitle className="mt-2 text-base font-black text-slate-950">{scopeLabel}</CardTitle>
            <CardDescription className="mt-2 max-w-3xl text-sm font-medium text-slate-500">
              Layer category, course, program, and batch filters to narrow the LMS view without switching dashboards or losing operational context.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 ring-1 ring-[#dde1e6]">
            <Layers3 className="h-4 w-4 text-primary" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Current Scope</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{viewLabel}</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      <form
        className="grid gap-3 rounded-3xl border border-[#dde1e6] bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto_auto] xl:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          onApplyFilters();
        }}
      >
        {searchQuery ? <input type="hidden" name="query" value={searchQuery} /> : null}

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Category</label>
          <select name="programType" value={draftFilters.programType} className={selectClassName} disabled={isRefreshing} onChange={(event) => onCategoryChange(event.target.value)}>
            <option value="">All Categories</option>
            {filterOptions.categories.map((category) => (
              <option key={category.id} value={category.id}>{category.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Course</label>
          <select name="courseId" value={draftFilters.courseId} className={selectClassName} disabled={isRefreshing} onChange={(event) => onCourseChange(event.target.value)}>
            <option value="">All Courses</option>
            {filterOptions.courses.map((course) => (
              <option key={course.id} value={course.id}>{course.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Program</label>
          <select name="programId" value={draftFilters.programId} className={selectClassName} disabled={isRefreshing} onChange={(event) => onProgramChange(event.target.value)}>
            <option value="">All Programs</option>
            {filterOptions.programs.map((program) => (
              <option key={program.id} value={program.id}>{program.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Batch</label>
          <select name="batchId" value={draftFilters.batchId} className={selectClassName} disabled={isRefreshing} onChange={(event) => onBatchChange(event.target.value)}>
            <option value="">All Batches</option>
            {filterOptions.batches.map((batch) => (
              <option key={batch.id} value={batch.id}>{batch.label}</option>
            ))}
          </select>
        </div>

        <Button type="submit" className="w-full sm:w-auto" disabled={isRefreshing}>{isRefreshing ? "Updating..." : "Apply Filters"}</Button>
        <Button type="button" variant="ghost" className="w-full sm:w-auto" disabled={isRefreshing} onClick={onResetFilters}>
          Reset
        </Button>
      </form>

      <div className={`grid gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${isRefreshing ? "opacity-70" : "opacity-100"}`}>
        {summaryCards(stats).map((card) => (
          <Card key={card.label}>
            <CardContent className="min-w-0 p-4 sm:p-5">
              <p className="text-[10px] font-black uppercase leading-4 tracking-[0.22em] text-slate-400 break-words">{card.label}</p>
              <h2 className="mt-2 break-words text-2xl font-black tracking-tight text-primary sm:text-3xl">{card.value}</h2>
              <p className="mt-3 break-words text-xs font-bold leading-5 text-slate-500">{card.helper}</p>
            </CardContent>
          </Card>
        ))}

        <Card className="border-none bg-primary text-white shadow-shell">
          <CardContent className="min-w-0 p-4 sm:p-5">
            <p className="text-[10px] font-black uppercase leading-4 tracking-[0.22em] text-white/60 break-words">Required Completion</p>
            <h2 className="mt-2 break-words text-2xl font-black tracking-tight sm:text-3xl">{stats.overallCompletionRate.toFixed(1)}%</h2>
            <p className="mt-3 break-words text-xs font-bold leading-5 text-white/70">{stats.learnersCompletedRequired} learner{stats.learnersCompletedRequired === 1 ? "" : "s"} completed every required published curriculum item. Avg attendance is {stats.averageAttendance.toFixed(1)}%.</p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}