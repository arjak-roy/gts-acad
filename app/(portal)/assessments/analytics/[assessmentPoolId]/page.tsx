"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BarChart3, Users } from "lucide-react";
import { toast } from "sonner";

import { AnalyticsStatsGrid } from "@/components/modules/assessment-analytics/analytics-stats-grid";
import { ExportDropdown } from "@/components/modules/assessment-analytics/export-dropdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ────────────────────────────────────────────────────────────────────

type LearnerRow = {
  learnerId: string;
  learnerCode: string;
  learnerName: string;
  assessmentPoolId: string;
  assessmentTitle: string;
  attemptCount: number;
  latestScore: number | null;
  highestScore: number | null;
  passed: boolean | null;
  completionDate: string | null;
  status: string;
};

type QuestionRow = {
  questionId: string;
  questionText: string;
  questionType: string;
  marks: number;
  timesAnswered: number;
  correctRate: number;
  incorrectRate: number;
  skippedCount: number;
  averageMarksEarned: number;
  mostSelectedWrongAnswer: unknown;
  isLowSuccess: boolean;
};

type TrendPoint = {
  period: string;
  label: string;
  attempts: number;
  averageScore: number;
  passRate: number;
};

type TabKey = "learners" | "questions" | "trends";

// ── Columns ──────────────────────────────────────────────────────────────────

const learnerColumns: DataTableColumn<LearnerRow>[] = [
  { key: "learnerCode", label: "Code", sortable: true },
  { key: "learnerName", label: "Learner", sortable: true },
  { key: "attemptCount", label: "Attempts", align: "center", sortable: true },
  {
    key: "latestScore",
    label: "Latest Score",
    align: "center",
    sortable: true,
    render: (value) => (value !== null ? `${String(value)}%` : "—"),
  },
  {
    key: "highestScore",
    label: "Best Score",
    align: "center",
    sortable: true,
    render: (value) => (value !== null ? `${String(value)}%` : "—"),
  },
  {
    key: "passed",
    label: "Status",
    align: "center",
    render: (value) =>
      value === null ? (
        <Badge variant="default">Pending</Badge>
      ) : value ? (
        <Badge className="bg-green-100 text-green-800">Passed</Badge>
      ) : (
        <Badge className="bg-red-100 text-red-800">Failed</Badge>
      ),
  },
  {
    key: "completionDate",
    label: "Completed",
    render: (value) =>
      value ? new Date(String(value)).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—",
  },
];

const questionColumns: DataTableColumn<QuestionRow>[] = [
  {
    key: "questionText",
    label: "Question",
    render: (value) => {
      const text = String(value);
      return text.length > 80 ? text.slice(0, 77) + "..." : text;
    },
  },
  {
    key: "questionType",
    label: "Type",
    render: (value) => (
      <Badge variant="default" className="text-xs">
        {String(value).replace(/_/g, " ")}
      </Badge>
    ),
  },
  { key: "marks", label: "Marks", align: "center" },
  { key: "timesAnswered", label: "Answered", align: "center", sortable: true },
  {
    key: "correctRate",
    label: "Correct %",
    align: "center",
    sortable: true,
    render: (value) => (
      <span className={Number(value) >= 60 ? "text-green-600 font-semibold" : Number(value) >= 30 ? "text-yellow-600" : "text-red-600 font-semibold"}>
        {String(value)}%
      </span>
    ),
  },
  {
    key: "incorrectRate",
    label: "Incorrect %",
    align: "center",
    render: (value) => `${String(value)}%`,
  },
  { key: "skippedCount", label: "Skipped", align: "center" },
  { key: "averageMarksEarned", label: "Avg Marks", align: "center" },
  {
    key: "isLowSuccess",
    label: "Flag",
    align: "center",
    render: (value) =>
      value ? (
        <Badge className="bg-red-100 text-red-800 text-xs">Low Success</Badge>
      ) : null,
  },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function AssessmentAnalyticsDetailPage() {
  const params = useParams();
  const router = useRouter();
  const assessmentPoolId = params.assessmentPoolId as string;

  const [activeTab, setActiveTab] = useState<TabKey>("learners");
  const [learnerData, setLearnerData] = useState<{ rows: LearnerRow[]; totalCount: number }>({ rows: [], totalCount: 0 });
  const [questionData, setQuestionData] = useState<{ questions: QuestionRow[]; mostDifficult: QuestionRow[] }>({ questions: [], mostDifficult: [] });
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState<"daily" | "weekly" | "monthly">("weekly");

  // Load all data
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [learnersRes, questionsRes, trendsRes] = await Promise.all([
          fetch(`/api/assessment-analytics/learners?assessmentPoolId=${assessmentPoolId}&page=1&pageSize=100`),
          fetch(`/api/assessment-analytics/questions?assessmentPoolId=${assessmentPoolId}`),
          fetch(`/api/assessment-analytics/trends?assessmentPoolId=${assessmentPoolId}&granularity=${granularity}`),
        ]);
        const [learnersJson, questionsJson, trendsJson] = await Promise.all([
          learnersRes.json(),
          questionsRes.json(),
          trendsRes.json(),
        ]);
        if (cancelled) return;
        setLearnerData(learnersJson.data ?? { rows: [], totalCount: 0 });
        setQuestionData(questionsJson.data ?? { questions: [], mostDifficult: [] });
        setTrends(trendsJson.data ?? []);
      } catch {
        toast.error("Failed to load assessment analytics.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [assessmentPoolId, granularity]);

  const filterRecord = { assessmentPoolId };
  const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: "learners", label: "Learner Performance", icon: Users },
    { key: "questions", label: "Question Analytics", icon: BarChart3 },
    { key: "trends", label: "Attempt Trends", icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/assessments/analytics")}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Assessment Detail Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Detailed performance data for this assessment pool.
          </p>
        </div>
      </div>

      {/* Stats */}
      <AnalyticsStatsGrid
        loading={loading}
        widgets={[
          { label: "Total Learners", value: learnerData.totalCount },
          {
            label: "Avg Score",
            value: learnerData.rows.length > 0
              ? `${Math.round(learnerData.rows.reduce((sum, r) => sum + (r.latestScore ?? 0), 0) / learnerData.rows.length)}%`
              : "—",
          },
          {
            label: "Questions",
            value: questionData.questions.length,
            helper: `${questionData.mostDifficult.length} flagged as difficult`,
          },
          {
            label: "Trend Periods",
            value: trends.length,
            helper: granularity,
          },
        ]}
      />

      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "learners" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Learner Performance</CardTitle>
                <CardDescription>{learnerData.totalCount} learner(s) found</CardDescription>
              </div>
              <ExportDropdown reportType="learner-performance" filters={filterRecord} />
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={learnerColumns}
              data={learnerData.rows}
              loading={loading}
              search={{ placeholder: "Search learners..." }}
              pagination
              emptyState={{
                icon: <Users className="h-10 w-10" />,
                title: "No learner data",
                description: "No learners have attempted this assessment yet.",
              }}
            />
          </CardContent>
        </Card>
      )}

      {activeTab === "questions" && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Question-Level Analytics</CardTitle>
                  <CardDescription>Per-question correctness and difficulty analysis.</CardDescription>
                </div>
                <ExportDropdown reportType="question-analytics" filters={filterRecord} />
              </div>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={questionColumns}
                data={questionData.questions}
                loading={loading}
                search={{ placeholder: "Search questions..." }}
                pagination
                emptyState={{
                  icon: <BarChart3 className="h-10 w-10" />,
                  title: "No question data",
                  description: "No question-level analytics available yet.",
                }}
              />
            </CardContent>
          </Card>

          {questionData.mostDifficult.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-red-700">Most Difficult Questions</CardTitle>
                <CardDescription>Questions with the lowest correct answer rates.</CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={questionColumns}
                  data={questionData.mostDifficult}
                  loading={loading}
                  pagination={false}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === "trends" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Attempt Trends</CardTitle>
                <CardDescription>Attempts, scores, and pass rates over time.</CardDescription>
              </div>
              <div className="flex gap-2">
                {(["daily", "weekly", "monthly"] as const).map((g) => (
                  <Button
                    key={g}
                    variant={granularity === g ? "default" : "secondary"}
                    size="sm"
                    onClick={() => setGranularity(g)}
                  >
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : trends.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No trend data available for the selected period.
              </p>
            ) : (
              <div className="space-y-4">
                {/* Simple table-based trend display */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-6 font-medium">Period</th>
                        <th className="pb-2 pr-6 font-medium text-center">Attempts</th>
                        <th className="pb-2 pr-6 font-medium text-center">Avg Score</th>
                        <th className="pb-2 font-medium text-center">Pass Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trends.map((point) => (
                        <tr key={point.period} className="border-b last:border-0">
                          <td className="py-2 pr-6">{point.label}</td>
                          <td className="py-2 pr-6 text-center">{point.attempts}</td>
                          <td className="py-2 pr-6 text-center">{point.averageScore}%</td>
                          <td className="py-2 text-center">
                            <span className={point.passRate >= 70 ? "text-green-600 font-semibold" : point.passRate >= 40 ? "text-yellow-600" : "text-red-600"}>
                              {point.passRate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Visual bar representation */}
                <div className="space-y-2">
                  {trends.map((point) => (
                    <div key={point.period} className="flex items-center gap-3">
                      <span className="w-32 truncate text-xs text-muted-foreground">{point.label}</span>
                      <div className="flex-1">
                        <div className="relative h-5 w-full overflow-hidden rounded bg-muted">
                          <div
                            className="absolute inset-y-0 left-0 rounded bg-blue-500 transition-all"
                            style={{ width: `${Math.min(point.passRate, 100)}%` }}
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                            {point.passRate}%
                          </span>
                        </div>
                      </div>
                      <span className="w-16 text-right text-xs">{point.attempts} att.</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
