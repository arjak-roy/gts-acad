"use client";

import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, KeyRound, Loader2, RefreshCcw, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/ui/can-access";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  LANGUAGE_LAB_CATEGORY_CODE,
  LANGUAGE_LAB_DEFAULT_CONFIG,
  LANGUAGE_LAB_SETTING_KEYS,
} from "@/lib/language-lab/default-config";
import type { SettingDefinitionItem, SettingsCategoryDetail } from "@/services/settings/types";

type ApiResponse<T> = {
  data?: T;
  error?: string;
};

type LanguageLabSettingsFormState = {
  geminiApiKey: string;
  buddySystemPrompt: string;
  roleplaySystemPrompt: string;
  pronunciationSystemPrompt: string;
  speakingTestSystemPrompt: string;
};

const TEXTAREA_CLASS_NAME =
  "flex min-h-[168px] w-full rounded-2xl border border-[#dde1e6] bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84] disabled:cursor-not-allowed disabled:opacity-50";

const EMPTY_FORM: LanguageLabSettingsFormState = {
  geminiApiKey: "",
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

  const promptCoverage = useMemo(() => {
    const promptValues = [
      form.buddySystemPrompt,
      form.roleplaySystemPrompt,
      form.pronunciationSystemPrompt,
      form.speakingTestSystemPrompt,
    ];

    return promptValues.filter((value) => value.trim().length > 0).length;
  }, [form]);

  const handleFieldChange = useCallback(
    (field: keyof LanguageLabSettingsFormState) =>
      (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const nextValue = event.target.value;
        setForm((current) => ({ ...current, [field]: nextValue }));
      },
    [],
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const preserveEncryptedKeys = geminiApiKeySetting?.hasStoredValue && form.geminiApiKey.trim().length === 0
        ? [LANGUAGE_LAB_SETTING_KEYS.geminiApiKey]
        : [];

      const response = await fetch(`/api/settings/${LANGUAGE_LAB_CATEGORY_CODE}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          values: {
            [LANGUAGE_LAB_SETTING_KEYS.geminiApiKey]: form.geminiApiKey,
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
  }, [form, geminiApiKeySetting?.hasStoredValue]);

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
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-[#d8e1ef] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center justify-between gap-3">
              <Badge variant="info">Gemini runtime</Badge>
              <KeyRound className="h-5 w-5 text-[#0d3b84]" />
            </div>
            <p className="text-2xl font-black tracking-tight text-slate-950">
              {geminiApiKeySetting?.hasStoredValue ? "Stored" : "Missing"}
            </p>
            <p className="text-sm font-medium leading-6 text-slate-500">
              The API key is stored in academy settings and returned only to authenticated candidate sessions.
            </p>
          </CardContent>
        </Card>

        <Card className="border-[#d8e1ef] bg-[linear-gradient(180deg,#ffffff_0%,#fffaf3_100%)]">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center justify-between gap-3">
              <Badge variant="accent">Prompt coverage</Badge>
              <Bot className="h-5 w-5 text-[#d77f10]" />
            </div>
            <p className="text-2xl font-black tracking-tight text-slate-950">{promptCoverage}/4</p>
            <p className="text-sm font-medium leading-6 text-slate-500">
              Buddy, roleplay, pronunciation analysis, and speaking-test analysis all resolve from this single admin surface.
            </p>
          </CardContent>
        </Card>

        <Card className="border-[#d8e1ef] bg-[linear-gradient(180deg,#ffffff_0%,#f6fff9_100%)]">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center justify-between gap-3">
              <Badge variant="success">Delivery contract</Badge>
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="text-2xl font-black tracking-tight text-slate-950">Flutter runtime</p>
            <p className="text-sm font-medium leading-6 text-slate-500">
              The candidate app still executes Gemini locally. This workspace only owns the key and shared system prompts.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#d8e1ef]">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Buddy Settings</CardTitle>
            <CardDescription>
              Manage the Gemini API key and the shared system prompts consumed by the Flutter Language Lab features.
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
        </CardContent>
      </Card>
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