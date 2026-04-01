import { Filter } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardStats } from "@/types";

export function ReadinessFunnel({ stats }: { stats: DashboardStats }) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.28em] text-slate-500">
          <Filter className="h-4 w-4 text-accent" />
          Academy Readiness Funnel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {stats.readinessFunnel.map((stage, index) => (
          <div
            key={stage.label}
            className={`flex h-12 items-center justify-between rounded-2xl px-5 text-sm font-bold text-white shadow-sm ${stage.accent}`}
            style={{ width: `${100 - index * 10}%`, marginInline: "auto" }}
          >
            <span>{stage.label}</span>
            <span>{stage.value.toLocaleString("en-IN")}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}