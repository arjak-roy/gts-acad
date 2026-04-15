"use client";

import type { ChangeEvent } from "react";
import { useMemo } from "react";
import { Braces, FileText, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  countCompletedSections,
  createDefaultPromptDocument,
  encodePromptDocument,
  parsePromptDocument,
  resolveCompiledPromptValue,
} from "@/lib/language-lab/prompt-framework";
import { getSectionDefinitions } from "@/lib/language-lab/prompt-types";
import type { PromptType, PromptScope } from "@/lib/language-lab/prompt-types";
import type { PersonaCapability } from "@/lib/language-lab/content-blocks";
import { cn } from "@/lib/utils";

const TEXTAREA_CLASS_NAME =
  "flex min-h-[136px] w-full rounded-2xl border border-[#dde1e6] bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84] disabled:cursor-not-allowed disabled:opacity-50";

type BuddyInstructionBuilderProps = {
  promptType?: PromptType;
  scope: PromptScope;
  value: string;
  onChange: (nextValue: string) => void;
  title: string;
  description: string;
  disabled?: boolean;
  capabilities?: PersonaCapability[];
  className?: string;
};

export function BuddyInstructionBuilder({
  promptType = "buddy",
  scope,
  value,
  onChange,
  title,
  description,
  disabled = false,
  capabilities,
  className,
}: BuddyInstructionBuilderProps) {
  const document = useMemo(() => parsePromptDocument(value), [value]);
  const compiledPrompt = useMemo(() => resolveCompiledPromptValue(value), [value]);
  const sectionDefinitions = useMemo(() => getSectionDefinitions(promptType, scope), [promptType, scope]);
  const completedSections = document ? countCompletedSections(document) : 0;
  const isStructured = !!document;
  const rawModeHelper =
    promptType === "buddy"
      ? "Raw mode stays available for legacy Buddy prompts, but runtime still injects language, capabilities, and response mechanics separately."
      : "Raw mode stays available for legacy prompts and power-user edits.";
  const scopeHelper =
    promptType === "buddy"
      ? scope === "base"
        ? "Defines academy-wide Buddy behavior. Runtime still injects persona metadata, capabilities, and response mechanics."
        : "Shapes persona identity and coaching behavior. Leave JSON shape, translation rules, and capability mechanics to runtime."
      : scope === "base"
        ? "Defines shared behavior before overlay-specific instructions are applied."
        : "Shapes overlay behavior on top of the shared base prompt.";
  const rawPromptGuidance =
    promptType === "buddy"
      ? "This prompt stays editable as raw text so you do not lose legacy wording. For Buddy, keep raw text focused on behavior and avoid hardcoding JSON shape, translation rules, or capability mechanics because runtime injects them separately."
      : "This prompt stays editable as raw text so you do not lose any legacy wording. Switch to Structured when you want the framework, linting, and section-based preview to take over.";

  const handleSwitchToStructured = () => {
    if (document) return;
    const nextDocument = createDefaultPromptDocument(promptType, scope);
    onChange(encodePromptDocument(nextDocument));
  };

  const handleSwitchToRaw = () => {
    onChange(compiledPrompt);
  };

  const handleSectionChange = (sectionId: string) => (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextDocument = document ?? createDefaultPromptDocument(promptType, scope);
    onChange(
      encodePromptDocument({
        ...nextDocument,
        sections: {
          ...nextDocument.sections,
          [sectionId]: event.target.value,
        },
      }),
    );
  };

  const handleRawChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  const enabledCapCount = capabilities?.length ?? 0;

  return (
    <div className={cn("space-y-4 rounded-[28px] border border-[#d8e1ef] bg-white p-5", className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="accent">Instruction framework</Badge>
            <Badge variant={isStructured ? "success" : "warning"}>
              {isStructured ? "Structured mode" : "Raw mode"}
            </Badge>
            {capabilities ? (
              <Badge variant="default">
                {enabledCapCount} capabilities enabled
              </Badge>
            ) : null}
          </div>
          <p className="mt-3 text-xl font-black tracking-tight text-slate-950">{title}</p>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-600">{description}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={isStructured ? "default" : "secondary"}
            size="sm"
            onClick={handleSwitchToStructured}
            disabled={disabled || isStructured}
          >
            <Sparkles className="h-4 w-4" />
            Structured
          </Button>
          <Button
            type="button"
            variant={!isStructured ? "default" : "secondary"}
            size="sm"
            onClick={handleSwitchToRaw}
            disabled={disabled || !isStructured}
          >
            <Braces className="h-4 w-4" />
            Advanced raw
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile label="Mode" value={isStructured ? "Structured" : "Raw"} helper={rawModeHelper} icon={<Braces className="h-4 w-4 text-[#0d3b84]" />} />
        <SummaryTile
          label="Compiled length"
          value={`${compiledPrompt.length}`}
          helper="Counted from the prompt text that will actually reach the runtime after compile."
          icon={<FileText className="h-4 w-4 text-[#0d3b84]" />}
        />
        <SummaryTile
          label="Section coverage"
          value={document ? `${completedSections}/${sectionDefinitions.length}` : "Legacy"}
          helper={document ? "Structured prompts are easier to lint, preview, and maintain over time." : "Convert this prompt into the framework to unlock section-level quality checks."}
          icon={<Sparkles className="h-4 w-4 text-[#0d3b84]" />}
        />
        <SummaryTile
          label="Scope"
          value={scope === "base" ? "Base prompt" : "Persona overlay"}
          helper={scopeHelper}
          icon={<FileText className="h-4 w-4 text-[#0d3b84]" />}
        />
      </div>

      {document ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {sectionDefinitions.map((section) => {
            const sectionValue = document.sections[section.id] ?? "";

            return (
              <label key={section.id} className="block rounded-[24px] border border-[#e4eaf3] bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black tracking-tight text-slate-950">{section.label}</p>
                    <p className="mt-1 text-sm font-medium leading-6 text-slate-500">{section.description}</p>
                  </div>
                  <Badge variant={section.required ? "info" : "default"}>{section.required ? "Required" : "Optional"}</Badge>
                </div>
                <textarea
                  value={sectionValue}
                  onChange={handleSectionChange(section.id)}
                  disabled={disabled}
                  maxLength={section.maxLength}
                  placeholder={section.placeholder}
                  className={cn(TEXTAREA_CLASS_NAME, "mt-4", section.id === "specialGuidance" ? "min-h-[180px] xl:min-h-[224px]" : undefined)}
                />
                <div className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">
                  <span>{section.compileHeading} in the compiled prompt</span>
                  <span>{sectionValue.trim().length}/{section.maxLength}</span>
                </div>
              </label>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50/70 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-white p-3 text-amber-700 shadow-sm">
              <Braces className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-amber-700">Legacy raw prompt</p>
              <p className="mt-2 text-sm font-medium leading-6 text-amber-950">
                {rawPromptGuidance}
              </p>
            </div>
          </div>

          <textarea
            value={value}
            onChange={handleRawChange}
            disabled={disabled}
            placeholder="Write or paste the raw Buddy prompt here."
            className={cn(TEXTAREA_CLASS_NAME, "mt-4 min-h-[280px] font-mono")}
          />
        </div>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[22px] border border-[#e4eaf3] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{label}</p>
        {icon}
      </div>
      <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-xs font-medium leading-5 text-slate-500">{helper}</p>
    </div>
  );
}