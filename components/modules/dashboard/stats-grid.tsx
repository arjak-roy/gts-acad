import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardStats } from "@/types";

type StatsGridProps = {
  stats: DashboardStats;
};

const summaryCards = (stats: DashboardStats) => [
  { label: "Active Learners", value: stats.activeLearners.toLocaleString("en-IN"), helper: "↑ 12% vs last month" },
  { label: "Live Batches", value: stats.liveBatches.toLocaleString("en-IN"), helper: `${stats.capacityUtilization.toFixed(1)}% capacity` },
  { label: "Avg Attendance", value: `${stats.averageAttendance.toFixed(1)}%`, helper: "Tracked from attendance records" },
  { label: "Avg Test Score", value: `${stats.averageAssessmentScore.toFixed(0)}/100`, helper: "Latest assessment average" },
  { label: "Certificates YTD", value: stats.certificatesIssuedYtd.toLocaleString("en-IN"), helper: "Verified outcomes" },
];

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">Academy Dashboard</h1>
          <p className="mt-2 text-sm font-medium text-slate-500">Monitoring training health and placement-ready talent pool.</p>
        </div>
        <Button variant="secondary">
          <Download className="h-4 w-4" />
          Export Stats
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {summaryCards(stats).map((card) => (
          <Card key={card.label}>
            <CardContent className="p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">{card.label}</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-primary">{card.value}</h2>
              <p className="mt-3 text-xs font-bold text-slate-500">{card.helper}</p>
            </CardContent>
          </Card>
        ))}

        <Card className="border-none bg-primary text-white shadow-shell">
          <CardContent className="p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/60">Placement Ready</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight">{stats.placementReady}</h2>
            <p className="mt-3 text-xs font-bold text-white/70">Eligible to sync into Recruiter Workspace.</p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}