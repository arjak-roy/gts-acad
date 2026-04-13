"use client";

import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Bot, Mic, MessageSquareText, Workflow } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { LanguageLabSettingsPanel } from "./language-lab-settings-panel";

type LanguageLabSectionProps = {
  title: string;
  description: string;
};

type LanguageLabView = "settings" | "word-progress" | "pronunciation" | "roleplay";

const VIEW_OPTIONS: Array<{
  id: LanguageLabView;
  label: string;
  detail: string;
  icon: LucideIcon;
}> = [
  {
    id: "settings",
    label: "Buddy Settings",
    detail: "Gemini runtime, prompts, and model control",
    icon: Bot,
  },
  {
    id: "word-progress",
    label: "Word Progress",
    detail: "Batch-wise and learner-wise vocabulary tracking",
    icon: Workflow,
  },
  {
    id: "pronunciation",
    label: "Pronunciation Analysis",
    detail: "Attempt quality, weak words, and coaching patterns",
    icon: Mic,
  },
  {
    id: "roleplay",
    label: "Roleplay Analytics",
    detail: "Real scenario sessions without mock scorecards",
    icon: MessageSquareText,
  },
];

export function LanguageLabSection({ title, description }: LanguageLabSectionProps) {
  const [selectedView, setSelectedView] = useState<LanguageLabView>("settings");

  const selectedOption = useMemo(
    () => VIEW_OPTIONS.find((option) => option.id === selectedView) ?? VIEW_OPTIONS[0],
    [selectedView],
  );

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-[#d8e1ef] bg-[radial-gradient(circle_at_top_right,rgba(248,154,28,0.14),transparent_28%),radial-gradient(circle_at_top_left,rgba(13,59,132,0.12),transparent_32%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
        <CardContent className="space-y-6 p-6 lg:p-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info">Live academy module</Badge>
                <Badge variant="accent">Language Lab</Badge>
                <Badge variant="success">Mock analytics removed</Badge>
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 lg:text-4xl">{title}</h1>
              <p className="mt-3 text-sm font-medium leading-6 text-slate-600">{description}</p>
              <p className="mt-3 text-sm font-semibold text-slate-500">
                This module now preserves the production Buddy Settings experience and exposes real implementation surfaces for word progress, pronunciation analysis, and roleplay analytics without fake dashboards.
              </p>
            </div>

            <div className="rounded-[28px] border border-[#dce6f5] bg-white/90 p-5 shadow-sm backdrop-blur-sm xl:max-w-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Current surface</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">{selectedOption.label}</p>
                </div>
                <selectedOption.icon className="h-5 w-5 text-[#0d3b84]" />
              </div>
              <p className="mt-3 text-sm font-medium leading-6 text-slate-600">{selectedOption.detail}</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {VIEW_OPTIONS.map((option) => (
              <SectionToggleButton
                key={option.id}
                isActive={selectedView === option.id}
                label={option.label}
                detail={option.detail}
                icon={option.icon}
                onClick={() => setSelectedView(option.id)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedView === "settings" ? <LanguageLabSettingsPanel /> : null}
      {selectedView === "word-progress" ? (
        <AnalyticsPlaceholderPanel
          eyebrow="Word Progress"
          title="Production word tracking is ready for real data wiring"
          description="This view will move to batch-wise and learner-wise progress once managed words and attempt persistence are connected. The mock vocabulary scorecards are intentionally removed."
          bullets={[
            "Managed word catalog owned by admin, including newly added words.",
            "Batch filters and learner drill-down built on academy enrollments.",
            "Word-level trends sourced from synced learner attempts, not static fixtures.",
          ]}
        />
      ) : null}
      {selectedView === "pronunciation" ? (
        <AnalyticsPlaceholderPanel
          eyebrow="Pronunciation Analysis"
          title="This view now waits for synced pronunciation attempts"
          description="The old phoneme charts and hotspot cards were mock-only. This replacement keeps the production shell in place and will fill with real learner pronunciation attempts once the backend ingestion endpoints land."
          bullets={[
            "Weakest words and phoneme priorities by batch.",
            "Learner-specific attempt history and coaching feedback.",
            "Trendlines based on stored reports instead of presentation data.",
          ]}
        />
      ) : null}
      {selectedView === "roleplay" ? (
        <AnalyticsPlaceholderPanel
          eyebrow="Roleplay Analytics"
          title="Roleplay analytics stays in the section, but only as real data"
          description="This panel is reserved for live session counts, summary scores, and learner drill-down from the actual roleplay flow. The previous mock roleplay scorecards and export affordances are removed."
          bullets={[
            "Session counts and latest completion timestamps by batch.",
            "Learner-level performance summaries for real attempts.",
            "Scenario quality metrics once the roleplay payload is stored server-side.",
          ]}
        />
      ) : null}
    </div>
  );
}

function SectionToggleButton({
  isActive,
  label,
  detail,
  icon: Icon,
  onClick,
}: {
  isActive: boolean;
  label: string;
  detail: string;
  icon: LucideIcon;
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
      <div className="flex items-center justify-between gap-3">
        <p className={cn("text-sm font-black tracking-tight", isActive ? "text-[#0d3b84]" : "text-slate-900")}>{label}</p>
        <Icon className={cn("h-4 w-4", isActive ? "text-[#0d3b84]" : "text-slate-500")} />
      </div>
      <p className="mt-1 text-xs font-medium text-slate-500">{detail}</p>
    </button>
  );
}

function AnalyticsPlaceholderPanel({
  eyebrow,
  title,
  description,
  bullets,
}: {
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
}) {
  return (
    <Card className="border-[#d8e1ef] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default">No mock data</Badge>
          <Badge variant="info">Production placeholder</Badge>
        </div>
        <CardTitle className="mt-3 text-2xl font-black tracking-tight text-slate-950">{title}</CardTitle>
        <CardDescription className="max-w-3xl text-sm font-medium leading-6 text-slate-600">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-[28px] border border-[#dce6f5] bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{eyebrow}</p>
          <p className="mt-2 text-lg font-bold text-slate-950">Next live data milestone</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {bullets.map((item) => (
              <div key={item} className="rounded-2xl border border-[#e8edf3] bg-slate-50 px-4 py-4">
                <p className="text-sm font-semibold leading-6 text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium leading-6 text-amber-900">
          Live filters and analytics cards will appear only after the corresponding backend tables and candidate sync endpoints are connected. Until then, this surface intentionally stays empty rather than shipping misleading presentation data.
        </div>
      </CardContent>
    </Card>
  );
}