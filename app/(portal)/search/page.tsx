"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { searchAction } from "./actions";
import { DashboardSearchResult } from "@/types";
import { DashboardSearchResults } from "@/components/modules/dashboard/dashboard-search-results";
import { SearchNotFound } from "@/components/modules/dashboard/search-not-found";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const [results, setResults] = useState<DashboardSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (query.trim().length < 2) {
    return (
      <main className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Search</h1>
          <p className="mt-2 text-slate-500">Find learners, batches, trainers, and programs</p>
        </div>

        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="rounded-full bg-slate-100 p-4">
              <Search className="h-8 w-8 text-slate-400" />
            </div>
            <h2 className="mt-6 text-2xl font-bold text-slate-900">Start searching</h2>
            <p className="mt-2 text-center text-slate-500">
              Enter a learner code, learner name, program, batch, or trainer to find what you're looking for.
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
          Showing results for <span className="font-semibold text-slate-900">"{query}"</span>
        </p>
      </div>

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
              <p className="text-sm text-slate-500">Searching...</p>
            </div>
          </CardContent>
        </Card>
      ) : results && results.total === 0 ? (
        <SearchNotFound query={query} />
      ) : results ? (
        <DashboardSearchResults search={results} />
      ) : null}
    </main>
  );
}
