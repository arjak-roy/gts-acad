import { AlertTriangle, Clock3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardStats } from "@/types";

export function OperationsSnapshot({ stats }: { stats: DashboardStats }) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.28em] text-slate-500">
          <Clock3 className="h-4 w-4 text-primary" />
          Operations Snapshot
        </CardTitle>
      </CardHeader>
      <CardContent className="flex h-full flex-col gap-4">
        <div className="space-y-4">
          {stats.operationsSnapshot.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className={`mt-0.5 h-4 w-4 ${item.tone === "danger" ? "text-rose-500" : "text-primary"}`} />
                <div>
                  <p className="text-sm font-bold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-[#dde1e6] bg-[#fffbf2] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-primary">Recruiter Workspace</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Active mandates: 42</p>
            </div>
            <Badge variant="accent">Synced</Badge>
          </div>
        </div>

        <Button variant="secondary" className="mt-auto">Check Active Sessions</Button>
      </CardContent>
    </Card>
  );
}