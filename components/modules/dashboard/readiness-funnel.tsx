import { Filter } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardStats } from "@/types";

type DashboardStageFunnelStage = {
  label: string;
  value: number;
  accent: string;
  helper?: string;
};

export function DashboardStageFunnel({
  stages,
  emptyMessage = "No funnel data is available for the current scope.",
}: {
  stages: DashboardStageFunnelStage[];
  emptyMessage?: string;
}) {
  if (stages.length === 0) {
    return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm font-medium text-slate-500">{emptyMessage}</div>;
  }

  const shrinkStep = stages.length > 3 ? 8 : 10;

  return (
    <div className="space-y-3">
      {stages.map((stage, index) => (
        <div
          key={stage.label}
          className={cn("rounded-2xl px-4 py-4 text-white shadow-sm sm:px-5", stage.accent)}
          style={{ width: `${Math.max(72, 100 - index * shrinkStep)}%`, marginInline: "auto" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/70">Stage {index + 1}</p>
              <p className="mt-1 text-sm font-bold sm:text-base">{stage.label}</p>
              {stage.helper ? <p className="mt-1 text-xs leading-5 text-white/80">{stage.helper}</p> : null}
            </div>
            <p className="shrink-0 text-right text-xl font-black tracking-tight sm:text-2xl">{stage.value.toLocaleString("en-IN")}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReadinessFunnel({ stats }: { stats: DashboardStats }) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.28em] text-slate-500">
          <Filter className="h-4 w-4 text-accent" />
          Learner Readiness Funnel
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DashboardStageFunnel stages={stats.readinessFunnel} />
      </CardContent>
    </Card>
  );
}