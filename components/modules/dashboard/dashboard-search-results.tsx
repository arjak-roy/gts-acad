import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Building2,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Languages,
  Library,
  Search,
  Users,
  Users2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardSearchResult, DashboardSearchSection } from "@/types";

type DashboardSearchResultsProps = {
  search: DashboardSearchResult;
  query?: string;
};

const SECTION_META: Record<
  DashboardSearchSection,
  { icon: React.ElementType; badgeVariant: "info" | "warning" | "accent" | "success" | "default" | "danger" }
> = {
  insights: { icon: Search, badgeVariant: "default" },
  learners: { icon: Users, badgeVariant: "info" },
  batches: { icon: Users2, badgeVariant: "warning" },
  trainers: { icon: GraduationCap, badgeVariant: "accent" },
  programs: { icon: Library, badgeVariant: "success" },
  courses: { icon: BookOpen, badgeVariant: "default" },
  assessments: { icon: ClipboardCheck, badgeVariant: "danger" },
  curriculum: { icon: BookOpen, badgeVariant: "info" },
  centres: { icon: Building2, badgeVariant: "default" },
  course_content: { icon: FileText, badgeVariant: "default" },
  users: { icon: Users, badgeVariant: "info" },
  learning_resources: { icon: Library, badgeVariant: "success" },
  language_lab: { icon: Languages, badgeVariant: "accent" },
};

function highlightText(text: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-yellow-100 px-0.5 text-inherit">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function DashboardSearchResults({ search, query }: DashboardSearchResultsProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.28em] text-slate-500">
            <Search className="h-4 w-4 text-primary" />
            Global Search Results
          </CardTitle>
          <Badge variant="default" className="text-xs">
            {search.total} {search.total === 1 ? "result" : "results"} across {search.groups.length} {search.groups.length === 1 ? "category" : "categories"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {search.total > 0 ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {search.groups.map((group) => {
              const meta = SECTION_META[group.key] ?? SECTION_META.insights;
              const Icon = meta.icon;

              return (
                <div key={group.key} className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-slate-400" />
                      <p className="text-sm font-black uppercase tracking-[0.22em] text-slate-500">{group.label}</p>
                    </div>
                    <Badge variant={meta.badgeVariant}>{group.items.length}</Badge>
                  </div>

                  <div className="space-y-3">
                    {group.items.map((item) => (
                      <Link
                        key={item.id}
                        href={item.href}
                        className="flex items-start justify-between gap-3 rounded-2xl border border-white bg-white p-4 transition-colors hover:border-[#cdd8ea] hover:bg-[#f8fbff]"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-slate-900">
                            {highlightText(item.title, query ?? search.query)}
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-500">{item.description}</p>
                          {item.metadata && Object.keys(item.metadata).length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {Object.entries(item.metadata).map(([key, value]) => (
                                <span
                                  key={key}
                                  className="inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                                >
                                  {value}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#dde1e6] bg-slate-50/80 p-8 text-center">
            <p className="text-sm font-bold text-slate-900">No matches found for &ldquo;{search.query}&rdquo;.</p>
            <p className="mt-2 text-sm text-slate-500">Try a different spelling, learner code, program name, trainer name, or batch code.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}