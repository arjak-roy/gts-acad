"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, FileText, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";

import { AnalyticsFilterBar, type AnalyticsFilterState } from "@/components/modules/assessment-analytics/analytics-filter-bar";
import { AnalyticsStatsGrid } from "@/components/modules/assessment-analytics/analytics-stats-grid";
import { ExportDropdown } from "@/components/modules/assessment-analytics/export-dropdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";

type SummaryRow = {
  assessmentPoolId: string;
  assessmentCode: string;
  assessmentTitle: string;
  questionType: string;
  difficultyLevel: string | null;
  totalAssignedLearners: number;
  totalAttempts: number;
  completedAttempts: number;
  passRate: number;
  failRate: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  pendingReviewCount: number;
};

type PassFailStats = {
  passed: number;
  failed: number;
  pendingReview: number;
  passedPercentage: number;
  failedPercentage: number;
  pendingPercentage: number;
};

type Widgets = {
  averageQuizScore: number;
  passRate: number;
  totalQuizAttempts: number;
  pendingReviewCount: number;
};

type FilterMeta = {
  courses: { id: string; name: string }[];
  programs: { id: string; name: string; courseId: string }[];
  batches: { id: string; name: string; programId: string }[];
  assessmentPools: { id: string; title: string; code: string }[];
};

const INITIAL_FILTERS: AnalyticsFilterState = {
  courseId: "",
  programId: "",
  batchId: "",
  assessmentPoolId: "",
  dateFrom: "",
  dateTo: "",
};

const summaryColumns: DataTableColumn<SummaryRow>[] = [
  { key: "assessmentCode", label: "Code", sortable: true },
  { key: "assessmentTitle", label: "Assessment", sortable: true },
  {
    key: "questionType",
    label: "Type",
    render: (value) => (
      <Badge variant="default" className="text-xs">
        {String(value).replace(/_/g, " ")}
      </Badge>
    ),
  },
  {
    key: "difficultyLevel",
    label: "Difficulty",
    render: (value) => {
      if (!value) return "—";
      const colors: Record<string, string> = {
        EASY: "bg-green-100 text-green-800",
        MEDIUM: "bg-yellow-100 text-yellow-800",
        HARD: "bg-red-100 text-red-800",
      };
      return (
        <Badge className={colors[String(value)] ?? ""}>
          {String(value)}
        </Badge>
      );
    },
  },
  { key: "totalAssignedLearners", label: "Assigned", align: "center", sortable: true },
  { key: "totalAttempts", label: "Attempts", align: "center", sortable: true },
  { key: "completedAttempts", label: "Completed", align: "center", sortable: true },
  {
    key: "passRate",
    label: "Pass Rate",
    align: "center",
    sortable: true,
    render: (value) => (
      <span className={Number(value) >= 70 ? "text-green-600 font-semibold" : Number(value) >= 40 ? "text-yellow-600" : "text-red-600"}>
        {String(value)}%
      </span>
    ),
  },
  {
    key: "averageScore",
    label: "Avg Score",
    align: "center",
    sortable: true,
    render: (value) => `${String(value)}%`,
  },
  { key: "highestScore", label: "Highest", align: "center", render: (v) => `${String(v)}%` },
  { key: "lowestScore", label: "Lowest", align: "center", render: (v) => `${String(v)}%` },
  { key: "pendingReviewCount", label: "Pending", align: "center" },
];

function buildFilterQueryString(filters: AnalyticsFilterState): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  return params.toString();
}

export default function AssessmentAnalyticsPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<AnalyticsFilterState>(INITIAL_FILTERS);
  const [filterMeta, setFilterMeta] = useState<FilterMeta>({
    courses: [],
    programs: [],
    batches: [],
    assessmentPools: [],
  });
  const [widgets, setWidgets] = useState<Widgets | null>(null);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [passFailStats, setPassFailStats] = useState<PassFailStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [metaLoading, setMetaLoading] = useState(true);

  // Load filter metadata
  useEffect(() => {
    let cancelled = false;
    async function loadMeta() {
      try {
        const [coursesRes, programsRes, batchesRes, poolsRes] = await Promise.all([
          fetch("/api/courses"),
          fetch("/api/programs"),
          fetch("/api/batches"),
          fetch("/api/assessment-pools"),
        ]);

        const [coursesJson, programsJson, batchesJson, poolsJson] = await Promise.all([
          coursesRes.json(),
          programsRes.json(),
          batchesRes.json(),
          poolsRes.json(),
        ]);

        if (cancelled) return;
        setFilterMeta({
          courses: coursesJson.data ?? [],
          programs: programsJson.data ?? [],
          batches: batchesJson.data ?? [],
          assessmentPools: poolsJson.data ?? [],
        });
      } catch {
        // Silently fail for filter metadata
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    }
    loadMeta();
    return () => { cancelled = true; };
  }, []);

  // Load analytics data
  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      try {
        const qs = buildFilterQueryString(filters);
        const [widgetsRes, summaryRes] = await Promise.all([
          fetch(`/api/assessment-analytics/widgets?${qs}`),
          fetch(`/api/assessment-analytics/summary?${qs}`),
        ]);

        const [widgetsJson, summaryJson] = await Promise.all([
          widgetsRes.json(),
          summaryRes.json(),
        ]);

        if (cancelled) return;
        setWidgets(widgetsJson.data ?? null);
        setSummary(summaryJson.data?.summary ?? []);
        setPassFailStats(summaryJson.data?.passFailStats ?? null);
      } catch {
        toast.error("Failed to load analytics data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, [filters]);

  const handleRowClick = useCallback(
    (row: SummaryRow) => {
      router.push(`/assessments/analytics/${row.assessmentPoolId}`);
    },
    [router],
  );

  const filterParams = buildFilterQueryString(filters);
  const filterRecord: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value) filterRecord[key] = value;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assessment Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Monitor learner performance, identify trends, and evaluate quiz effectiveness.
          </p>
        </div>
        <ExportDropdown reportType="summary" filters={filterRecord} />
      </div>

      {/* Filters */}
      <AnalyticsFilterBar
        courses={filterMeta.courses}
        programs={filterMeta.programs}
        batches={filterMeta.batches}
        assessmentPools={filterMeta.assessmentPools}
        filters={filters}
        onChange={setFilters}
      />

      {/* Widgets */}
      <AnalyticsStatsGrid
        loading={loading}
        widgets={
          widgets
            ? [
                { label: "Total Quiz Attempts", value: widgets.totalQuizAttempts.toLocaleString("en-IN") },
                { label: "Average Score", value: `${widgets.averageQuizScore}%` },
                { label: "Pass Rate", value: `${widgets.passRate}%` },
                { label: "Pending Review", value: widgets.pendingReviewCount.toLocaleString("en-IN") },
              ]
            : []
        }
      />

      {/* Pass/Fail breakdown */}
      {passFailStats && !loading && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pass / Fail Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
                <span>Passed: {passFailStats.passed} ({passFailStats.passedPercentage}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
                <span>Failed: {passFailStats.failed} ({passFailStats.failedPercentage}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full bg-yellow-500" />
                <span>Pending: {passFailStats.pendingReview} ({passFailStats.pendingPercentage}%)</span>
              </div>
            </div>
            {/* Simple bar */}
            {(passFailStats.passed + passFailStats.failed + passFailStats.pendingReview) > 0 && (
              <div className="mt-3 flex h-4 w-full overflow-hidden rounded-full">
                {passFailStats.passedPercentage > 0 && (
                  <div
                    className="bg-green-500 transition-all"
                    style={{ width: `${passFailStats.passedPercentage}%` }}
                  />
                )}
                {passFailStats.failedPercentage > 0 && (
                  <div
                    className="bg-red-500 transition-all"
                    style={{ width: `${passFailStats.failedPercentage}%` }}
                  />
                )}
                {passFailStats.pendingPercentage > 0 && (
                  <div
                    className="bg-yellow-500 transition-all"
                    style={{ width: `${passFailStats.pendingPercentage}%` }}
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Assessment Summary</CardTitle>
              <CardDescription>Click an assessment to see detailed learner and question analytics.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={summaryColumns}
            data={summary}
            loading={loading}
            onRowClick={handleRowClick}
            search={{ placeholder: "Search assessments..." }}
            pagination
            emptyState={{
              icon: <BarChart3 className="h-10 w-10" />,
              title: "No assessment data",
              description: "There are no completed assessments matching the selected filters.",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
