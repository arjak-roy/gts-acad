import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardSearchResult } from "@/types";

type DashboardSearchResultsProps = {
  search: DashboardSearchResult;
};

function resolveBadgeVariant(section: string) {
  if (section === "learners") return "info" as const;
  if (section === "batches") return "warning" as const;
  if (section === "trainers") return "accent" as const;
  if (section === "programs") return "success" as const;
  return "default" as const;
}

export function DashboardSearchResults({ search }: DashboardSearchResultsProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.28em] text-slate-500">
          <Search className="h-4 w-4 text-primary" />
          Global Search Results
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {search.total > 0 ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {search.groups.map((group) => (
              <div key={group.key} className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black uppercase tracking-[0.22em] text-slate-500">{group.label}</p>
                  <Badge variant={resolveBadgeVariant(group.key)}>{group.items.length}</Badge>
                </div>

                <div className="space-y-3">
                  {group.items.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-white bg-white p-4 transition-colors hover:border-[#cdd8ea] hover:bg-[#f8fbff]"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-900">{item.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.description}</p>
                      </div>
                      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#dde1e6] bg-slate-50/80 p-8 text-center">
            <p className="text-sm font-bold text-slate-900">No matches found for "{search.query}".</p>
            <p className="mt-2 text-sm text-slate-500">Try a learner code, program name, trainer name, batch code, or a dashboard metric label.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}