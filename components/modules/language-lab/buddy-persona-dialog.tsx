"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
  createDefaultPromptValue,
  lintPromptValue,
  parsePromptDocument,
  resolveCompiledPromptValue,
} from "@/lib/language-lab/prompt-framework";
import type { PersonaCapability } from "@/lib/language-lab/content-blocks";
import {
  PERSONA_CAPABILITIES,
  CAPABILITY_LABELS,
  DEFAULT_CAPABILITIES,
  normalizeCapabilities,
} from "@/lib/language-lab/content-blocks";
import { LANGUAGE_LAB_DEFAULT_CONFIG } from "@/lib/language-lab/default-config";
import type { LanguageLabBuddyPersonaItem } from "@/lib/language-lab/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ApiResponse<T> = {
  data?: T;
  error?: string;
};

type CourseOption = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  isActive: boolean;
  programCount: number;
};

type BuddyPersonaDraft = {
  name: string;
  description: string;
  language: string;
  languageCode: string;
  systemPrompt: string;
  welcomeMessage: string;
  capabilities: PersonaCapability[];
  isActive: boolean;
  courseIds: string[];
};

type DialogTab = "details" | "capabilities" | "prompt" | "courses";

export type BuddyPersonaDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  persona: LanguageLabBuddyPersonaItem | null;
  courses: CourseOption[];
  baseBuddyPromptValue: string;
  onSaved: () => void;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONVERSATION_LANGUAGE_OPTIONS: Array<{
  label: string;
  language: string;
  languageCode: string;
  sttNote: string;
}> = [
  { label: "German (Germany)", language: "German", languageCode: "de-DE", sttNote: "STT: German" },
  { label: "German (Austria)", language: "German (Austria)", languageCode: "de-AT", sttNote: "STT: German" },
  { label: "German (Switzerland)", language: "German (Switzerland)", languageCode: "de-CH", sttNote: "STT: German" },
  { label: "English (US)", language: "English", languageCode: "en-US", sttNote: "STT: English" },
  { label: "English (UK)", language: "English (UK)", languageCode: "en-GB", sttNote: "STT: English" },
  { label: "Japanese (Japan)", language: "Japanese", languageCode: "ja-JP", sttNote: "STT: Japanese" },
];

const CAPABILITY_DESCRIPTIONS: Record<PersonaCapability, string> = {
  tables: "Return table payloads for grouped comparisons, vocabulary sets, and schedules.",
  lists: "Return ordered or unordered list blocks for step-by-step explanations.",
  quizzes: "Generate inline quiz blocks with options and feedback.",
  "vocab-cards": "Present vocabulary flashcard blocks with phonetics and examples.",
  comparisons: "Create side-by-side comparison columns for contrasting concepts.",
  "grammar-patterns": "Display grammar pattern blocks with rules and example sentences.",
  "email-actions": "Draft confirmed email actions that route through the academy mail pipeline.",
  speech: "Enable locale-aware TTS and STT for voice interaction.",
};

const EMPTY_DRAFT: BuddyPersonaDraft = {
  name: "",
  description: "",
  language: "German",
  languageCode: "de-DE",
  systemPrompt: createDefaultPromptValue("buddy", "overlay"),
  welcomeMessage: "",
  capabilities: [...DEFAULT_CAPABILITIES],
  isActive: true,
  courseIds: [],
};

const SELECT_CLASS_NAME =
  "flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84] disabled:cursor-not-allowed disabled:opacity-50";

const TEXTAREA_CLASS_NAME =
  "flex min-h-[100px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84] disabled:cursor-not-allowed disabled:opacity-50";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readApi<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { cache: "no-store", ...init });
  const body = (await response.json()) as ApiResponse<T>;

  if (!response.ok || body.data === undefined) {
    throw new Error(body.error ?? "Request failed.");
  }

  return body.data;
}

function toDraft(persona: LanguageLabBuddyPersonaItem): BuddyPersonaDraft {
  return {
    name: persona.name,
    description: persona.description ?? "",
    language: persona.language,
    languageCode: persona.languageCode,
    systemPrompt: persona.systemPrompt ?? "",
    welcomeMessage: persona.welcomeMessage ?? "",
    capabilities: normalizeCapabilities(persona.capabilities),
    isActive: persona.isActive,
    courseIds: (persona.assignedCourses ?? []).map((course) => course.courseId),
  };
}

function formatStatus(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BuddyPersonaDialog({
  open,
  onOpenChange,
  persona,
  courses,
  baseBuddyPromptValue,
  onSaved,
}: BuddyPersonaDialogProps) {
  const [activeTab, setActiveTab] = useState<DialogTab>("details");
  const [draft, setDraft] = useState<BuddyPersonaDraft>(EMPTY_DRAFT);
  const [isSaving, setIsSaving] = useState(false);

  const isEditing = persona !== null;

  // Reset form when opening/closing or changing persona
  useEffect(() => {
    if (open) {
      setDraft(persona ? toDraft(persona) : EMPTY_DRAFT);
      setActiveTab("details");
    }
  }, [open, persona]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleFieldChange = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = event.target;
      setDraft((current) => ({ ...current, [name]: value }));
    },
    [],
  );

  const handleLanguageSelect = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    const option = CONVERSATION_LANGUAGE_OPTIONS.find((opt) => opt.languageCode === event.target.value);
    if (!option) return;
    setDraft((current) => ({
      ...current,
      language: option.language,
      languageCode: option.languageCode,
    }));
  }, []);

  const handleActiveChange = useCallback((checked: boolean) => {
    setDraft((current) => ({ ...current, isActive: checked }));
  }, []);

  const handleCapabilityChange = useCallback((capability: PersonaCapability, checked: boolean) => {
    setDraft((current) => ({
      ...current,
      capabilities: checked
        ? [...current.capabilities, capability]
        : current.capabilities.filter((c) => c !== capability),
    }));
  }, []);

  const toggleCourse = useCallback((courseId: string) => {
    setDraft((current) => ({
      ...current,
      courseIds: current.courseIds.includes(courseId)
        ? current.courseIds.filter((id) => id !== courseId)
        : [...current.courseIds, courseId],
    }));
  }, []);

  const handlePromptChange = useCallback((nextValue: string) => {
    setDraft((current) => ({ ...current, systemPrompt: nextValue }));
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setIsSaving(true);

      try {
        const payload = {
          name: draft.name,
          description: draft.description,
          language: draft.language,
          languageCode: draft.languageCode.replaceAll("_", "-"),
          systemPrompt: draft.systemPrompt,
          welcomeMessage: draft.welcomeMessage,
          capabilities: draft.capabilities,
          isActive: draft.isActive,
          courseIds: draft.courseIds,
        };

        await readApi<LanguageLabBuddyPersonaItem>(
          persona ? `/api/language-lab/buddy-personas/${persona.id}` : "/api/language-lab/buddy-personas",
          {
            method: persona ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );

        toast.success(persona ? "Buddy persona updated." : "Buddy persona created.");
        onOpenChange(false);
        onSaved();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save Buddy persona.");
      } finally {
        setIsSaving(false);
      }
    },
    [draft, persona, onOpenChange, onSaved],
  );

  // ---------------------------------------------------------------------------
  // Computed values
  // ---------------------------------------------------------------------------

  const promptIsStructured = useMemo(
    () => parsePromptDocument(draft.systemPrompt) !== null,
    [draft.systemPrompt],
  );

  const compiledPrompt = useMemo(
    () => resolveCompiledPromptValue(draft.systemPrompt),
    [draft.systemPrompt],
  );

  const promptIssues = useMemo(
    () =>
      lintPromptValue({
        promptType: "buddy",
        scope: "overlay",
        value: draft.systemPrompt,
        capabilities: draft.capabilities,
      }),
    [draft.capabilities, draft.systemPrompt],
  );

  const assembledPrompt = useMemo(
    () =>
      buildRuntimePrompt({
        promptType: "buddy",
        basePromptValue: baseBuddyPromptValue,
        baseFallbackValue: LANGUAGE_LAB_DEFAULT_CONFIG.prompts.buddy,
        persona: {
          name: draft.name.trim() || "Draft persona",
          description: draft.description,
          language: draft.language,
          languageCode: draft.languageCode.replaceAll("_", "-"),
          welcomeMessage: draft.welcomeMessage,
          capabilities: draft.capabilities,
          systemPromptValue: draft.systemPrompt,
        },
      }),
    [baseBuddyPromptValue, draft],
  );

  const selectedLanguageOption = CONVERSATION_LANGUAGE_OPTIONS.find(
    (opt) => opt.languageCode === draft.languageCode,
  );

  // ---------------------------------------------------------------------------
  // Tab content
  // ---------------------------------------------------------------------------

  const tabs: Array<{ id: DialogTab; label: string; badge?: string }> = [
    { id: "details", label: "Details" },
    { id: "capabilities", label: "Capabilities", badge: `${draft.capabilities.length}` },
    { id: "prompt", label: "Prompt" },
    { id: "courses", label: "Courses", badge: `${draft.courseIds.length}` },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>{isEditing ? `Edit ${persona.name}` : "Create Buddy Persona"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the persona identity, capabilities, behavior overlay, and course assignments. Runtime still injects language, capabilities, and response mechanics."
              : "Define a new Buddy persona with its own language, capabilities, and coaching behavior while leaving runtime mechanics to the framework."}
          </DialogDescription>
        </DialogHeader>

        <form
          id="persona-form"
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => void handleSubmit(e)}
        >
          {/* Tab navigation */}
          <div className="flex gap-1 border-b border-slate-100 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold transition-colors",
                  activeTab === tab.id
                    ? "text-[#0d3b84]"
                    : "text-slate-500 hover:text-slate-900",
                )}
              >
                {tab.label}
                {tab.badge && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                      activeTab === tab.id
                        ? "bg-[#0d3b84] text-white"
                        : "bg-slate-100 text-slate-600",
                    )}
                  >
                    {tab.badge}
                  </span>
                )}
                {activeTab === tab.id && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 bg-[#0d3b84]" />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === "details" && (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Persona name
                  </label>
                  <Input
                    name="name"
                    value={draft.name}
                    onChange={handleFieldChange}
                    placeholder="Exam Coach Anna"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Conversation language
                  </label>
                  <select
                    className={SELECT_CLASS_NAME}
                    value={
                      CONVERSATION_LANGUAGE_OPTIONS.some((opt) => opt.languageCode === draft.languageCode)
                        ? draft.languageCode
                        : ""
                    }
                    onChange={handleLanguageSelect}
                    required
                  >
                    {!CONVERSATION_LANGUAGE_OPTIONS.some((opt) => opt.languageCode === draft.languageCode) && (
                      <option value="" disabled>
                        {draft.language ? `${draft.language} (${draft.languageCode})` : "Select a language"}
                      </option>
                    )}
                    {CONVERSATION_LANGUAGE_OPTIONS.map((opt) => (
                      <option key={opt.languageCode} value={opt.languageCode}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {selectedLanguageOption && (
                    <p className="text-xs font-medium text-slate-400">
                      BCP-47: <span className="font-bold text-slate-600">{draft.languageCode}</span>
                      {" · "}
                      {selectedLanguageOption.sttNote}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={draft.description}
                    onChange={handleFieldChange}
                    className={TEXTAREA_CLASS_NAME}
                    placeholder="Describe the persona's role, tone, and where it should be used."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Welcome message
                  </label>
                  <textarea
                    name="welcomeMessage"
                    value={draft.welcomeMessage}
                    onChange={handleFieldChange}
                    className={TEXTAREA_CLASS_NAME}
                    placeholder="The first thing Buddy says when a learner opens the chat."
                  />
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <Checkbox
                    checked={draft.isActive}
                    onCheckedChange={(checked) => handleActiveChange(checked === true)}
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Persona active</p>
                    <p className="text-xs text-slate-500">
                      Inactive personas won&apos;t resolve into candidate workspaces.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "capabilities" && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Select which response modes this persona can use in conversations.
                </p>
                {PERSONA_CAPABILITIES.map((cap) => (
                  <div
                    key={cap}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors",
                      draft.capabilities.includes(cap)
                        ? "border-[#0d3b84]/20 bg-[#0d3b84]/5"
                        : "border-slate-200 bg-white",
                    )}
                  >
                    <Checkbox
                      checked={draft.capabilities.includes(cap)}
                      onCheckedChange={(checked) => handleCapabilityChange(cap, checked === true)}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">{CAPABILITY_LABELS[cap]}</p>
                      <p className="text-xs leading-relaxed text-slate-500">
                        {CAPABILITY_DESCRIPTIONS[cap]}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "prompt" && (
              <div className="space-y-4">
                <BuddyInstructionBuilder
                  scope="overlay"
                  value={draft.systemPrompt}
                  onChange={handlePromptChange}
                  title="Persona instruction framework"
                  description="Shape the Buddy's identity and coaching behavior. Leave JSON shape, translation rules, and capability mechanics to runtime."
                  disabled={isSaving}
                  capabilities={draft.capabilities}
                />
                <BuddyPromptPreviewPanel
                  title="Runtime preview"
                  description="Preview shows academy base behavior + this persona overlay + runtime-injected mechanics."
                  compiledPrompt={compiledPrompt}
                  assembledPrompt={assembledPrompt}
                  isStructured={promptIsStructured}
                  issues={promptIssues}
                  capabilities={draft.capabilities}
                  languageLabel={
                    draft.language ? `${draft.language} (${draft.languageCode})` : draft.languageCode
                  }
                />
              </div>
            )}

            {activeTab === "courses" && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Assign this persona to courses. A course can have multiple personas with priority ordering.
                </p>
                {courses.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
                    <p className="text-sm font-medium text-slate-500">No courses available.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {courses.map((course) => {
                      const selected = draft.courseIds.includes(course.id);
                      return (
                        <div
                          key={course.id}
                          role="checkbox"
                          aria-checked={selected}
                          tabIndex={0}
                          onClick={() => toggleCourse(course.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleCourse(course.id);
                            }
                          }}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84]",
                            selected
                              ? "border-[#0d3b84]/30 bg-[#0d3b84]/5"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                              selected ? "border-[#0d3b84] bg-[#0d3b84]" : "border-slate-300 bg-white",
                            )}
                          >
                            {selected && <Check className="h-2.5 w-2.5 text-white" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900">{course.name}</p>
                              <Badge variant={course.isActive ? "success" : "warning"} className="text-[10px]">
                                {formatStatus(course.status)}
                              </Badge>
                            </div>
                            {course.description && (
                              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                                {course.description.length > 100
                                  ? `${course.description.slice(0, 100)}...`
                                  : course.description}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={isSaving}>
            <X className="h-4 w-4" />
            Cancel
          </Button>
          <Button type="submit" form="persona-form" disabled={isSaving || !draft.name.trim()}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isEditing ? "Save Changes" : "Create Persona"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
