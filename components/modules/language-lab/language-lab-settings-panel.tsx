"use client";

import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, Braces, KeyRound, Loader2, RefreshCcw, Save, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/ui/can-access";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  buildLanguageLabRegisteredModelsJson,
  LANGUAGE_LAB_CATEGORY_CODE,
  LANGUAGE_LAB_DEFAULT_CONFIG,
  LANGUAGE_LAB_SETTING_KEYS,
  type LanguageLabRegisteredModel,
} from "@/lib/language-lab/default-config";
import type { SettingDefinitionItem, SettingsCategoryDetail } from "@/services/settings/types";

type ApiResponse<T> = {
  data?: T;
  error?: string;
};

type LanguageLabSettingsFormState = {
  geminiApiKey: string;
  registeredModelsJson: string;
  buddyConversationModelId: string;
  roleplayModelId: string;
  pronunciationModelId: string;
  buddySystemPrompt: string;
  roleplaySystemPrompt: string;
  pronunciationSystemPrompt: string;
  speakingTestSystemPrompt: string;
};

type ParsedModelRegistry = {
  models: LanguageLabRegisteredModel[];
  error: string | null;
};

const TEXTAREA_CLASS_NAME =
  "flex min-h-[168px] w-full rounded-2xl border border-[#dde1e6] bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84] disabled:cursor-not-allowed disabled:opacity-50";

const SELECT_CLASS_NAME =
  "mt-2 flex h-11 w-full rounded-2xl border border-[#dde1e6] bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84] disabled:cursor-not-allowed disabled:opacity-50";

const EMPTY_FORM: LanguageLabSettingsFormState = {
  geminiApiKey: "",
  registeredModelsJson: buildLanguageLabRegisteredModelsJson(),
  buddyConversationModelId: LANGUAGE_LAB_DEFAULT_CONFIG.selectedModels.buddyConversation,
  roleplayModelId: LANGUAGE_LAB_DEFAULT_CONFIG.selectedModels.roleplay,
  pronunciationModelId: LANGUAGE_LAB_DEFAULT_CONFIG.selectedModels.pronunciation,
  buddySystemPrompt: "",
  roleplaySystemPrompt: "",
  pronunciationSystemPrompt: "",
  speakingTestSystemPrompt: "",
};

function getSettingByKey(detail: SettingsCategoryDetail | null, key: string) {
  return detail?.settings.find((setting) => setting.key === key);
}

function getResolvedSettingValue(setting: SettingDefinitionItem | undefined, fallbackValue = "") {
  const rawValue = setting?.value ?? setting?.defaultValue;
  if (typeof rawValue === "string") {
    return rawValue.trim().length > 0 ? rawValue : fallbackValue;
  }

  if (rawValue === null || rawValue === undefined) {
    return fallbackValue;
  }

  const normalized = String(rawValue);
  return normalized.trim().length > 0 ? normalized : fallbackValue;
}

function buildFormState(detail: SettingsCategoryDetail | null): LanguageLabSettingsFormState {
  return {
    geminiApiKey: "",
    registeredModelsJson: getResolvedSettingValue(
      getSettingByKey(detail, LANGUAGE_LAB_SETTING_KEYS.registeredModelsJson),
      buildLanguageLabRegisteredModelsJson(),
    ),
    buddyConversationModelId: getResolvedSettingValue(
      getSettingByKey(detail, LANGUAGE_LAB_SETTING_KEYS.buddyConversationModelId),
      LANGUAGE_LAB_DEFAULT_CONFIG.selectedModels.buddyConversation,
    ),
    roleplayModelId: getResolvedSettingValue(
      getSettingByKey(detail, LANGUAGE_LAB_SETTING_KEYS.roleplayModelId),
      LANGUAGE_LAB_DEFAULT_CONFIG.selectedModels.roleplay,
    ),
    pronunciationModelId: getResolvedSettingValue(
      getSettingByKey(detail, LANGUAGE_LAB_SETTING_KEYS.pronunciationModelId),
      LANGUAGE_LAB_DEFAULT_CONFIG.selectedModels.pronunciation,
    ),
    buddySystemPrompt: getResolvedSettingValue(
      getSettingByKey(detail, LANGUAGE_LAB_SETTING_KEYS.buddySystemPrompt),
      LANGUAGE_LAB_DEFAULT_CONFIG.prompts.buddy,
    ),
    roleplaySystemPrompt: getResolvedSettingValue(
      getSettingByKey(detail, LANGUAGE_LAB_SETTING_KEYS.roleplaySystemPrompt),
      LANGUAGE_LAB_DEFAULT_CONFIG.prompts.roleplay,
    ),
    pronunciationSystemPrompt: getResolvedSettingValue(
      getSettingByKey(detail, LANGUAGE_LAB_SETTING_KEYS.pronunciationSystemPrompt),
      LANGUAGE_LAB_DEFAULT_CONFIG.prompts.pronunciationAnalysis,
    ),
    speakingTestSystemPrompt: getResolvedSettingValue(
      getSettingByKey(detail, LANGUAGE_LAB_SETTING_KEYS.speakingTestSystemPrompt),
      LANGUAGE_LAB_DEFAULT_CONFIG.prompts.speakingTest,
    ),
  };
}

function parseRegisteredModels(rawValue: string): ParsedModelRegistry {
  const normalized = rawValue.trim();
  if (!normalized) {
    return {
      models: [],
      error: "Registered models JSON is required.",
    };
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(normalized);
  } catch {
    return {
      models: [],
      error: "Registered models JSON must be valid JSON.",
    };
  }

  if (!Array.isArray(decoded)) {
    return {
      models: [],
      error: "Registered models JSON must be an array of { name, modelId } objects.",
    };
  }

  const seenModelIds = new Set<string>();
  const models: LanguageLabRegisteredModel[] = [];

  for (const entry of decoded) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return {
        models: [],
        error: "Every registered model entry must be an object with name and modelId.",
      };
    }

    const candidate = entry as { name?: unknown; modelId?: unknown };
    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
    const modelId = typeof candidate.modelId === "string" ? candidate.modelId.trim() : "";

    if (!name || !modelId) {
      return {
        models: [],
        error: "Every registered model entry must include non-empty name and modelId values.",
      };
    }

    if (seenModelIds.has(modelId)) {
      return {
        models: [],
        error: `Duplicate modelId detected: ${modelId}`,
      };
    }

    seenModelIds.add(modelId);
    models.push({ name, modelId });
  }

  if (models.length === 0) {
    return {
      models: [],
      error: "At least one registered model is required.",
    };
  }

  return {
    models,
    error: null,
  };
}

export function LanguageLabSettingsPanel() {
  const [detail, setDetail] = useState<SettingsCategoryDetail | null>(null);
  const [form, setForm] = useState<LanguageLabSettingsFormState>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/settings/${LANGUAGE_LAB_CATEGORY_CODE}`, { cache: "no-store" });
      const body = (await response.json()) as ApiResponse<SettingsCategoryDetail>;

      if (!response.ok || !body.data) {
        throw new Error(body.error ?? "Failed to load Language Lab settings.");
      }

      setDetail(body.data);
      setForm(buildFormState(body.data));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load Language Lab settings.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const geminiApiKeySetting = useMemo(
    () => getSettingByKey(detail, LANGUAGE_LAB_SETTING_KEYS.geminiApiKey),
    [detail],
  );

  const fallbackRegisteredModels = useMemo(() => {
    const fallbackValue = getResolvedSettingValue(
      getSettingByKey(detail, LANGUAGE_LAB_SETTING_KEYS.registeredModelsJson),
      buildLanguageLabRegisteredModelsJson(),
    );

    return parseRegisteredModels(fallbackValue).models;
  }, [detail]);

  const parsedRegistry = useMemo(() => parseRegisteredModels(form.registeredModelsJson), [form.registeredModelsJson]);
  const registeredModels = parsedRegistry.error ? fallbackRegisteredModels : parsedRegistry.models;
  const registeredModelIds = useMemo(() => new Set(registeredModels.map((entry) => entry.modelId)), [registeredModels]);

  const promptCoverage = useMemo(() => {
    const promptValues = [
      form.buddySystemPrompt,
      form.roleplaySystemPrompt,
      form.pronunciationSystemPrompt,
      form.speakingTestSystemPrompt,
    ];

    return promptValues.filter((value) => value.trim().length > 0).length;
  }, [form]);

  const assignmentCoverage = useMemo(() => {
    const assignedModels = [form.buddyConversationModelId, form.roleplayModelId, form.pronunciationModelId];
    return assignedModels.filter((value) => registeredModelIds.has(value.trim())).length;
  }, [form.buddyConversationModelId, form.pronunciationModelId, form.roleplayModelId, registeredModelIds]);

  const assignmentIssues = useMemo(() => {
    const issues: string[] = [];
    const assignments: Array<{ label: string; value: string }> = [
      { label: "Buddy conversation", value: form.buddyConversationModelId },
      { label: "Roleplay", value: form.roleplayModelId },
      { label: "Pronunciation", value: form.pronunciationModelId },
    ];

    for (const assignment of assignments) {
      if (!registeredModelIds.has(assignment.value.trim())) {
        issues.push(`${assignment.label} must point to a registered model.`);
      }
    }

    return issues;
  }, [form.buddyConversationModelId, form.pronunciationModelId, form.roleplayModelId, registeredModelIds]);

  const handleFieldChange = useCallback(
    (field: keyof LanguageLabSettingsFormState) =>
      (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const nextValue = event.target.value;
        setForm((current) => ({ ...current, [field]: nextValue }));
      },
    [],
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      if (parsedRegistry.error) {
        throw new Error(parsedRegistry.error);
      }

      const selectedAssignments: Array<{ key: string; label: string; value: string }> = [
        {
          key: LANGUAGE_LAB_SETTING_KEYS.buddyConversationModelId,
          label: "Buddy conversation model",
          value: form.buddyConversationModelId.trim(),
        },
        {
          key: LANGUAGE_LAB_SETTING_KEYS.roleplayModelId,
          label: "Roleplay model",
          value: form.roleplayModelId.trim(),
        },
        {
          key: LANGUAGE_LAB_SETTING_KEYS.pronunciationModelId,
          label: "Pronunciation model",
          value: form.pronunciationModelId.trim(),
        },
      ];

      const knownModelIds = new Set(parsedRegistry.models.map((entry) => entry.modelId));
      for (const assignment of selectedAssignments) {
        if (!knownModelIds.has(assignment.value)) {
          throw new Error(`${assignment.label} must match one of the registered model IDs.`);
        }
      }

      const preserveEncryptedKeys = geminiApiKeySetting?.hasStoredValue && form.geminiApiKey.trim().length === 0
        ? [LANGUAGE_LAB_SETTING_KEYS.geminiApiKey]
        : [];

      const response = await fetch(`/api/settings/${LANGUAGE_LAB_CATEGORY_CODE}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          values: {
            [LANGUAGE_LAB_SETTING_KEYS.geminiApiKey]: form.geminiApiKey,
            [LANGUAGE_LAB_SETTING_KEYS.registeredModelsJson]: form.registeredModelsJson,
            [LANGUAGE_LAB_SETTING_KEYS.buddyConversationModelId]: form.buddyConversationModelId,
            [LANGUAGE_LAB_SETTING_KEYS.roleplayModelId]: form.roleplayModelId,
            [LANGUAGE_LAB_SETTING_KEYS.pronunciationModelId]: form.pronunciationModelId,
            [LANGUAGE_LAB_SETTING_KEYS.buddySystemPrompt]: form.buddySystemPrompt,
            [LANGUAGE_LAB_SETTING_KEYS.roleplaySystemPrompt]: form.roleplaySystemPrompt,
            [LANGUAGE_LAB_SETTING_KEYS.pronunciationSystemPrompt]: form.pronunciationSystemPrompt,
            [LANGUAGE_LAB_SETTING_KEYS.speakingTestSystemPrompt]: form.speakingTestSystemPrompt,
          },
          preserveEncryptedKeys,
        }),
      });

      const body = (await response.json()) as ApiResponse<SettingsCategoryDetail>;

      if (!response.ok || !body.data) {
        throw new Error(body.error ?? "Failed to save Language Lab settings.");
      }

      setDetail(body.data);
      setForm(buildFormState(body.data));
      toast.success("Language Lab settings saved.");
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Failed to save Language Lab settings.";
      setErrorMessage(nextMessage);
      toast.error(nextMessage);
    } finally {
      setIsSaving(false);
    }
  }, [form, geminiApiKeySetting?.hasStoredValue, parsedRegistry]);

  if (isLoading) {
    return (
      <Card className="border-[#d8e1ef]">
        <CardContent className="flex min-h-[280px] items-center justify-center gap-3 p-6 text-sm font-semibold text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading Buddy settings...
        </CardContent>
      </Card>
    );
  }

  if (errorMessage && !detail) {
    return (
      <Card className="border-rose-200 bg-rose-50/60">
        <CardHeader>
          <CardTitle>Buddy settings unavailable</CardTitle>
          <CardDescription>{errorMessage}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="secondary" onClick={() => void loadSettings()}>
            <RefreshCcw className="h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-4">
        <StatCard
          badgeVariant="info"
          badgeLabel="Gemini runtime"
          icon={<KeyRound className="h-5 w-5 text-[#0d3b84]" />}
          value={geminiApiKeySetting?.hasStoredValue ? "Stored" : "Missing"}
          helper="The key remains academy-owned and is only returned to authenticated candidate sessions."
        />
        <StatCard
          badgeVariant="accent"
          badgeLabel="Model registry"
          icon={<Braces className="h-5 w-5 text-[#d77f10]" />}
          value={`${registeredModels.length}`}
          helper="Registered models are stored as JSON and drive all action-level selectors below."
        />
        <StatCard
          badgeVariant="success"
          badgeLabel="Assignments"
          icon={<Sparkles className="h-5 w-5 text-emerald-600" />}
          value={`${assignmentCoverage}/3`}
          helper="Buddy conversation, roleplay, and pronunciation each resolve to an admin-selected model."
        />
        <StatCard
          badgeVariant="default"
          badgeLabel="Prompt coverage"
          icon={<Bot className="h-5 w-5 text-slate-600" />}
          value={`${promptCoverage}/4`}
          helper="Buddy, roleplay, pronunciation analysis, and speaking-test prompts still live here."
        />
      </div>

      <Card className="border-[#d8e1ef]">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Buddy Settings</CardTitle>
            <CardDescription>
              Manage the academy-owned Gemini runtime, registered model list, model assignments, and shared system prompts consumed by the Flutter Language Lab.
            </CardDescription>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={() => void loadSettings()} disabled={isLoading || isSaving}>
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
            <CanAccess permission="settings.edit">
              <Button type="button" onClick={() => void handleSave()} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Settings
              </Button>
            </CanAccess>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          {errorMessage ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          <section className="space-y-4">
            <div>
              <p className="text-sm font-black tracking-tight text-slate-950">Gemini Runtime</p>
              <p className="mt-1 text-sm font-medium leading-6 text-slate-500">
                Candidates receive this key through the academy backend after authentication. Leaving the field blank during edits keeps the stored secret unchanged.
              </p>
            </div>

            <div className="rounded-[24px] border border-[#e3e9f2] bg-slate-50 p-4">
              <label className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Gemini API Key</label>
              <Input
                type="password"
                value={form.geminiApiKey}
                onChange={handleFieldChange("geminiApiKey")}
                placeholder={geminiApiKeySetting?.hasStoredValue ? "Leave blank to keep the stored key" : "AIza..."}
                className="mt-2"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                {geminiApiKeySetting?.hasStoredValue ? <Badge variant="success">Stored secret present</Badge> : <Badge variant="warning">No key stored yet</Badge>}
                <span>The raw value is never shown again after save.</span>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <p className="text-sm font-black tracking-tight text-slate-950">Model Registry</p>
              <p className="mt-1 text-sm font-medium leading-6 text-slate-500">
                Register Gemini models as JSON objects with <code>name</code> and <code>modelId</code>, then assign them to Buddy conversation, roleplay, and pronunciation.
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
              <div className="rounded-[24px] border border-[#e3e9f2] bg-slate-50 p-4">
                <label className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Registered Models JSON</label>
                <textarea
                  value={form.registeredModelsJson}
                  onChange={handleFieldChange("registeredModelsJson")}
                  className={`mt-2 min-h-[260px] font-mono ${TEXTAREA_CLASS_NAME}`}
                  spellCheck={false}
                />
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                  <Badge variant={parsedRegistry.error ? "danger" : "success"}>
                    {parsedRegistry.error ? "Registry needs attention" : "Registry JSON valid"}
                  </Badge>
                  <span>Use an array of objects like {`[{ "name": "Buddy Flash Lite", "modelId": "gemini-3.1-flash-lite-preview" }]`}.</span>
                </div>
                {parsedRegistry.error ? (
                  <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                    {parsedRegistry.error}
                  </div>
                ) : null}
              </div>

              <div className="space-y-4 rounded-[24px] border border-[#e3e9f2] bg-white p-4">
                <div className="rounded-2xl bg-slate-50 px-4 py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Registry preview</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{registeredModels.length} registered model{registeredModels.length === 1 ? "" : "s"}</p>
                  <p className="mt-1 text-sm font-medium leading-6 text-slate-500">
                    The selectors below are driven directly from this registry.
                  </p>
                </div>

                <div className="space-y-3">
                  {registeredModels.map((model) => (
                    <div key={model.modelId} className="rounded-2xl border border-[#e8edf3] bg-slate-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">{model.name}</p>
                        <Badge variant="default">Ready</Badge>
                      </div>
                      <p className="mt-2 text-xs font-medium tracking-[0.02em] text-slate-500">{model.modelId}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <p className="text-sm font-black tracking-tight text-slate-950">Model Assignments</p>
              <p className="mt-1 text-sm font-medium leading-6 text-slate-500">
                Each Language Lab action now resolves to a selected model ID instead of staying hardcoded in the Flutter app.
              </p>
            </div>

            {assignmentIssues.length > 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                {assignmentIssues.join(" ")}
              </div>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-3">
              <ModelAssignmentCard
                label="Buddy Conversation"
                description="Used for Buddy chat and Buddy text conversation flows."
                value={form.buddyConversationModelId}
                onChange={handleFieldChange("buddyConversationModelId")}
                models={registeredModels}
              />
              <ModelAssignmentCard
                label="Roleplay"
                description="Used for the bakery roleplay flow in the candidate app."
                value={form.roleplayModelId}
                onChange={handleFieldChange("roleplayModelId")}
                models={registeredModels}
              />
              <ModelAssignmentCard
                label="Pronunciation"
                description="Used for pronunciation analysis and phoneme-level feedback."
                value={form.pronunciationModelId}
                onChange={handleFieldChange("pronunciationModelId")}
                models={registeredModels}
              />
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <p className="text-sm font-black tracking-tight text-slate-950">System Prompts</p>
              <p className="mt-1 text-sm font-medium leading-6 text-slate-500">
                These prompts are returned to the Flutter app at runtime. The speaking-test prompt supports the <code>{"{{exerciseTitle}}"}</code> placeholder.
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <PromptEditorCard
                label="Buddy Prompt"
                description="Used for Buddy chat and Buddy live text interactions."
                value={form.buddySystemPrompt}
                onChange={handleFieldChange("buddySystemPrompt")}
              />
              <PromptEditorCard
                label="Roleplay Prompt"
                description="Used for the bakery roleplay flow in the Flutter app."
                value={form.roleplaySystemPrompt}
                onChange={handleFieldChange("roleplaySystemPrompt")}
              />
              <PromptEditorCard
                label="Pronunciation Analysis Prompt"
                description="Used for phoneme-level pronunciation analysis and learner correction cues."
                value={form.pronunciationSystemPrompt}
                onChange={handleFieldChange("pronunciationSystemPrompt")}
              />
              <PromptEditorCard
                label="Speaking Test Prompt"
                description="Used for session-level speaking analysis. Supports the {{exerciseTitle}} placeholder."
                value={form.speakingTestSystemPrompt}
                onChange={handleFieldChange("speakingTestSystemPrompt")}
              />
            </div>
          </section>

          <section className="rounded-[24px] border border-[#e3e9f2] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Delivery contract</p>
                <p className="mt-2 text-lg font-bold tracking-tight text-slate-950">Flutter runtime stays local</p>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                  The candidate app still executes Gemini locally. This admin module now owns the API key, prompts, registered model list, and per-action model assignments.
                </p>
              </div>
              <ShieldCheck className="mt-1 h-5 w-5 text-[#0d3b84]" />
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  badgeVariant,
  badgeLabel,
  icon,
  value,
  helper,
}: {
  badgeVariant: "default" | "info" | "accent" | "success" | "warning" | "danger";
  badgeLabel: string;
  icon: React.ReactNode;
  value: string;
  helper: string;
}) {
  return (
    <Card className="border-[#d8e1ef] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <Badge variant={badgeVariant}>{badgeLabel}</Badge>
          {icon}
        </div>
        <p className="text-2xl font-black tracking-tight text-slate-950">{value}</p>
        <p className="text-sm font-medium leading-6 text-slate-500">{helper}</p>
      </CardContent>
    </Card>
  );
}

function ModelAssignmentCard({
  label,
  description,
  value,
  onChange,
  models,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  models: LanguageLabRegisteredModel[];
}) {
  return (
    <div className="rounded-[24px] border border-[#e3e9f2] bg-slate-50 p-4">
      <label className="text-sm font-black tracking-tight text-slate-950">{label}</label>
      <p className="mt-1 text-sm font-medium leading-6 text-slate-500">{description}</p>
      <select value={value} onChange={onChange} className={SELECT_CLASS_NAME}>
        <option value="">Select a model</option>
        {models.map((model) => (
          <option key={model.modelId} value={model.modelId}>
            {model.name} ({model.modelId})
          </option>
        ))}
      </select>
    </div>
  );
}

function PromptEditorCard({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <div className="rounded-[24px] border border-[#e3e9f2] bg-slate-50 p-4">
      <p className="text-sm font-black tracking-tight text-slate-950">{label}</p>
      <p className="mt-1 text-sm font-medium leading-6 text-slate-500">{description}</p>
      <textarea value={value} onChange={onChange} className={`mt-4 ${TEXTAREA_CLASS_NAME}`} />
    </div>
  );
}