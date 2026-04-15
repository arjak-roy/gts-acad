"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Save, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BuddyInstructionBuilder } from "@/components/modules/language-lab/buddy-instruction-builder";
import { BuddyPromptPreviewPanel } from "@/components/modules/language-lab/buddy-prompt-preview-panel";
import {
  buildRuntimePrompt,
  lintPromptValue,
  parsePromptDocument,
  resolveCompiledPromptValue,
} from "@/lib/language-lab/prompt-framework";
import { LANGUAGE_LAB_DEFAULT_CONFIG } from "@/lib/language-lab/default-config";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PromptTab = "buddy" | "roleplay" | "pronunciation" | "speakingTest";

export type PromptValues = {
  buddySystemPrompt: string;
  roleplaySystemPrompt: string;
  pronunciationSystemPrompt: string;
  speakingTestSystemPrompt: string;
};

export type PromptManagementDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  values: PromptValues;
  onSave: (values: PromptValues) => Promise<void>;
  isSaving?: boolean;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEXTAREA_CLASS_NAME =
  "flex min-h-[200px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84] disabled:cursor-not-allowed disabled:opacity-50";

const TABS: Array<{ id: PromptTab; label: string; key: keyof PromptValues; fallback: string }> = [
  { id: "buddy", label: "Buddy", key: "buddySystemPrompt", fallback: LANGUAGE_LAB_DEFAULT_CONFIG.prompts.buddy },
  { id: "roleplay", label: "Roleplay", key: "roleplaySystemPrompt", fallback: LANGUAGE_LAB_DEFAULT_CONFIG.prompts.roleplay },
  { id: "pronunciation", label: "Pronunciation", key: "pronunciationSystemPrompt", fallback: LANGUAGE_LAB_DEFAULT_CONFIG.prompts.pronunciationAnalysis },
  { id: "speakingTest", label: "Speaking Test", key: "speakingTestSystemPrompt", fallback: LANGUAGE_LAB_DEFAULT_CONFIG.prompts.speakingTest },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PromptManagementDialog({
  open,
  onOpenChange,
  values,
  onSave,
  isSaving = false,
}: PromptManagementDialogProps) {
  const [activeTab, setActiveTab] = useState<PromptTab>("buddy");
  const [draft, setDraft] = useState<PromptValues>(values);

  // Reset draft when dialog opens
  useEffect(() => {
    if (open) {
      setDraft(values);
      setActiveTab("buddy");
    }
  }, [open, values]);

  const handlePromptChange = useCallback((key: keyof PromptValues) => (value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
  }, []);

  const handleRawChange = useCallback((key: keyof PromptValues, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
    await onSave(draft);
  }, [draft, onSave]);

  // Get active tab config
  const activeTabConfig = TABS.find((t) => t.id === activeTab)!;
  const activeValue = draft[activeTabConfig.key];

  // Computed values for active prompt
  const isStructured = useMemo(() => parsePromptDocument(activeValue) !== null, [activeValue]);
  const compiledPrompt = useMemo(
    () => resolveCompiledPromptValue(activeValue, { fallbackValue: activeTabConfig.fallback }),
    [activeValue, activeTabConfig.fallback],
  );
  const runtimePreview = useMemo(
    () =>
      buildRuntimePrompt({
        promptType: activeTab === "speakingTest" ? "speakingTest" : activeTab,
        basePromptValue: activeValue,
        baseFallbackValue: activeTabConfig.fallback,
      }),
    [activeTab, activeValue, activeTabConfig.fallback],
  );
  const issues = useMemo(
    () =>
      lintPromptValue({
        promptType: activeTab === "speakingTest" ? "speakingTest" : activeTab,
        scope: "base",
        value: activeValue,
        fallbackValue: activeTabConfig.fallback,
      }),
    [activeTab, activeValue, activeTabConfig.fallback],
  );

  // Check completion status
  const promptStatus = useMemo(() => {
    return TABS.map((tab) => ({
      id: tab.id,
      hasContent: draft[tab.key].trim().length > 0,
    }));
  }, [draft]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Manage Prompts</DialogTitle>
          <DialogDescription>
            Configure system prompts for each Language Lab feature. These prompts define how the AI behaves.
          </DialogDescription>
        </DialogHeader>

        {/* Tab navigation */}
        <div className="flex gap-1 border-b border-slate-100 px-6">
          {TABS.map((tab) => {
            const status = promptStatus.find((s) => s.id === tab.id);
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold transition-colors",
                  activeTab === tab.id ? "text-[#0d3b84]" : "text-slate-500 hover:text-slate-900",
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    status?.hasContent ? "bg-emerald-500" : "bg-slate-300",
                  )}
                />
                {activeTab === tab.id && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 bg-[#0d3b84]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "buddy" ? (
            <div className="space-y-4">
              <BuddyInstructionBuilder
                scope="base"
                value={draft.buddySystemPrompt}
                onChange={handlePromptChange("buddySystemPrompt")}
                title="Buddy Base Prompt"
                description="Define the academy-wide Buddy behavior. Persona overlays extend this base."
                disabled={isSaving}
              />
              <BuddyPromptPreviewPanel
                title="Runtime Preview"
                description="Shows the compiled base prompt before any persona overlay."
                compiledPrompt={compiledPrompt}
                assembledPrompt={runtimePreview}
                isStructured={isStructured}
                issues={issues}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-900">
                    {activeTabConfig.label} System Prompt
                  </label>
                  <Badge variant={activeValue.trim() ? "success" : "warning"} className="text-[10px]">
                    {activeValue.trim() ? "Configured" : "Empty"}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">
                  {activeTab === "roleplay" && "Used for the bakery roleplay flow in the Flutter app."}
                  {activeTab === "pronunciation" && "Used for phoneme-level pronunciation analysis and learner correction cues."}
                  {activeTab === "speakingTest" && "Used for evaluating speaking test exercises and providing feedback."}
                </p>
                <textarea
                  className={TEXTAREA_CLASS_NAME}
                  value={activeValue}
                  onChange={(e) => handleRawChange(activeTabConfig.key, e.target.value)}
                  placeholder={`Enter ${activeTabConfig.label.toLowerCase()} system prompt...`}
                  disabled={isSaving}
                />
              </div>

              {/* Simple preview for non-buddy prompts */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Preview</p>
                  <Badge variant="info" className="text-[10px]">
                    {compiledPrompt.length} chars
                  </Badge>
                </div>
                <div className="mt-3 max-h-[200px] overflow-y-auto text-xs text-slate-600 whitespace-pre-wrap">
                  {compiledPrompt || <span className="italic text-slate-400">No content</span>}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSaving}>
            <X className="h-4 w-4" />
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Prompts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
