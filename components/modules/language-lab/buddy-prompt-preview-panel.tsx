"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, FileText, Layers3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  PromptLintIssue,
} from "@/lib/language-lab/prompt-framework";
import type { PersonaCapability } from "@/lib/language-lab/content-blocks";
import { CAPABILITY_LABELS } from "@/lib/language-lab/content-blocks";
import { cn } from "@/lib/utils";

type BuddyPromptPreviewPanelProps = {
  title: string;
  description: string;
  compiledPrompt: string;
  assembledPrompt: string;
  isStructured: boolean;
  issues: PromptLintIssue[];
  capabilities?: PersonaCapability[];
  languageLabel?: string;
  className?: string;
};

type PreviewView = "runtime" | "compiled";

export function BuddyPromptPreviewPanel({
  title,
  description,
  compiledPrompt,
  assembledPrompt,
  isStructured,
  issues,
  capabilities,
  languageLabel,
  className,
}: BuddyPromptPreviewPanelProps) {
  const [activeView, setActiveView] = useState<PreviewView>("runtime");

  const visiblePrompt = activeView === "runtime" ? assembledPrompt : compiledPrompt;
  const issueSummary = useMemo(() => {
    return {
      errors: issues.filter((issue) => issue.severity === "error").length,
      warnings: issues.filter((issue) => issue.severity === "warning").length,
      info: issues.filter((issue) => issue.severity === "info").length,
    };
  }, [issues]);

  return (
    <div className={cn("space-y-4 rounded-[28px] border border-[#d8e1ef] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5", className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">Live preview</Badge>
            <Badge variant={isStructured ? "success" : "warning"}>{isStructured ? "Framework compiled" : "Raw prompt"}</Badge>
            {issues.length > 0 ? <Badge variant="warning">{issues.length} lint {issues.length === 1 ? "issue" : "issues"}</Badge> : <Badge variant="success">No lint warnings</Badge>}
          </div>
          <p className="mt-3 text-xl font-black tracking-tight text-slate-950">{title}</p>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-600">{description}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant={activeView === "runtime" ? "default" : "secondary"} onClick={() => setActiveView("runtime")}>
            <Layers3 className="h-4 w-4" />
            Runtime preview
          </Button>
          <Button type="button" size="sm" variant={activeView === "compiled" ? "default" : "secondary"} onClick={() => setActiveView("compiled")}>
            <FileText className="h-4 w-4" />
            Compiled prompt
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetaTile label="Visible length" value={`${visiblePrompt.length}`} helper="Characters in the preview you are currently inspecting." />
        <MetaTile label="Warnings" value={`${issueSummary.errors + issueSummary.warnings}`} helper="Errors and warnings that may weaken prompt reliability or contradict capabilities." />
        <MetaTile label="Language" value={languageLabel || "Runtime set"} helper="Runtime preview uses the persona language when available, otherwise the generic Buddy contract." />
        <MetaTile
          label="Capabilities"
          value={capabilities ? `${capabilities.length}` : "Base"}
          helper={capabilities ? "Count of enabled response modes visible to this persona at runtime." : "Base prompt preview uses the default capability posture when no persona is supplied."}
        />
      </div>

      <div className="rounded-[24px] border border-[#e4eaf3] bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          {capabilities?.map((cap) => (
            <Badge key={cap} variant="info">{CAPABILITY_LABELS[cap] ?? cap}</Badge>
          ))}
          <Badge variant="default">{activeView === "runtime" ? "Mirrors Flutter assembly order" : "Shows framework compile only"}</Badge>
        </div>

        <pre className="mt-4 max-h-[540px] overflow-auto whitespace-pre-wrap break-words rounded-[20px] bg-slate-950 px-4 py-4 text-sm leading-6 text-slate-100">
          {visiblePrompt.trim() || "Preview will appear here once the prompt has content."}
        </pre>
      </div>

      <div className="rounded-[24px] border border-[#e4eaf3] bg-white p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-[#edf4ff] p-3 text-[#0d3b84]">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black tracking-tight text-slate-950">Lint and rollout checks</p>
            <p className="mt-1 text-sm font-medium leading-6 text-slate-500">
              These checks highlight prompt drift, runtime-contract duplication, and capability conflicts before you save changes into the academy-owned Buddy configuration.
            </p>
            {issues.length > 0 ? (
              <div className="mt-4 space-y-3">
                {issues.map((issue) => (
                  <div key={`${issue.code}-${issue.message}`} className="rounded-[18px] border border-[#e4eaf3] bg-slate-50 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={issue.severity === "error" ? "danger" : issue.severity === "warning" ? "warning" : "info"}>{issue.severity}</Badge>
                      <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{issue.code.replaceAll("-", " ")}</span>
                    </div>
                    <p className="mt-2 text-sm font-medium leading-6 text-slate-700">{issue.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium leading-6 text-emerald-800">
                No current lint issues. The compiled prompt is staying within the framework checks that are implemented in this first pass.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaTile({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-[22px] border border-[#e4eaf3] bg-white p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-xs font-medium leading-5 text-slate-500">{helper}</p>
    </div>
  );
}