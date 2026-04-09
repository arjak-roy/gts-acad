"use client";

import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Headphones,
  Languages,
  MessageSquare,
  Mic,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Volume2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FlexibleCardGrid, FlexibleCardItem } from "@/components/ui/flexible-card-layout";
import { cn } from "@/lib/utils";

import { LANGUAGE_LAB_BATCHES, type LanguageLabBatch, type LanguageLabTone } from "./mock-data";

type LanguageLabSectionProps = {
  title: string;
  description: string;
};

type LanguageLabView = "overview" | "pronunciation" | "roleplay" | "vocabulary";
type LanguageLabPeriod = "4w" | "8w" | "cohort";

const VIEW_OPTIONS: Array<{ id: LanguageLabView; label: string; detail: string }> = [
  { id: "overview", label: "Overview", detail: "Executive pulse and readiness" },
  { id: "pronunciation", label: "Pronunciation Analytics", detail: "Word-wise precision and phoneme cues" },
  { id: "roleplay", label: "Roleplay Lab", detail: "Scenario attempts, AI scoring, and tries" },
  { id: "vocabulary", label: "Vocabulary and Listening", detail: "Phrase mastery, dictation, and confidence" },
];

const PERIOD_OPTIONS: Array<{ id: LanguageLabPeriod; label: string }> = [
  { id: "4w", label: "4 Weeks" },
  { id: "8w", label: "8 Weeks" },
  { id: "cohort", label: "This Cohort" },
];

const tonePalette: Record<LanguageLabTone, { badge: "info" | "accent" | "success" | "warning" | "danger"; barClass: string; fill: string; inkClass: string }> = {
  info: { badge: "info", barClass: "bg-[#0d3b84]", fill: "#0d3b84", inkClass: "text-[#0d3b84]" },
  accent: { badge: "accent", barClass: "bg-[#f89a1c]", fill: "#f89a1c", inkClass: "text-[#d77f10]" },
  success: { badge: "success", barClass: "bg-emerald-500", fill: "#10b981", inkClass: "text-emerald-700" },
  warning: { badge: "warning", barClass: "bg-amber-500", fill: "#f59e0b", inkClass: "text-amber-700" },
  danger: { badge: "danger", barClass: "bg-rose-500", fill: "#f43f5e", inkClass: "text-rose-700" },
};

function getDisplayedRoleplayPoints(batch: LanguageLabBatch, period: LanguageLabPeriod) {
  if (period === "4w") {
    return batch.weeklyRoleplay.slice(-4);
  }

  if (period === "8w") {
    return batch.weeklyRoleplay.slice(-8);
  }

  return batch.weeklyRoleplay;
}

function formatPercent(value: number) {
  return `${value}%`;
}

function formatDelta(value: number) {
  return `${value >= 0 ? "+" : ""}${value} pts`;
}

function formatNumber(value: number) {
  return value.toLocaleString("en-IN");
}

function buildSparklinePoints(values: number[]) {
  if (values.length === 0) {
    return "";
  }

  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const range = Math.max(1, maxValue - minValue);

  return values
    .map((value, index) => {
      const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
      const y = 38 - ((value - minValue) / range) * 28;
      return `${x},${y}`;
    })
    .join(" ");
}

function buildAreaPath(values: number[]) {
  const polylinePoints = buildSparklinePoints(values);
  if (!polylinePoints) {
    return "";
  }

  return `M 0 40 L ${polylinePoints.replace(/ /g, " L ")} L 100 40 Z`;
}

function getScoreTone(score: number): LanguageLabTone {
  if (score >= 88) {
    return "success";
  }

  if (score >= 80) {
    return "info";
  }

  if (score >= 72) {
    return "warning";
  }

  return "danger";
}

function SectionToggleButton({
  isActive,
  label,
  detail,
  onClick,
}: {
  isActive: boolean;
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border px-4 py-4 text-left transition-colors",
        isActive
          ? "border-[#0d3b84] bg-[#edf4ff] shadow-sm"
          : "border-[#dde1e6] bg-white hover:border-[#c8d4e3] hover:bg-slate-50",
      )}
    >
      <p className={cn("text-sm font-black tracking-tight", isActive ? "text-[#0d3b84]" : "text-slate-900")}>{label}</p>
      <p className="mt-1 text-xs font-medium text-slate-500">{detail}</p>
    </button>
  );
}

function PeriodPill({ isActive, label, onClick }: { isActive: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3.5 py-2 text-xs font-black uppercase tracking-[0.2em] transition-colors",
        isActive ? "bg-[#0d3b84] text-white" : "bg-white text-slate-500 ring-1 ring-[#dde1e6] hover:bg-slate-50",
      )}
    >
      {label}
    </button>
  );
}

function ScoreRing({ label, value, helper }: { label: string; value: number; helper: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/80 p-4 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <div
          className="relative h-20 w-20 rounded-full"
          style={{ background: `conic-gradient(#0d3b84 ${value}%, #dbe7fb 0)` }}
        >
          <div className="absolute inset-2 rounded-full bg-white" />
          <div className="absolute inset-0 flex items-center justify-center text-center">
            <div>
              <p className="text-xl font-black tracking-tight text-slate-950">{value}</p>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">score</p>
            </div>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{label}</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{helper}</p>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "info",
}: {
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone?: LanguageLabTone;
}) {
  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase leading-4 tracking-[0.2em] text-slate-400 break-words">{label}</p>
            <p className="mt-2 break-words text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{value}</p>
          </div>
          <div className={cn("rounded-2xl p-3", tone === "accent" ? "bg-orange-50" : tone === "success" ? "bg-emerald-50" : tone === "warning" ? "bg-amber-50" : tone === "danger" ? "bg-rose-50" : "bg-blue-50")}>
            <Icon className={cn("h-5 w-5", tonePalette[tone].inkClass)} />
          </div>
        </div>
        <p className="break-words text-xs font-semibold leading-5 text-slate-500">{helper}</p>
      </CardContent>
    </Card>
  );
}

function PercentageBar({ label, value, helper, tone = "info" }: { label: string; value: number; helper?: string; tone?: LanguageLabTone }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className={cn("text-sm font-black", tonePalette[tone].inkClass)}>{value}%</p>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full", tonePalette[tone].barClass)} style={{ width: `${value}%` }} />
      </div>
      {helper ? <p className="text-xs font-medium text-slate-500">{helper}</p> : null}
    </div>
  );
}

function Sparkline({ values, tone = "info" }: { values: number[]; tone?: LanguageLabTone }) {
  const stroke = tonePalette[tone].fill;
  const areaPath = buildAreaPath(values);
  const polylinePoints = buildSparklinePoints(values);

  return (
    <svg viewBox="0 0 100 40" className="h-12 w-full overflow-visible">
      <path d={areaPath} fill={stroke} opacity="0.12" />
      <polyline fill="none" stroke={stroke} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={polylinePoints} />
    </svg>
  );
}

function WeeklySessionChart({ points }: { points: LanguageLabBatch["weeklyRoleplay"] }) {
  const maxSessions = Math.max(...points.map((point) => point.sessions), 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400 sm:grid-cols-6">
        <div>Week</div>
        <div>Sessions</div>
        <div className="col-span-2">Volume</div>
        <div className="col-span-2">AI Avg</div>
      </div>
      <div className="space-y-3">
        {points.map((point) => {
          const barWidth = `${(point.sessions / maxSessions) * 100}%`;
          return (
            <div key={point.label} className="grid items-center gap-2 rounded-2xl border border-[#edf1f5] bg-slate-50 px-3 py-3 sm:grid-cols-6">
              <p className="text-sm font-black text-slate-900">{point.label}</p>
              <p className="text-sm font-semibold text-slate-500">{point.sessions}</p>
              <div className="sm:col-span-2">
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-[#0d3b84]" style={{ width: barWidth }} />
                </div>
              </div>
              <div className="sm:col-span-2 flex items-center gap-3">
                <div className="min-w-[56px] rounded-full bg-white px-3 py-1 text-center text-xs font-black text-[#0d3b84] ring-1 ring-[#d9e5f7]">
                  {point.avgScore}
                </div>
                <div className="flex-1 text-xs font-medium text-slate-500">Roleplay quality improved steadily through the mock cycle.</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConfidenceMatrix({ points }: { points: LanguageLabBatch["confidenceMatrix"] }) {
  return (
    <div className="space-y-4">
      <div className="relative h-[260px] rounded-2xl border border-[#e8edf3] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5">
        <div className="absolute inset-x-5 bottom-5 top-5">
          <div className="absolute inset-0 rounded-2xl border border-dashed border-[#dce6f5]" />
          <div className="absolute inset-x-0 top-1/2 h-px bg-dashed bg-[#dce6f5]" />
          <div className="absolute inset-y-0 left-1/2 w-px bg-dashed bg-[#dce6f5]" />
          {points.map((point) => (
            <div
              key={point.label}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2"
              style={{ left: `${point.x}%`, top: `${100 - point.y}%` }}
            >
              <div
                className={cn(
                  "rounded-full border-4 border-white shadow-lg",
                  point.tone === "accent"
                    ? "bg-orange-400"
                    : point.tone === "success"
                      ? "bg-emerald-500"
                      : point.tone === "warning"
                        ? "bg-amber-400"
                        : point.tone === "danger"
                          ? "bg-rose-500"
                          : "bg-[#0d3b84]",
                )}
                style={{ width: `${point.size * 2}px`, height: `${point.size * 2}px` }}
              />
              <div className="rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 shadow-sm ring-1 ring-[#e5ecf6]">
                {point.label}
              </div>
            </div>
          ))}
        </div>
        <p className="absolute left-4 top-4 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Accuracy</p>
        <p className="absolute bottom-4 right-4 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Confidence</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {points.map((point) => (
          <div key={point.label} className="rounded-2xl border border-[#edf1f5] bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">{point.label}</p>
              <Badge variant={tonePalette[point.tone].badge}>{point.x}/{point.y}</Badge>
            </div>
            <p className="mt-2 text-xs font-medium text-slate-500">Confidence {point.x}% against accuracy {point.y}%.</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function OverviewPanel({ batch, period }: { batch: LanguageLabBatch; period: LanguageLabPeriod }) {
  const displayedPoints = getDisplayedRoleplayPoints(batch, period);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Sessions This Week" value={formatNumber(batch.overview.sessionsThisWeek)} helper={`${batch.overview.activeRoleplays} active scenarios in the current preset`} icon={Activity} tone="info" />
        <MetricCard label="Avg Pronunciation" value={formatPercent(batch.overview.avgPronunciation)} helper="Word-level AI scoring across the selected batch" icon={Mic} tone="success" />
        <MetricCard label="Avg Roleplay AI" value={formatPercent(batch.overview.avgRoleplay)} helper="Scenario completion, vocabulary, and fluency combined" icon={MessageSquare} tone="accent" />
        <MetricCard label="Listening Accuracy" value={formatPercent(batch.overview.listeningAccuracy)} helper="Latest dictation and playback checkpoint accuracy" icon={Headphones} tone="info" />
        <MetricCard label="Phrase Mastery" value={formatPercent(batch.overview.phraseMastery)} helper="Reusable phrases completed with stable repetition" icon={Languages} tone="warning" />
        <MetricCard label="Flagged Learners" value={formatNumber(batch.overview.flaggedLearners)} helper={`${batch.overview.totalLearners} learners in the mock cohort`} icon={ShieldAlert} tone="danger" />
      </div>

      <FlexibleCardGrid preset="balanced">
        <FlexibleCardItem span="hero" minHeightClassName="min-h-[320px]">
          <Card className="h-full overflow-hidden border-[#d7e3f4] bg-[radial-gradient(circle_at_top_left,rgba(13,59,132,0.18),transparent_42%),linear-gradient(135deg,#ffffff_0%,#f6f9ff_56%,#eef4ff_100%)]">
            <CardContent className="grid h-full gap-6 p-6 lg:grid-cols-[1.25fr_0.75fr] lg:p-8">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="info">Language intelligence preview</Badge>
                  <Badge variant="accent">{batch.track}</Badge>
                  <Badge variant="success">{batch.snapshotLabel}</Badge>
                </div>
                <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">Batch pulse for {batch.name}</h2>
                <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-600">{batch.summary}</p>

                <div className="mt-6 grid gap-4 lg:grid-cols-3">
                  <ScoreRing label="Pronunciation" value={batch.overview.avgPronunciation} helper="Word-level fidelity and stress control" />
                  <ScoreRing label="Roleplay" value={batch.overview.avgRoleplay} helper="Scenario flow, turn-taking, and completion" />
                  <ScoreRing label="Listening" value={batch.overview.listeningAccuracy} helper="Playback accuracy and dictation readiness" />
                </div>
              </div>

              <div className="rounded-[28px] border border-[#dce6f5] bg-white/85 p-6 shadow-sm backdrop-blur-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Command notes</p>
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Coach</p>
                    <p className="mt-1 text-lg font-bold text-slate-950">{batch.coach}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Streak sessions</p>
                    <p className="mt-1 text-lg font-bold text-slate-950">{batch.overview.streakSessions}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Flagged learners</p>
                    <p className="mt-1 text-lg font-bold text-slate-950">{batch.overview.flaggedLearners} / {batch.overview.totalLearners}</p>
                  </div>
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 text-sm font-semibold text-[#0d3b84]">
                    {period === "cohort" ? "Showing the full mock cohort snapshot." : `Showing a ${period === "4w" ? "4-week" : "8-week"} preview slice.`}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </FlexibleCardItem>

        <FlexibleCardItem span="wide" minHeightClassName="min-h-[340px]">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Roleplay volume and AI quality</CardTitle>
              <CardDescription>Static session volume with an AI score lane for the selected mock period.</CardDescription>
            </CardHeader>
            <CardContent>
              <WeeklySessionChart points={displayedPoints} />
            </CardContent>
          </Card>
        </FlexibleCardItem>

        <FlexibleCardItem minHeightClassName="min-h-[340px]">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Pronunciation category mix</CardTitle>
              <CardDescription>Batch-level AI scoring by correction theme.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {batch.pronunciationCategories.map((category) => (
                <div key={category.label} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{category.label}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant={tonePalette[category.tone].badge}>{category.score}</Badge>
                      <span className={cn("text-xs font-black uppercase tracking-[0.18em]", tonePalette[category.tone].inkClass)}>{formatDelta(category.delta)}</span>
                    </div>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={cn("h-full rounded-full", tonePalette[category.tone].barClass)} style={{ width: `${category.score}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </FlexibleCardItem>

        <FlexibleCardItem minHeightClassName="min-h-[340px]">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>CEFR readiness ladder</CardTitle>
              <CardDescription>Where the cohort sits today in the mock language progression.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {batch.cefrReadiness.map((level, index) => {
                const width = `${Math.max(28, 100 - index * 14)}%`;
                return (
                  <div key={level.label} className="rounded-2xl border border-[#edf1f5] bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-slate-900">{level.label}</p>
                      <Badge variant={index > 1 ? "success" : index === 1 ? "accent" : "info"}>{level.learners} learners</Badge>
                    </div>
                    <div className="mt-3 h-3 overflow-hidden rounded-full bg-white ring-1 ring-[#e3e9f1]">
                      <div className={cn("h-full rounded-full", index > 1 ? "bg-emerald-500" : index === 1 ? "bg-[#f89a1c]" : "bg-[#0d3b84]")} style={{ width }} />
                    </div>
                    <p className="mt-2 text-xs font-medium text-slate-500">{level.target}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </FlexibleCardItem>

        <FlexibleCardItem span="wide" minHeightClassName="min-h-[300px]">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Common language blockers</CardTitle>
              <CardDescription>The coaching topics that still create hesitation in the selected batch.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {batch.blockers.map((blocker, index) => (
                <div key={blocker.label} className="rounded-2xl border border-[#edf1f5] bg-slate-50 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{blocker.label}</p>
                      <p className="mt-1 text-xs font-medium text-slate-500">{blocker.note}</p>
                    </div>
                    <div className="min-w-[74px] rounded-full bg-white px-3 py-1 text-center text-xs font-black text-slate-700 ring-1 ring-[#dde5ef]">
                      {blocker.share}%
                    </div>
                  </div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white ring-1 ring-[#e6edf5]">
                    <div className={cn("h-full rounded-full", index === 0 ? "bg-rose-500" : index === 1 ? "bg-amber-500" : "bg-[#0d3b84]")} style={{ width: `${blocker.share}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </FlexibleCardItem>

        <FlexibleCardItem minHeightClassName="min-h-[300px]">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Learner spotlight</CardTitle>
              <CardDescription>One mocked highlight card for stakeholder demos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#0d3b84]">Featured learner</p>
                <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{batch.spotlight.learner}</p>
                <p className="mt-1 text-sm font-semibold text-slate-600">{batch.spotlight.focus}</p>
              </div>
              <div className="rounded-2xl border border-[#edf1f5] bg-slate-50 px-4 py-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Momentum</p>
                <p className="mt-2 text-lg font-bold text-slate-950">{batch.spotlight.improvement}</p>
                <p className="mt-2 text-xs font-medium text-slate-500">Last session: {batch.spotlight.lastSession}</p>
              </div>
              <p className="text-sm font-medium leading-6 text-slate-600">{batch.spotlight.note}</p>
            </CardContent>
          </Card>
        </FlexibleCardItem>
      </FlexibleCardGrid>
    </div>
  );
}

function PronunciationPanel({ batch }: { batch: LanguageLabBatch }) {
  const mostImprovedWords = useMemo(
    () =>
      [...batch.pronunciationWords]
        .sort((left, right) => (right.trend[right.trend.length - 1] - right.trend[0]) - (left.trend[left.trend.length - 1] - left.trend[0]))
        .slice(0, 3),
    [batch.pronunciationWords],
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Batch Avg" value={formatPercent(batch.overview.avgPronunciation)} helper="Across all tracked word drills" icon={Mic} tone="success" />
        <MetricCard label="Words Tracked" value={formatNumber(batch.pronunciationWords.length)} helper="Curated words on the current mock scorecard" icon={Languages} tone="info" />
        <MetricCard label="Top Best Score" value={formatPercent(Math.max(...batch.pronunciationWords.map((word) => word.bestScore)))} helper="Strongest single word attempt in the batch" icon={ArrowUpRight} tone="accent" />
        <MetricCard label="Hotspot Alerts" value={formatNumber(batch.phonemeHotspots.length)} helper="Current phoneme clusters flagged by the AI reviewer" icon={ShieldAlert} tone="warning" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {batch.pronunciationWords.map((word) => {
          const tone = getScoreTone(word.bestScore);
          return (
            <Card key={word.word} className="overflow-hidden">
              <CardContent className="space-y-5 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={tonePalette[tone].badge}>Word drill</Badge>
                      <Badge variant="default">{word.context}</Badge>
                    </div>
                    <h3 className="mt-3 text-2xl font-black tracking-tight text-slate-950">{word.word}</h3>
                    <p className="mt-1 text-sm font-medium text-slate-500">{word.aiTag}</p>
                  </div>
                  <div className="rounded-2xl border border-[#e8edf4] bg-slate-50 px-4 py-3 text-right">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Best score</p>
                    <p className="mt-1 text-2xl font-black tracking-tight text-slate-950">{word.bestScore}</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Tries</p>
                    <p className="mt-1 text-lg font-bold text-slate-950">{word.tries}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Average</p>
                    <p className="mt-1 text-lg font-bold text-slate-950">{word.averageScore}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Consistency</p>
                    <p className="mt-1 text-lg font-bold text-slate-950">{word.consistency}%</p>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1fr_160px]">
                  <div className="space-y-4">
                    <PercentageBar label="Stress accuracy" value={word.stressAccuracy} tone={word.stressAccuracy >= 85 ? "success" : "info"} />
                    <PercentageBar label="Vowel length control" value={word.vowelLength} tone={word.vowelLength >= 80 ? "success" : word.vowelLength >= 72 ? "warning" : "danger"} />
                  </div>
                  <div className="rounded-2xl border border-[#edf1f5] bg-slate-50 px-4 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Trend</p>
                    <Sparkline values={word.trend} tone={tone} />
                    <p className="mt-2 text-xs font-medium text-slate-500">Latest improvement: +{word.trend[word.trend.length - 1] - word.trend[0]} pts over the mock cycle.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <FlexibleCardGrid preset="balanced">
        <FlexibleCardItem minHeightClassName="min-h-[320px]">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Phoneme and cluster hotspots</CardTitle>
              <CardDescription>Static AI guidance on which sounds still distort the batch average.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {batch.phonemeHotspots.map((hotspot) => (
                <PercentageBar key={hotspot.label} label={hotspot.label} value={hotspot.score} helper={hotspot.issue} tone={hotspot.score >= 76 ? "success" : hotspot.score >= 68 ? "warning" : "danger"} />
              ))}
            </CardContent>
          </Card>
        </FlexibleCardItem>

        <FlexibleCardItem minHeightClassName="min-h-[320px]">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Pronunciation score bands</CardTitle>
              <CardDescription>Mock learner distribution for presentation mode.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {batch.pronunciationScoreBands.map((band, index) => {
                const maxLearners = Math.max(...batch.pronunciationScoreBands.map((entry) => entry.learners), 1);
                const width = `${(band.learners / maxLearners) * 100}%`;
                return (
                  <div key={band.label} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{band.label}</p>
                      <Badge variant={index === 0 ? "success" : index === batch.pronunciationScoreBands.length - 1 ? "danger" : "info"}>{band.learners} learners</Badge>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div className={cn("h-full rounded-full", index === 0 ? "bg-emerald-500" : index === batch.pronunciationScoreBands.length - 1 ? "bg-rose-500" : "bg-[#0d3b84]")} style={{ width }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </FlexibleCardItem>

        <FlexibleCardItem span="wide" minHeightClassName="min-h-[320px]">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Most improved words</CardTitle>
              <CardDescription>Quick executive proof that the mock UI can show language progress, not just raw scores.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              {mostImprovedWords.map((word) => (
                <div key={word.word} className="rounded-2xl border border-[#edf1f5] bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-lg font-black tracking-tight text-slate-950">{word.word}</p>
                    <Badge variant="success">+{word.trend[word.trend.length - 1] - word.trend[0]} pts</Badge>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-500">{word.context}</p>
                  <div className="mt-4">
                    <Sparkline values={word.trend} tone="success" />
                  </div>
                  <p className="mt-2 text-xs font-semibold text-slate-500">{word.aiTag}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </FlexibleCardItem>
      </FlexibleCardGrid>
    </div>
  );
}

function RoleplayPanel({ batch }: { batch: LanguageLabBatch }) {
  const bestScenario = useMemo(
    () => [...batch.roleplays].sort((left, right) => right.bestScore - left.bestScore)[0],
    [batch.roleplays],
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Scenario Count" value={formatNumber(batch.roleplays.length)} helper="Curated mock roleplays in the selected batch" icon={MessageSquare} tone="info" />
        <MetricCard label="Avg AI Score" value={formatPercent(batch.overview.avgRoleplay)} helper="Across scenario completion, fluency, and vocabulary" icon={BarChart3} tone="accent" />
        <MetricCard label="Top Scenario" value={formatPercent(bestScenario.bestScore)} helper={bestScenario.title} icon={CheckCircle2} tone="success" />
        <MetricCard label="Practice Streak" value={formatNumber(batch.overview.streakSessions)} helper="Consecutive scenario sessions in the mock dashboard" icon={Clock3} tone="warning" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {batch.roleplays.map((scenario) => (
          <Card key={scenario.title} className="overflow-hidden border-[#dde6f0]">
            <CardContent className="space-y-5 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="accent">Roleplay scenario</Badge>
                    <Badge variant="default">{scenario.theme}</Badge>
                  </div>
                  <h3 className="mt-3 text-2xl font-black tracking-tight text-slate-950">{scenario.title}</h3>
                </div>
                <div className="rounded-2xl border border-[#e6edf5] bg-slate-50 px-4 py-3 text-right">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Tries</p>
                  <p className="mt-1 text-2xl font-black text-slate-950">{scenario.tries}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Best AI</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">{scenario.bestScore}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Latest AI</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">{scenario.latestScore}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Fluency</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">{scenario.fluency}%</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Politeness</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">{scenario.politeness}%</p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_160px]">
                <div className="space-y-4">
                  <PercentageBar label="Vocabulary coverage" value={scenario.vocabulary} tone={scenario.vocabulary >= 86 ? "success" : "info"} />
                  <PercentageBar label="Scenario completion" value={scenario.completion} tone={scenario.completion >= 90 ? "success" : scenario.completion >= 82 ? "warning" : "danger"} />
                  <p className="text-sm font-medium leading-6 text-slate-600">{scenario.note}</p>
                </div>
                <div className="rounded-2xl border border-[#edf1f5] bg-slate-50 px-4 py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Score trend</p>
                  <Sparkline values={scenario.scoreTrend} tone={getScoreTone(scenario.bestScore)} />
                  <p className="mt-2 text-xs font-medium text-slate-500">AI coaching score climbed {scenario.scoreTrend[scenario.scoreTrend.length - 1] - scenario.scoreTrend[0]} points in the mock timeline.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <FlexibleCardGrid preset="balanced">
        <FlexibleCardItem span="wide" minHeightClassName="min-h-[320px]">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Recent attempts</CardTitle>
              <CardDescription>UI-only recent AI scoring feed for demos and stakeholder walkthroughs.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="hidden grid-cols-[1.1fr_1.6fr_1fr_0.9fr_1fr] gap-3 px-1 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400 md:grid">
                <div>Learner</div>
                <div>Scenario</div>
                <div>Attempt</div>
                <div>AI</div>
                <div>Status</div>
              </div>
              {batch.recentAttempts.map((attempt) => (
                <div key={`${attempt.learner}-${attempt.attemptAt}`} className="grid gap-3 rounded-2xl border border-[#edf1f5] bg-slate-50 px-4 py-4 md:grid-cols-[1.1fr_1.6fr_1fr_0.9fr_1fr] md:items-center">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{attempt.learner}</p>
                    <p className="text-xs font-medium text-slate-500">Fluency {attempt.fluency}%</p>
                  </div>
                  <p className="text-sm font-medium text-slate-600">{attempt.scenario}</p>
                  <p className="text-sm font-medium text-slate-600">{attempt.attemptAt}</p>
                  <p className="text-sm font-black text-slate-950">{attempt.aiScore}</p>
                  <div>
                    <Badge variant={attempt.status === "Needs repetition" ? "warning" : attempt.status === "Coach review" ? "info" : attempt.status === "Recovered" ? "success" : "default"}>{attempt.status}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </FlexibleCardItem>

        <FlexibleCardItem minHeightClassName="min-h-[320px]">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Scenario comparison</CardTitle>
              <CardDescription>Best-score comparison across the active roleplay slate.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {batch.roleplays.map((scenario) => (
                <PercentageBar key={scenario.title} label={scenario.title} value={scenario.bestScore} helper={scenario.note} tone={getScoreTone(scenario.bestScore)} />
              ))}
            </CardContent>
          </Card>
        </FlexibleCardItem>
      </FlexibleCardGrid>
    </div>
  );
}

function VocabularyPanel({ batch }: { batch: LanguageLabBatch }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Listening Accuracy" value={formatPercent(batch.overview.listeningAccuracy)} helper="Playback and dictation accuracy" icon={Headphones} tone="info" />
        <MetricCard label="Phrase Mastery" value={formatPercent(batch.overview.phraseMastery)} helper="Phrase bank coverage for the selected batch" icon={Languages} tone="success" />
        <MetricCard label="Phrases This Week" value={formatNumber(batch.vocabularySnapshot.phrasesMasteredThisWeek)} helper="New lines the batch stabilized this week" icon={Sparkles} tone="accent" />
        <MetricCard label="Filler Word Rate" value={`${batch.vocabularySnapshot.fillerWordRate.toFixed(1)}/min`} helper={`${batch.vocabularySnapshot.fillerWordDelta < 0 ? "Down" : "Up"} ${Math.abs(batch.vocabularySnapshot.fillerWordDelta).toFixed(1)} from the last mock cycle`} icon={Volume2} tone={batch.vocabularySnapshot.fillerWordDelta < 0 ? "success" : "warning"} />
        <MetricCard label="AI Confidence" value={formatPercent(batch.vocabularySnapshot.aiConfidence)} helper="Confidence score across listening and phrase drills" icon={TrendingUp} tone="warning" />
      </div>

      <FlexibleCardGrid preset="balanced">
        <FlexibleCardItem span="wide" minHeightClassName="min-h-[320px]">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Listening drill board</CardTitle>
              <CardDescription>Mock drill completion with accuracy and attempt volume.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              {batch.listeningDrills.map((drill) => (
                <div key={drill.title} className="rounded-2xl border border-[#edf1f5] bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant="info">{drill.difficulty}</Badge>
                    <Badge variant={drill.accuracy >= 80 ? "success" : "warning"}>{drill.accuracy}%</Badge>
                  </div>
                  <h3 className="mt-4 text-lg font-black tracking-tight text-slate-950">{drill.title}</h3>
                  <p className="mt-2 text-sm font-medium text-slate-500">{drill.note}</p>
                  <div className="mt-4 rounded-2xl bg-white px-4 py-3 ring-1 ring-[#e5ecf6]">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Attempts</p>
                    <p className="mt-1 text-lg font-bold text-slate-950">{drill.attempts}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </FlexibleCardItem>

        <FlexibleCardItem minHeightClassName="min-h-[320px]">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Phrase bank mastery</CardTitle>
              <CardDescription>Reusable lines with mock usage depth and mastery percentages.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {batch.phraseBank.map((phrase) => (
                <div key={phrase.phrase} className="rounded-2xl border border-[#edf1f5] bg-slate-50 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{phrase.phrase}</p>
                      <p className="mt-1 text-xs font-medium text-slate-500">{phrase.category}</p>
                    </div>
                    <Badge variant={phrase.mastery >= 84 ? "success" : phrase.mastery >= 76 ? "info" : "warning"}>{phrase.mastery}%</Badge>
                  </div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white ring-1 ring-[#e6edf5]">
                    <div className={cn("h-full rounded-full", phrase.mastery >= 84 ? "bg-emerald-500" : phrase.mastery >= 76 ? "bg-[#0d3b84]" : "bg-amber-500")} style={{ width: `${phrase.mastery}%` }} />
                  </div>
                  <p className="mt-2 text-xs font-medium text-slate-500">{phrase.timesUsed} mock uses. {phrase.note}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </FlexibleCardItem>

        <FlexibleCardItem span="wide" minHeightClassName="min-h-[360px]">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Confidence versus accuracy matrix</CardTitle>
              <CardDescription>Static scatter-style view for stakeholder demos and design review.</CardDescription>
            </CardHeader>
            <CardContent>
              <ConfidenceMatrix points={batch.confidenceMatrix} />
            </CardContent>
          </Card>
        </FlexibleCardItem>

        <FlexibleCardItem minHeightClassName="min-h-[360px]">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Frequent correction themes</CardTitle>
              <CardDescription>What the AI coach keeps asking learners to tighten up.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {batch.feedbackThemes.map((theme, index) => (
                <PercentageBar key={theme.theme} label={theme.theme} value={Math.min(100, theme.count * 5)} helper={theme.detail} tone={index === 0 ? "warning" : index === 1 ? "accent" : "info"} />
              ))}
            </CardContent>
          </Card>
        </FlexibleCardItem>

        <FlexibleCardItem minHeightClassName="min-h-[360px]">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Language rituals for the week</CardTitle>
              <CardDescription>Extra language-specific ideas to make the mock module feel complete.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {batch.practiceRituals.map((ritual) => (
                <div key={ritual.title} className="rounded-2xl border border-[#edf1f5] bg-slate-50 px-4 py-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-blue-50 p-3 text-[#0d3b84]">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{ritual.title}</p>
                      <p className="mt-1 text-xs font-medium leading-5 text-slate-500">{ritual.detail}</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </FlexibleCardItem>
      </FlexibleCardGrid>
    </div>
  );
}

export function LanguageLabSection({ title, description }: LanguageLabSectionProps) {
  const [selectedBatchId, setSelectedBatchId] = useState(LANGUAGE_LAB_BATCHES[0]?.id ?? "");
  const [selectedView, setSelectedView] = useState<LanguageLabView>("overview");
  const [selectedPeriod, setSelectedPeriod] = useState<LanguageLabPeriod>("8w");

  const selectedBatch = useMemo(
    () => LANGUAGE_LAB_BATCHES.find((batch) => batch.id === selectedBatchId) ?? LANGUAGE_LAB_BATCHES[0],
    [selectedBatchId],
  );

  if (!selectedBatch) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-[#d8e1ef] bg-[radial-gradient(circle_at_top_right,rgba(248,154,28,0.14),transparent_28%),radial-gradient(circle_at_top_left,rgba(13,59,132,0.12),transparent_32%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
        <CardContent className="space-y-6 p-6 lg:p-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info">UI-only mock environment</Badge>
                <Badge variant="accent">Language Lab</Badge>
                <Badge variant="success">Modern stakeholder preset</Badge>
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 lg:text-4xl">{title}</h1>
              <p className="mt-3 text-sm font-medium leading-6 text-slate-600">{description}</p>
              <p className="mt-3 text-sm font-semibold text-slate-500">Static, presentation-ready language analytics for pronunciation, roleplay, vocabulary, and listening.</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="secondary">
                <BarChart3 className="h-4 w-4" />
                Export Mock Scorecard
              </Button>
              <Button type="button">
                <Sparkles className="h-4 w-4" />
                Present AI Review
              </Button>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {VIEW_OPTIONS.map((option) => (
                <SectionToggleButton
                  key={option.id}
                  isActive={selectedView === option.id}
                  label={option.label}
                  detail={option.detail}
                  onClick={() => setSelectedView(option.id)}
                />
              ))}
            </div>

            <div className="rounded-[28px] border border-[#e3e9f2] bg-white/90 p-5 shadow-sm backdrop-blur-sm">
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Mock batch</label>
                  <select
                    value={selectedBatch.id}
                    onChange={(event) => setSelectedBatchId(event.target.value)}
                    className="mt-2 h-11 w-full rounded-2xl border border-[#dde1e6] bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition-colors focus:border-[#0d3b84]"
                  >
                    {LANGUAGE_LAB_BATCHES.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.code} - {batch.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  {PERIOD_OPTIONS.map((option) => (
                    <PeriodPill key={option.id} isActive={selectedPeriod === option.id} label={option.label} onClick={() => setSelectedPeriod(option.id)} />
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Active track</p>
                    <p className="mt-1 text-lg font-bold text-slate-950">{selectedBatch.track}</p>
                  </div>
                  <Badge variant="default">{selectedBatch.snapshotLabel}</Badge>
                </div>
                <p className="mt-3 text-sm font-medium leading-6 text-slate-600">{selectedBatch.summary}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedView === "overview" ? <OverviewPanel batch={selectedBatch} period={selectedPeriod} /> : null}
      {selectedView === "pronunciation" ? <PronunciationPanel batch={selectedBatch} /> : null}
      {selectedView === "roleplay" ? <RoleplayPanel batch={selectedBatch} /> : null}
      {selectedView === "vocabulary" ? <VocabularyPanel batch={selectedBatch} /> : null}
    </div>
  );
}