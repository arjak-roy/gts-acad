"use client";

import { useCallback, useDeferredValue, useEffect, useState } from "react";
import { Loader2, RefreshCcw, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  LanguageLabAnalyticsFilterOption,
  LanguageLabPronunciationAnalytics,
  LanguageLabRoleplayAnalytics,
  LanguageLabWordProgressAnalytics,
} from "@/lib/language-lab/types";
import { cn } from "@/lib/utils";

type ApiResponse<T> = {
  data?: T;
  error?: string;
};

type AnalyticsFilters = {
  search: string;
  batchId: string;
  learnerId: string;
};

type AnalyticsFilterOptions = {
  batches: LanguageLabAnalyticsFilterOption[];
  learners: LanguageLabAnalyticsFilterOption[];
};

const SELECT_CLASS_NAME =
  "flex h-11 w-full rounded-2xl border border-[#dde1e6] bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84] disabled:cursor-not-allowed disabled:opacity-50";

const EMPTY_ANALYTICS_FILTERS: AnalyticsFilters = {
  search: "",
  batchId: "",
  learnerId: "",
};

const EMPTY_FILTER_OPTIONS: AnalyticsFilterOptions = {
  batches: [],
  learners: [],
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "No activity yet";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "No activity yet";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function formatCompactDate(value: string | null) {
  if (!value) {
    return "No data yet";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "No data yet";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(parsed);
}

function formatMetric(value: number | null, suffix = "") {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }

  const hasFraction = Math.abs(value % 1) > 0.001;
  return `${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: hasFraction ? 1 : 0,
    minimumFractionDigits: hasFraction ? 1 : 0,
  }).format(value)}${suffix}`;
}

function buildQueryString(params: Record<string, string | number | boolean | null | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }

    const normalized = typeof value === "string" ? value.trim() : String(value);
    if (!normalized) {
      continue;
    }

    searchParams.set(key, normalized);
  }

  return searchParams.toString();
}

async function readApi<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { cache: "no-store", ...init });
  const body = (await response.json()) as ApiResponse<T>;

  if (!response.ok || body.data === undefined) {
    throw new Error(body.error ?? "Request failed.");
  }

  return body.data;
}

function scoreTone(value: number | null) {
  if (value === null) {
    return "text-slate-500";
  }

  if (value >= 80) {
    return "text-emerald-700";
  }

  if (value >= 60) {
    return "text-amber-700";
  }

  return "text-rose-700";
}

export function LanguageLabWordProgressPanel() {
  const [analyticsFilters, setAnalyticsFilters] = useState<AnalyticsFilters>(EMPTY_ANALYTICS_FILTERS);
  const [analytics, setAnalytics] = useState<LanguageLabWordProgressAnalytics | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(true);

  const deferredAnalyticsSearch = useDeferredValue(analyticsFilters.search);

  const loadAnalytics = useCallback(async () => {
    setIsAnalyticsLoading(true);
    setAnalyticsError(null);

    try {
      const query = buildQueryString({
        search: deferredAnalyticsSearch,
        batchId: analyticsFilters.batchId,
        learnerId: analyticsFilters.learnerId,
      });

      const nextAnalytics = await readApi<LanguageLabWordProgressAnalytics>(
        `/api/language-lab/analytics/word-progress${query ? `?${query}` : ""}`,
      );
      setAnalytics(nextAnalytics);
    } catch (error) {
      setAnalyticsError(error instanceof Error ? error.message : "Failed to load word progress analytics.");
    } finally {
      setIsAnalyticsLoading(false);
    }
  }, [analyticsFilters.batchId, analyticsFilters.learnerId, deferredAnalyticsSearch]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const filterOptions = analytics?.filterOptions ?? EMPTY_FILTER_OPTIONS;

  return (
    <div className="space-y-6">
      <AnalyticsFiltersCard
        title="Word progress filters"
        description="Tune the analytics by learner or batch. Catalog edits and CSV uploads now live in the Vocab Bank view."
        filters={analyticsFilters}
        filterOptions={filterOptions}
        isLoading={isAnalyticsLoading}
        onFiltersChange={setAnalyticsFilters}
        onReload={() => void loadAnalytics()}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Catalog words"
          value={String(analytics?.overview.catalogWordsCount ?? 0)}
          helper="All managed words matching the current analytics search."
          badge="Catalog"
        />
        <MetricCard
          label="Active words"
          value={String(analytics?.overview.activeWordsCount ?? 0)}
          helper="Words currently exposed to candidate-facing fetches."
          badge="Live"
          badgeVariant="success"
        />
        <MetricCard
          label="Practiced words"
          value={String(analytics?.overview.practicedWordsCount ?? 0)}
          helper="Catalog words with at least one synced pronunciation attempt."
          badge="Practice"
          badgeVariant="info"
        />
        <MetricCard
          label="Unique learners"
          value={String(analytics?.overview.uniqueLearnersCount ?? 0)}
          helper="Candidates represented in the filtered pronunciation data."
          badge="Learners"
        />
        <MetricCard
          label="Average score"
          value={formatMetric(analytics?.overview.averageScore ?? null)}
          helper="Mean pronunciation score across the filtered attempts."
          badge="Score"
          badgeVariant="accent"
        />
        <MetricCard
          label="Last practiced"
          value={formatCompactDate(analytics?.overview.lastPracticedAt ?? null)}
          helper={formatDateTime(analytics?.overview.lastPracticedAt ?? null)}
          badge="Recent"
        />
      </div>

      {analyticsError ? <InlineErrorCard title="Word progress analytics unavailable" message={analyticsError} onRetry={() => void loadAnalytics()} /> : null}

      <Card className="overflow-hidden border-[#d8e1ef] bg-[radial-gradient(circle_at_top_right,rgba(248,154,28,0.08),transparent_30%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
        <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-start lg:justify-between lg:p-7">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">Analytics only</Badge>
              <Badge variant="accent">Vocab Bank owns edits</Badge>
            </div>
            <p className="mt-4 text-2xl font-black tracking-tight text-slate-950">Word Progress now focuses on coverage and learner performance</p>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
              Use this view to inspect which words are being practiced, who is struggling, and where the catalog needs intervention.
              Create, edit, archive, and bulk upload vocabulary in the dedicated Vocab Bank tab.
            </p>
          </div>

          <div className="rounded-[22px] border border-[#dce6f5] bg-white/90 px-5 py-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Management surface</p>
            <p className="mt-2 text-lg font-bold text-slate-950">Vocab Bank</p>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
              Switch to the Vocab Bank view above for CSV imports, manual CRUD, and rollout control.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#d8e1ef] bg-white">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">Live word analytics</Badge>
            <Badge variant="default">Practice coverage</Badge>
          </div>
          <CardTitle className="mt-3 text-2xl font-black tracking-tight text-slate-950">Filtered word progress</CardTitle>
          <CardDescription className="max-w-3xl text-sm font-medium leading-6 text-slate-600">
            Use this table to see which academy-managed words are actually being attempted, who is practicing them, and whether the catalog needs adjustment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isAnalyticsLoading ? (
            <LoadingRows label="Loading word analytics" />
          ) : (analytics?.rows.length ?? 0) === 0 ? (
            <EmptyStateCard
              title="No word analytics yet"
              description="The catalog is live, but there are no pronunciation attempts matching the current filters."
            />
          ) : (
            <div className="overflow-hidden rounded-[24px] border border-[#e5ebf4]">
              <div className="grid grid-cols-[minmax(180px,1.4fr)_100px_100px_100px_100px_140px] gap-3 border-b border-[#e5ebf4] bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                <span>Word</span>
                <span>Attempts</span>
                <span>Learners</span>
                <span>Average</span>
                <span>Best</span>
                <span>Last practiced</span>
              </div>
              <div className="divide-y divide-[#edf2f8]">
                {analytics?.rows.map((row) => (
                  <div key={row.wordId} className="grid grid-cols-[minmax(180px,1.4fr)_100px_100px_100px_100px_140px] gap-3 px-4 py-4 text-sm">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-slate-950">{row.word}</p>
                        <Badge variant={row.isActive ? "success" : "warning"}>{row.isActive ? "Active" : "Inactive"}</Badge>
                      </div>
                      <p className="mt-1 font-medium text-slate-600">
                        {row.englishMeaning || "No meaning"}
                        {row.phonetic ? ` • ${row.phonetic}` : ""}
                      </p>
                    </div>
                    <span className="font-semibold text-slate-700">{row.attemptsCount}</span>
                    <span className="font-semibold text-slate-700">{row.uniqueLearnersCount}</span>
                    <span className={cn("font-black", scoreTone(row.averageScore))}>{formatMetric(row.averageScore)}</span>
                    <span className={cn("font-black", scoreTone(row.bestScore))}>{formatMetric(row.bestScore)}</span>
                    <span className="font-medium text-slate-600">{formatCompactDate(row.lastPracticedAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function LanguageLabPronunciationAnalyticsPanel() {
  const [filters, setFilters] = useState<AnalyticsFilters>(EMPTY_ANALYTICS_FILTERS);
  const [analytics, setAnalytics] = useState<LanguageLabPronunciationAnalytics | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const deferredSearch = useDeferredValue(filters.search);

  const loadAnalytics = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const query = buildQueryString({
        search: deferredSearch,
        batchId: filters.batchId,
        learnerId: filters.learnerId,
      });
      const nextAnalytics = await readApi<LanguageLabPronunciationAnalytics>(
        `/api/language-lab/analytics/pronunciation${query ? `?${query}` : ""}`,
      );
      setAnalytics(nextAnalytics);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load pronunciation analytics.");
    } finally {
      setIsLoading(false);
    }
  }, [deferredSearch, filters.batchId, filters.learnerId]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  return (
    <div className="space-y-6">
      <AnalyticsFiltersCard
        title="Pronunciation attempt filters"
        description="Search weak words, learners, or batches and inspect the real attempt payloads coming from the candidate app."
        filters={filters}
        filterOptions={analytics?.filterOptions ?? EMPTY_FILTER_OPTIONS}
        isLoading={isLoading}
        onFiltersChange={setFilters}
        onReload={() => void loadAnalytics()}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Total attempts" value={String(analytics?.overview.totalAttempts ?? 0)} helper="Stored pronunciation attempts in the current filter window." badge="Attempts" badgeVariant="info" />
        <MetricCard label="Average score" value={formatMetric(analytics?.overview.averageScore ?? null)} helper="Mean score across the filtered attempts." badge="Quality" badgeVariant="accent" />
        <MetricCard label="Low-score attempts" value={String(analytics?.overview.lowScoreAttemptsCount ?? 0)} helper="Attempts scoring below 60." badge="Priority" badgeVariant="warning" />
        <MetricCard label="Unique learners" value={String(analytics?.overview.uniqueLearnersCount ?? 0)} helper="Candidates represented in the attempt set." badge="Learners" />
        <MetricCard label="Unique words" value={String(analytics?.overview.uniqueWordsCount ?? 0)} helper="Distinct practiced words after normalization." badge="Coverage" />
        <MetricCard label="Last attempt" value={formatCompactDate(analytics?.overview.lastAttemptAt ?? null)} helper={formatDateTime(analytics?.overview.lastAttemptAt ?? null)} badge="Recent" />
      </div>

      {errorMessage ? <InlineErrorCard title="Pronunciation analytics unavailable" message={errorMessage} onRetry={() => void loadAnalytics()} /> : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-[#d8e1ef] bg-white">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="warning">Weakest words</Badge>
              <Badge variant="default">Score-based ranking</Badge>
            </div>
            <CardTitle className="mt-3 text-2xl font-black tracking-tight text-slate-950">Words needing intervention</CardTitle>
            <CardDescription className="text-sm font-medium leading-6 text-slate-600">Low-scoring words with enough volume to justify coaching or catalog cleanup.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingRows label="Loading weak-word analysis" />
            ) : (analytics?.weakestWords.length ?? 0) === 0 ? (
              <EmptyStateCard title="No weak-word data yet" description="Pronunciation attempts will populate this ranking once candidates start practicing." />
            ) : (
              <div className="space-y-3">
                {analytics?.weakestWords.map((word) => (
                  <div key={`${word.word}-${word.latestAttemptAt ?? "none"}`} className="rounded-[22px] border border-[#e5ebf4] bg-slate-50 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black tracking-tight text-slate-950">{word.word}</p>
                        <p className="mt-1 text-sm font-medium text-slate-600">{word.englishMeaning || "No English meaning"}</p>
                      </div>
                      <p className={cn("text-lg font-black", scoreTone(word.averageScore))}>{formatMetric(word.averageScore)}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                      <span>{word.attemptsCount} attempts</span>
                      <span>•</span>
                      <span>{formatCompactDate(word.latestAttemptAt)}</span>
                      {word.topPriority ? (
                        <>
                          <span>•</span>
                          <span className="text-amber-700">Top priority: {word.topPriority}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-[#d8e1ef] bg-white">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="accent">Priority themes</Badge>
              <Badge variant="default">Coachable patterns</Badge>
            </div>
            <CardTitle className="mt-3 text-2xl font-black tracking-tight text-slate-950">Coaching themes surfacing most often</CardTitle>
            <CardDescription className="text-sm font-medium leading-6 text-slate-600">These priorities come directly from the stored learner feedback, not a presentation-only ruleset.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <LoadingRows label="Loading priority themes" />
            ) : (analytics?.priorityThemes.length ?? 0) === 0 ? (
              <EmptyStateCard title="No priority themes yet" description="Coaching labels appear here after attempts sync their strengths and priorities." />
            ) : (
              analytics?.priorityThemes.map((theme, index) => {
                const maxCount = analytics.priorityThemes[0]?.count ?? 1;
                const width = Math.max(12, Math.round((theme.count / maxCount) * 100));

                return (
                  <div key={theme.label} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-slate-900">{theme.label}</p>
                      <Badge variant={index === 0 ? "accent" : "default"}>{theme.count}</Badge>
                    </div>
                    <div className="h-3 rounded-full bg-slate-100">
                      <div className="h-3 rounded-full bg-[linear-gradient(90deg,#0d3b84_0%,#f89a1c_100%)]" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })
            )}

            <div className="rounded-[22px] border border-[#e9eef5] bg-slate-50 px-4 py-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#f89a1c]" />
                <p className="text-sm font-bold text-slate-900">Phoneme hotspots</p>
              </div>
              <div className="mt-4 grid gap-3">
                {isLoading ? (
                  <LoadingRows label="Loading phoneme hotspots" compact />
                ) : (analytics?.phonemeHotspots.length ?? 0) === 0 ? (
                  <p className="text-sm font-medium text-slate-500">No phoneme breakdown has been synced yet.</p>
                ) : (
                  analytics?.phonemeHotspots.map((spot) => (
                    <div key={spot.phoneme} className="grid grid-cols-[80px_1fr_1fr_1fr] gap-2 text-sm">
                      <p className="font-black text-slate-950">{spot.phoneme}</p>
                      <p className="font-semibold text-rose-700">{spot.incorrectCount} incorrect</p>
                      <p className="font-semibold text-amber-700">{spot.partialCount} partial</p>
                      <p className="font-semibold text-emerald-700">{spot.correctCount} correct</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#d8e1ef] bg-white">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">Latest attempts</Badge>
            <Badge variant="default">Stored learner payloads</Badge>
          </div>
          <CardTitle className="mt-3 text-2xl font-black tracking-tight text-slate-950">Recent pronunciation submissions</CardTitle>
          <CardDescription className="text-sm font-medium leading-6 text-slate-600">Review what learners heard, how the model scored them, and what coaching prompt was returned most recently.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingRows label="Loading recent attempts" />
          ) : (analytics?.latestAttempts.length ?? 0) === 0 ? (
            <EmptyStateCard title="No pronunciation attempts yet" description="As soon as the app syncs attempts, they will appear here with their learner, score, and coaching metadata." />
          ) : (
            <div className="space-y-3">
              {analytics?.latestAttempts.map((attempt) => (
                <div key={attempt.id} className="rounded-[24px] border border-[#e5ebf4] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-black tracking-tight text-slate-950">{attempt.word}</p>
                        <Badge variant="info">{attempt.batchCode}</Badge>
                        <Badge variant="default">{attempt.learnerCode}</Badge>
                      </div>
                      <p className="mt-1 text-sm font-medium text-slate-600">
                        {attempt.learnerName} • {attempt.batchName}
                      </p>
                      <p className="mt-2 text-sm font-medium text-slate-600">
                        {attempt.englishMeaning || "No meaning"}
                        {attempt.phonetic ? ` • ${attempt.phonetic}` : ""}
                      </p>
                    </div>
                    <p className={cn("text-2xl font-black", scoreTone(attempt.score))}>{formatMetric(attempt.score)}</p>
                  </div>

                  <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_1fr]">
                    <DetailBlock label="Heard text" value={attempt.heardText || "No ASR text recorded."} />
                    <DetailBlock
                      label="Next try instruction"
                      value={attempt.nextTryInstruction || "No follow-up instruction recorded."}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {attempt.priorities.length > 0 ? attempt.priorities.map((priority) => <Badge key={priority} variant="warning">{priority}</Badge>) : <Badge variant="default">No priorities</Badge>}
                    {attempt.strengths.length > 0 ? attempt.strengths.map((strength) => <Badge key={strength} variant="success">{strength}</Badge>) : null}
                  </div>

                  <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{formatDateTime(attempt.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function LanguageLabRoleplayAnalyticsPanel() {
  const [filters, setFilters] = useState<AnalyticsFilters>(EMPTY_ANALYTICS_FILTERS);
  const [analytics, setAnalytics] = useState<LanguageLabRoleplayAnalytics | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const deferredSearch = useDeferredValue(filters.search);

  const loadAnalytics = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const query = buildQueryString({
        search: deferredSearch,
        batchId: filters.batchId,
        learnerId: filters.learnerId,
      });
      const nextAnalytics = await readApi<LanguageLabRoleplayAnalytics>(
        `/api/language-lab/analytics/roleplay${query ? `?${query}` : ""}`,
      );
      setAnalytics(nextAnalytics);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load roleplay analytics.");
    } finally {
      setIsLoading(false);
    }
  }, [deferredSearch, filters.batchId, filters.learnerId]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  return (
    <div className="space-y-6">
      <AnalyticsFiltersCard
        title="Roleplay session filters"
        description="Review live Bread Shop and other scenario sessions by batch or learner without relying on mock scorecards."
        filters={filters}
        filterOptions={analytics?.filterOptions ?? EMPTY_FILTER_OPTIONS}
        isLoading={isLoading}
        onFiltersChange={setFilters}
        onReload={() => void loadAnalytics()}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Sessions" value={String(analytics?.overview.totalSessions ?? 0)} helper="Stored roleplay sessions matching the current filters." badge="Sessions" badgeVariant="info" />
        <MetricCard label="Completion rate" value={formatMetric(analytics?.overview.completionRate ?? 0, "%")} helper="Percentage of sessions that ended with a completed deal." badge="Outcome" badgeVariant="accent" />
        <MetricCard label="Average spend" value={`EUR ${formatMetric(analytics?.overview.averageSpendEur ?? 0)}`} helper="Mean spend per filtered session." badge="Spend" />
        <MetricCard label="Average turns" value={formatMetric(analytics?.overview.averageTurns ?? 0)} helper="Conversation length across the selected sessions." badge="Turns" />
        <MetricCard label="Unique learners" value={String(analytics?.overview.uniqueLearnersCount ?? 0)} helper="Candidates represented in the roleplay dataset." badge="Learners" />
        <MetricCard label="Last session" value={formatCompactDate(analytics?.overview.lastOccurredAt ?? null)} helper={formatDateTime(analytics?.overview.lastOccurredAt ?? null)} badge="Recent" />
      </div>

      {errorMessage ? <InlineErrorCard title="Roleplay analytics unavailable" message={errorMessage} onRetry={() => void loadAnalytics()} /> : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-[#d8e1ef] bg-white">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="accent">Scenario breakdown</Badge>
              <Badge variant="default">Real session summaries</Badge>
            </div>
            <CardTitle className="mt-3 text-2xl font-black tracking-tight text-slate-950">Scenario performance</CardTitle>
            <CardDescription className="text-sm font-medium leading-6 text-slate-600">Compare completion rate, spend, and session length across the recorded roleplay scenarios.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingRows label="Loading scenario breakdown" />
            ) : (analytics?.scenarioBreakdown.length ?? 0) === 0 ? (
              <EmptyStateCard title="No scenario data yet" description="Scenario analytics will appear once the candidate app syncs its roleplay summaries." />
            ) : (
              <div className="space-y-3">
                {analytics?.scenarioBreakdown.map((scenario) => (
                  <div key={scenario.scenarioName} className="rounded-[22px] border border-[#e5ebf4] bg-slate-50 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black tracking-tight text-slate-950">{scenario.scenarioName}</p>
                        <p className="mt-1 text-sm font-medium text-slate-600">{scenario.sessionsCount} sessions • {formatCompactDate(scenario.lastOccurredAt)}</p>
                      </div>
                      <Badge variant="info">{formatMetric(scenario.completionRate, "%")}</Badge>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <MiniStat label="Average spend" value={`EUR ${formatMetric(scenario.averageSpendEur)}`} />
                      <MiniStat label="Average turns" value={formatMetric(scenario.averageTurns)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-[#d8e1ef] bg-white">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="warning">Learner highlights</Badge>
              <Badge variant="default">Drill-down by candidate</Badge>
            </div>
            <CardTitle className="mt-3 text-2xl font-black tracking-tight text-slate-950">Who is engaging most</CardTitle>
            <CardDescription className="text-sm font-medium leading-6 text-slate-600">Spot learners with repeated roleplay use, completion issues, or high-spend patterns.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingRows label="Loading learner highlights" />
            ) : (analytics?.learnerHighlights.length ?? 0) === 0 ? (
              <EmptyStateCard title="No learner highlights yet" description="Once sessions sync, learner-level roleplay summaries will show up here." />
            ) : (
              <div className="space-y-3">
                {analytics?.learnerHighlights.map((learner) => (
                  <div key={learner.learnerId} className="rounded-[22px] border border-[#e5ebf4] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-4 py-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-black tracking-tight text-slate-950">{learner.learnerName}</p>
                          <Badge variant="default">{learner.learnerCode}</Badge>
                          <Badge variant="info">{learner.batchCode}</Badge>
                        </div>
                        <p className="mt-1 text-sm font-medium text-slate-600">{learner.batchName}</p>
                      </div>
                      <Badge variant="accent">{learner.sessionsCount} sessions</Badge>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <MiniStat label="Completion" value={formatMetric(learner.completionRate, "%")} />
                      <MiniStat label="Average spend" value={`EUR ${formatMetric(learner.averageSpendEur)}`} />
                      <MiniStat label="Latest" value={formatCompactDate(learner.latestOccurredAt)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#d8e1ef] bg-white">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">Latest sessions</Badge>
            <Badge variant="default">Roleplay payload stream</Badge>
          </div>
          <CardTitle className="mt-3 text-2xl font-black tracking-tight text-slate-950">Recent roleplay summaries</CardTitle>
          <CardDescription className="text-sm font-medium leading-6 text-slate-600">These are the stored sessions arriving from the candidate Bread Shop flow and related scenarios.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingRows label="Loading latest roleplay sessions" />
          ) : (analytics?.latestSessions.length ?? 0) === 0 ? (
            <EmptyStateCard title="No synced roleplay sessions yet" description="Once roleplay summaries reach the academy backend, they will populate this stream automatically." />
          ) : (
            <div className="space-y-3">
              {analytics?.latestSessions.map((session) => (
                <div key={session.id} className="rounded-[24px] border border-[#e5ebf4] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-black tracking-tight text-slate-950">{session.scenarioName}</p>
                        <Badge variant={session.dealComplete ? "success" : session.missionFailed ? "danger" : "warning"}>
                          {session.dealComplete ? "Completed" : session.missionFailed ? "Failed" : "In progress"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm font-medium text-slate-600">
                        {session.learnerName} ({session.learnerCode}) • {session.batchName}
                      </p>
                    </div>
                    <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">{formatDateTime(session.occurredAt)}</p>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <MiniStat label="Budget" value={`EUR ${formatMetric(session.budgetEur)}`} />
                    <MiniStat label="Spent" value={`EUR ${formatMetric(session.totalSpentEur)}`} />
                    <MiniStat label="Deals" value={String(session.acceptedDeals)} />
                    <MiniStat label="Transactions" value={String(session.transactionCount)} />
                    <MiniStat label="Turns" value={String(session.turnCount)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AnalyticsFiltersCard({
  title,
  description,
  filters,
  filterOptions,
  isLoading,
  onFiltersChange,
  onReload,
}: {
  title: string;
  description: string;
  filters: AnalyticsFilters;
  filterOptions: AnalyticsFilterOptions;
  isLoading: boolean;
  onFiltersChange: (next: AnalyticsFilters) => void;
  onReload: () => void;
}) {
  return (
    <Card className="border-[#d8e1ef] bg-white">
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">Live filters</Badge>
              <Badge variant="default">Read-side analytics</Badge>
            </div>
            <CardTitle className="mt-3 text-2xl font-black tracking-tight text-slate-950">{title}</CardTitle>
            <CardDescription className="max-w-3xl text-sm font-medium leading-6 text-slate-600">{description}</CardDescription>
          </div>

          <Button type="button" variant="secondary" onClick={onReload} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_220px]">
          <Input
            value={filters.search}
            onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
            placeholder="Search learner, batch, word, or scenario"
          />
          <select
            className={SELECT_CLASS_NAME}
            value={filters.batchId}
            onChange={(event) => onFiltersChange({ ...filters, batchId: event.target.value })}
          >
            <option value="">All batches</option>
            {filterOptions.batches.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
                {option.detail ? ` • ${option.detail}` : ""}
              </option>
            ))}
          </select>
          <select
            className={SELECT_CLASS_NAME}
            value={filters.learnerId}
            onChange={(event) => onFiltersChange({ ...filters, learnerId: event.target.value })}
          >
            <option value="">All learners</option>
            {filterOptions.learners.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
                {option.detail ? ` • ${option.detail}` : ""}
              </option>
            ))}
          </select>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCard({
  label,
  value,
  helper,
  badge,
  badgeVariant = "default",
}: {
  label: string;
  value: string;
  helper: string;
  badge: string;
  badgeVariant?: "default" | "success" | "warning" | "danger" | "info" | "accent";
}) {
  return (
    <Card className="border-[#d8e1ef] bg-white">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
          <Badge variant={badgeVariant}>{badge}</Badge>
        </div>
        <p className="text-3xl font-black tracking-tight text-slate-950">{value}</p>
        <p className="text-sm font-medium leading-6 text-slate-600">{helper}</p>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#e5ebf4] bg-white px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-[#e5ebf4] bg-slate-50 px-4 py-4">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-700">{value}</p>
    </div>
  );
}

function LoadingRows({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-[22px] border border-[#e5ebf4] bg-slate-50 px-4 py-4", compact ? "text-sm" : "text-base")}>
      <Loader2 className="h-4 w-4 animate-spin text-[#0d3b84]" />
      <p className="font-medium text-slate-600">{label}</p>
    </div>
  );
}

function EmptyStateCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-[#d4dfef] bg-slate-50 px-5 py-6">
      <p className="text-lg font-black tracking-tight text-slate-950">{title}</p>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function InlineErrorCard({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.16em] text-rose-700">{title}</p>
          <p className="mt-1 text-sm font-medium leading-6 text-rose-900">{message}</p>
        </div>
        <Button type="button" variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      </div>
    </div>
  );
}
