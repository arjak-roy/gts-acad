import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardSearchResult, DashboardStats } from "@/types";
import { formatCompactNumber } from "@/lib/utils";

import { OperationsSnapshot } from "@/components/modules/dashboard/operations-snapshot";
import { DashboardSearchResults } from "@/components/modules/dashboard/dashboard-search-results";
import { ReadinessFunnel } from "@/components/modules/dashboard/readiness-funnel";
import { StatsGrid } from "@/components/modules/dashboard/stats-grid";

function buildInsightSearchResult(stats: DashboardStats, query: string): DashboardSearchResult | null {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return null;
  }

  const items = [
    { id: "active-learners", title: "Active Learners", description: `${stats.activeLearners.toLocaleString("en-IN")} | KPI summary` },
    { id: "live-batches", title: "Live Batches", description: `${stats.liveBatches.toLocaleString("en-IN")} | ${stats.capacityUtilization.toFixed(1)}% capacity` },
    { id: "average-attendance", title: "Avg Attendance", description: `${stats.averageAttendance.toFixed(1)}% | Attendance records` },
    { id: "average-assessment-score", title: "Avg Test Score", description: `${stats.averageAssessmentScore.toFixed(0)}/100 | Latest assessments` },
    { id: "certificates-issued", title: "Certificates YTD", description: `${stats.certificatesIssuedYtd.toLocaleString("en-IN")} | Verified outcomes` },
    { id: "placement-ready", title: "Placement Ready", description: `${stats.placementReady.toLocaleString("en-IN")} | Recruiter sync eligible` },
    ...stats.readinessFunnel.map((stage) => ({
      id: `funnel-${stage.label}`,
      title: stage.label,
      description: `${stage.value.toLocaleString("en-IN")} | Readiness funnel stage`,
    })),
    ...stats.operationsSnapshot.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.message,
    })),
    ...stats.trends.map((point) => ({
      id: `trend-${point.label}`,
      title: `${point.label} Trendline`,
      description: `${formatCompactNumber(point.activeLearners)} learners | ${point.placementReady} ready`,
    })),
  ]
    .filter(
      (item) => item.title.toLowerCase().includes(normalizedQuery) || item.description.toLowerCase().includes(normalizedQuery),
    )
    .slice(0, 6)
    .map((item) => ({
      ...item,
      href: "/dashboard",
      section: "insights" as const,
    }));

  if (items.length === 0) {
    return null;
  }

  return {
    query,
    total: items.length,
    groups: [
      {
        key: "insights",
        label: "Dashboard Insights",
        items,
      },
    ],
  };
}

export function DashboardOverview({
  stats,
  searchQuery,
  searchResults,
}: {
  stats: DashboardStats;
  searchQuery: string;
  searchResults: DashboardSearchResult | null;
}) {
  const peakLearners = Math.max(...stats.trends.map((point) => point.activeLearners));
  const peakPlacement = Math.max(...stats.trends.map((point) => point.placementReady));
  const insightSearchResults = buildInsightSearchResult(stats, searchQuery);
  const mergedSearchResults = searchQuery.trim().length
    ? {
        query: searchQuery,
        total: (searchResults?.total ?? 0) + (insightSearchResults?.total ?? 0),
        groups: [...(insightSearchResults?.groups ?? []), ...(searchResults?.groups ?? [])],
      }
    : null;

  return (
    <div className="space-y-6">
      <StatsGrid stats={stats} />

      {mergedSearchResults ? <DashboardSearchResults search={mergedSearchResults} /> : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <ReadinessFunnel stats={stats} />
          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">Operational Trendline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-6">
                {stats.trends.map((point) => (
                  <div key={point.label} className="space-y-3 rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">{point.label}</p>
                    <div className="space-y-2">
                      <div>
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                          <span>Learners</span>
                          <span>{formatCompactNumber(point.activeLearners)}</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-slate-200">
                          <div className="h-2 rounded-full bg-primary" style={{ width: `${(point.activeLearners / peakLearners) * 100}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                          <span>Ready</span>
                          <span>{point.placementReady}</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-orange-100">
                          <div className="h-2 rounded-full bg-accent" style={{ width: `${(point.placementReady / peakPlacement) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <OperationsSnapshot stats={stats} />
      </div>
    </div>
  );
}