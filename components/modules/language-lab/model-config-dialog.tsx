"use client";

import type { ChangeEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import { AlertCircle, Check, Loader2, Save, X } from "lucide-react";

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
import {
  buildLanguageLabRegisteredModelsJson,
  LANGUAGE_LAB_DEFAULT_CONFIG,
  type LanguageLabRegisteredModel,
} from "@/lib/language-lab/default-config";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModelConfigValues = {
  registeredModelsJson: string;
  buddyConversationModelId: string;
  roleplayModelId: string;
  pronunciationModelId: string;
};

export type ModelConfigDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  values: ModelConfigValues;
  onSave: (values: ModelConfigValues) => Promise<void>;
  isSaving?: boolean;
};

type ParsedRegistry = {
  models: LanguageLabRegisteredModel[];
  error: string | null;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEXTAREA_CLASS_NAME =
  "flex min-h-[160px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-xs text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84] disabled:cursor-not-allowed disabled:opacity-50";

const SELECT_CLASS_NAME =
  "flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84] disabled:cursor-not-allowed disabled:opacity-50";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseRegisteredModels(rawValue: string): ParsedRegistry {
  const normalized = rawValue.trim();
  if (!normalized) {
    return { models: [], error: "Model registry JSON is required." };
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(normalized);
  } catch {
    return { models: [], error: "Invalid JSON syntax." };
  }

  if (!Array.isArray(decoded)) {
    return { models: [], error: "Must be an array of { name, modelId } objects." };
  }

  const seenModelIds = new Set<string>();
  const models: LanguageLabRegisteredModel[] = [];

  for (const entry of decoded) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return { models: [], error: "Each entry must be an object with name and modelId." };
    }

    const candidate = entry as { name?: unknown; modelId?: unknown };
    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
    const modelId = typeof candidate.modelId === "string" ? candidate.modelId.trim() : "";

    if (!name || !modelId) {
      return { models: [], error: "Each entry must have non-empty name and modelId." };
    }

    if (seenModelIds.has(modelId)) {
      return { models: [], error: `Duplicate modelId: ${modelId}` };
    }

    seenModelIds.add(modelId);
    models.push({ name, modelId });
  }

  if (models.length === 0) {
    return { models: [], error: "At least one model is required." };
  }

  return { models, error: null };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ModelConfigDialog({
  open,
  onOpenChange,
  values,
  onSave,
  isSaving = false,
}: ModelConfigDialogProps) {
  const [draft, setDraft] = useState<ModelConfigValues>(values);

  // Reset draft when dialog opens
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setDraft(values);
      }
      onOpenChange(nextOpen);
    },
    [values, onOpenChange],
  );

  const handleChange = useCallback(
    (field: keyof ModelConfigValues) => (e: ChangeEvent<HTMLTextAreaElement | HTMLSelectElement>) => {
      setDraft((d) => ({ ...d, [field]: e.target.value }));
    },
    [],
  );

  const handleSubmit = useCallback(async () => {
    await onSave(draft);
  }, [draft, onSave]);

  const parsedRegistry = useMemo(() => parseRegisteredModels(draft.registeredModelsJson), [draft.registeredModelsJson]);
  const registeredModelIds = useMemo(
    () => new Set(parsedRegistry.models.map((m) => m.modelId)),
    [parsedRegistry.models],
  );

  const assignmentValid = useCallback(
    (modelId: string) => registeredModelIds.has(modelId.trim()),
    [registeredModelIds],
  );

  const canSave =
    !parsedRegistry.error &&
    assignmentValid(draft.buddyConversationModelId) &&
    assignmentValid(draft.roleplayModelId) &&
    assignmentValid(draft.pronunciationModelId);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Configure Models</DialogTitle>
          <DialogDescription>
            Define the registered Gemini models and assign them to Language Lab features.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Model Registry */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Model Registry (JSON)
              </label>
              {parsedRegistry.error ? (
                <Badge variant="danger" className="text-[10px]">
                  <AlertCircle className="mr-1 h-3 w-3" />
                  Invalid
                </Badge>
              ) : (
                <Badge variant="success" className="text-[10px]">
                  <Check className="mr-1 h-3 w-3" />
                  {parsedRegistry.models.length} model{parsedRegistry.models.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            <textarea
              className={TEXTAREA_CLASS_NAME}
              value={draft.registeredModelsJson}
              onChange={handleChange("registeredModelsJson")}
              placeholder={buildLanguageLabRegisteredModelsJson()}
              disabled={isSaving}
            />
            {parsedRegistry.error && (
              <p className="text-xs text-rose-600">{parsedRegistry.error}</p>
            )}
          </div>

          {/* Model Assignments */}
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Model Assignments
            </p>

            <ModelAssignmentSelect
              label="Buddy Conversation"
              value={draft.buddyConversationModelId}
              onChange={handleChange("buddyConversationModelId")}
              models={parsedRegistry.models}
              disabled={isSaving}
              isValid={assignmentValid(draft.buddyConversationModelId)}
            />

            <ModelAssignmentSelect
              label="Roleplay"
              value={draft.roleplayModelId}
              onChange={handleChange("roleplayModelId")}
              models={parsedRegistry.models}
              disabled={isSaving}
              isValid={assignmentValid(draft.roleplayModelId)}
            />

            <ModelAssignmentSelect
              label="Pronunciation"
              value={draft.pronunciationModelId}
              onChange={handleChange("pronunciationModelId")}
              models={parsedRegistry.models}
              disabled={isSaving}
              isValid={assignmentValid(draft.pronunciationModelId)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSaving}>
            <X className="h-4 w-4" />
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={isSaving || !canSave}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Models
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ModelAssignmentSelect({
  label,
  value,
  onChange,
  models,
  disabled,
  isValid,
}: {
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  models: LanguageLabRegisteredModel[];
  disabled: boolean;
  isValid: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        {!isValid && value.trim() && (
          <span className="text-[10px] font-semibold text-rose-600">Not in registry</span>
        )}
      </div>
      <select
        className={cn(
          SELECT_CLASS_NAME,
          !isValid && value.trim() && "border-rose-300 focus-visible:ring-rose-500",
        )}
        value={value}
        onChange={onChange}
        disabled={disabled}
      >
        {models.length === 0 ? (
          <option value="">No models registered</option>
        ) : (
          <>
            <option value="" disabled>
              Select a model
            </option>
            {models.map((m) => (
              <option key={m.modelId} value={m.modelId}>
                {m.name}
              </option>
            ))}
          </>
        )}
      </select>
    </div>
  );
}
