"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { searchAction } from "./actions";
import type { DashboardSearchResult, DashboardSearchSection } from "@/types";
import { DashboardSearchResults } from "@/components/modules/dashboard/dashboard-search-results";
import { SearchNotFound } from "@/components/modules/dashboard/search-not-found";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const CATEGORY_LABELS: Partial<Record<DashboardSearchSection, string>> = {
  learners: "Learners",
  batches: "Batches",
  trainers: "Trainers",
  courses: "Courses",
  programs: "Programs",
  assessments: "Assessments",
  curriculum: "Curriculum",
  centres: "Centres",
  course_content: "Content",
  users: "Users",
  learning_resources: "Resources",
  language_lab: "Language Lab",
};

export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const [results, setResults] = useState<DashboardSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<DashboardSearchSection | "all">("all");

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchResults = async () => {
      setLoading(true);
      setError(null);
      setActiveFilter("all");
      try {
        const searchResult = await searchAction({
          query: query.trim(),
        });
        if (!cancelled) {
          setResults(searchResult);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "An error occurred while searching");
          setResults(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchResults();

    return () => {
      cancelled = true;
    };
  }, [query]);

  // Build category counts from results
  const categoryCounts = useMemo(() => {
    if (!results) return new Map<DashboardSearchSection, number>();
    const counts = new Map<DashboardSearchSection, number>();
    for (const group of results.groups) {
      counts.set(group.key, group.items.length);
    }
    return counts;
  }, [results]);

  // Filter results by active category
  const filteredResults = useMemo((): DashboardSearchResult | null => {
    if (!results) return null;
    if (activeFilter === "all") return results;

    const filtered = results.groups.filter((g) => g.key === activeFilter);
    return {
      query: results.query,
      total: filtered.reduce((sum, g) => sum + g.items.length, 0),
      groups: filtered,
    };
  }, [results, activeFilter]);

  if (query.trim().length < 2) {
    return (
      <main className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Search</h1>
          <p className="mt-2 text-slate-500">Find learners, batches, trainers, assessments, curriculum, and more</p>
        </div>

        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="rounded-full bg-slate-100 p-4">
              <Search className="h-8 w-8 text-slate-400" />
            </div>
            <h2 className="mt-6 text-2xl font-bold text-slate-900">Start searching</h2>
            <p className="mt-2 text-center text-slate-500">
              Enter a learner code, learner name, program, batch, assessment, or trainer to find what you&apos;re looking for.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Tip: Press <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px]">Ctrl+K</kbd> to open quick search from anywhere.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Search Results</h1>
        <p className="mt-2 text-slate-500">
          Showing results for <span className="font-semibold text-slate-900">&ldquo;{query}&rdquo;</span>
        </p>
      </div>

      {/* Category filter tabs */}
      {results && results.total > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveFilter("all")}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              activeFilter === "all"
                ? "border-primary bg-primary/5 text-primary"
                : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            All
            <Badge variant="default" className="ml-0.5 px-1.5 text-[10px]">{results.total}</Badge>
          </button>
          {results.groups.map((group) => (
            <button
              key={group.key}
              onClick={() => setActiveFilter(group.key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                activeFilter === group.key
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {CATEGORY_LABELS[group.key] ?? group.label}
              <Badge variant="default" className="ml-0.5 px-1.5 text-[10px]">{group.items.length}</Badge>
            </button>
          ))}
        </div>
      )}

      {error && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="pt-6">
            <p className="text-sm text-rose-800">{error}</p>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-primary"></div>
              <p className="text-sm text-slate-500">Searching across 12 categories...</p>
            </div>
          </CardContent>
        </Card>
      ) : filteredResults && filteredResults.total === 0 && activeFilter === "all" ? (
        <SearchNotFound query={query} />
      ) : filteredResults && filteredResults.total === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-slate-500">No results in this category.</p>
            <button
              onClick={() => setActiveFilter("all")}
              className="mt-2 text-sm font-medium text-primary hover:underline"
            >
              Show all results
            </button>
          </CardContent>
        </Card>
      ) : filteredResults ? (
        <DashboardSearchResults search={filteredResults} query={query} />
      ) : null}
    </main>
  );
}
