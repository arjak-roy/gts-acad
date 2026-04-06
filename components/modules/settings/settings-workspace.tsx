"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Bell,
  BookOpen,
  ClipboardCheck,
  Globe2,
  GraduationCap,
  History,
  Loader2,
  Mail,
  Palette,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { SETTING_FIELD_TYPES, type SettingFieldType, type SettingsCatalogOption } from "@/lib/settings/catalog";
import { SETTINGS_SECRET_MASK } from "@/lib/settings/constants";
import type {
  SettingDefinitionItem,
  SettingsAssetValue,
  SettingsCategoryDetail,
  SettingsCategorySummary,
  SettingsOverview,
} from "@/services/settings/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/ui/can-access";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type ApiResponse<T> = {
  data?: T;
  error?: string;
};

type CategoryFormState = {
  name: string;
  code: string;
  description: string;
  icon: string;
  displayOrder: string;
  isActive: boolean;
};

type DefinitionFormState = {
  categoryId: string;
  key: string;
  label: string;
  description: string;
  type: SettingFieldType;
  defaultValueText: string;
  placeholder: string;
  helpText: string;
  optionsText: string;
  validationRulesText: string;
  groupName: string;
  displayOrder: string;
  isRequired: boolean;
  isEncrypted: boolean;
  isReadonly: boolean;
  isActive: boolean;
};

const INPUT_CLASS_NAME =
  "flex h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84] disabled:cursor-not-allowed disabled:opacity-50";
const TEXTAREA_CLASS_NAME =
  "flex min-h-[104px] w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84] disabled:cursor-not-allowed disabled:opacity-50";
const SELECT_CLASS_NAME =
  "flex h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84] disabled:cursor-not-allowed disabled:opacity-50";

const CATEGORY_ICON_MAP = {
  Settings2,
  Palette,
  ShieldCheck,
  Mail,
  Bell,
  GraduationCap,
  BookOpen,
  ClipboardCheck,
  Upload,
  Globe2,
} as const;

const CATEGORY_ICON_OPTIONS = Object.keys(CATEGORY_ICON_MAP);

function buildEmptyCategoryForm(): CategoryFormState {
  return {
    name: "",
    code: "",
    description: "",
    icon: "Settings2",
    displayOrder: "0",
    isActive: true,
  };
}

function buildCategoryForm(category?: SettingsCategorySummary | null): CategoryFormState {
  if (!category) {
    return buildEmptyCategoryForm();
  }

  return {
    name: category.name,
    code: category.code,
    description: category.description ?? "",
    icon: category.icon ?? "Settings2",
    displayOrder: String(category.displayOrder),
    isActive: category.isActive,
  };
}

function buildEmptyDefinitionForm(categoryId = ""): DefinitionFormState {
  return {
    categoryId,
    key: "",
    label: "",
    description: "",
    type: "TEXT",
    defaultValueText: "",
    placeholder: "",
    helpText: "",
    optionsText: "[]",
    validationRulesText: "{}",
    groupName: "",
    displayOrder: "0",
    isRequired: false,
    isEncrypted: false,
    isReadonly: false,
    isActive: true,
  };
}

function stringifyJsonValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

function buildDefinitionForm(categoryId: string, setting?: SettingDefinitionItem | null): DefinitionFormState {
  if (!setting) {
    return buildEmptyDefinitionForm(categoryId);
  }

  return {
    categoryId,
    key: setting.key,
    label: setting.label,
    description: setting.description ?? "",
    type: setting.type,
    defaultValueText: stringifyJsonValue(setting.defaultValue),
    placeholder: setting.placeholder ?? "",
    helpText: setting.helpText ?? "",
    optionsText: JSON.stringify(setting.options ?? [], null, 2),
    validationRulesText: JSON.stringify(setting.validationRules ?? {}, null, 2),
    groupName: setting.groupName ?? "",
    displayOrder: String(setting.displayOrder),
    isRequired: setting.isRequired,
    isEncrypted: setting.isEncrypted,
    isReadonly: setting.isReadonly,
    isActive: setting.isActive,
  };
}

function getCategoryIcon(iconName?: string | null) {
  return CATEGORY_ICON_MAP[iconName as keyof typeof CATEGORY_ICON_MAP] ?? Wrench;
}

function isSettingsAssetValue(value: unknown): value is SettingsAssetValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return candidate.kind === "settings-asset" && typeof candidate.url === "string" && typeof candidate.fileName === "string";
}

function getInitialFieldValue(setting: SettingDefinitionItem): unknown {
  const effectiveValue = setting.hasStoredValue ? setting.value : setting.defaultValue;

  switch (setting.type) {
    case "TOGGLE":
      return Boolean(effectiveValue);
    case "NUMBER":
      return effectiveValue === null || effectiveValue === undefined ? "" : String(effectiveValue);
    case "MULTI_SELECT":
      return Array.isArray(effectiveValue) ? effectiveValue.map((entry) => String(entry)) : [];
    case "FILE":
      return isSettingsAssetValue(effectiveValue) ? effectiveValue : null;
    case "PASSWORD":
      return "";
    default:
      return effectiveValue === null || effectiveValue === undefined ? "" : String(effectiveValue);
  }
}

function buildSettingsFormState(settings: SettingDefinitionItem[]) {
  return settings.reduce<Record<string, unknown>>((accumulator, setting) => {
    accumulator[setting.key] = getInitialFieldValue(setting);
    return accumulator;
  }, {});
}

function parseJsonObject(rawValue: string, label: string) {
  const normalized = rawValue.trim();
  if (!normalized) {
    return {};
  }

  try {
    const parsed = JSON.parse(normalized) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`${label} must be a JSON object.`);
    }

    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : `${label} must be valid JSON.`);
  }
}

function parseOptions(rawValue: string) {
  const normalized = rawValue.trim();
  if (!normalized) {
    return [];
  }

  try {
    const parsed = JSON.parse(normalized) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("Options must be a JSON array.");
    }

    return parsed.map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        throw new Error("Each option must be an object with label and value.");
      }

      const option = entry as Record<string, unknown>;
      return {
        label: String(option.label ?? "").trim(),
        value: String(option.value ?? "").trim(),
      } satisfies SettingsCatalogOption;
    });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Options must be valid JSON.");
  }
}

function parseDefinitionDefaultValue(type: SettingFieldType, rawValue: string) {
  const normalized = rawValue.trim();

  if (!normalized) {
    return null;
  }

  switch (type) {
    case "TOGGLE":
      return normalized.toLowerCase() === "true" || normalized === "1";
    case "NUMBER": {
      const parsed = Number.parseFloat(normalized);
      if (!Number.isFinite(parsed)) {
        throw new Error("Default value must be numeric.");
      }
      return parsed;
    }
    case "MULTI_SELECT": {
      try {
        const parsed = JSON.parse(normalized) as unknown;
        if (!Array.isArray(parsed)) {
          throw new Error("Default value must be a JSON array.");
        }
        return parsed.map((entry) => String(entry));
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : "Default value must be valid JSON.");
      }
    }
    case "SELECT":
    case "TEXT":
    case "TEXTAREA":
    case "EMAIL":
    case "PHONE":
    case "URL":
    case "COLOR":
    case "PASSWORD":
      return normalized;
    case "FILE": {
      try {
        return JSON.parse(normalized) as unknown;
      } catch {
        throw new Error("File defaults must be valid JSON or empty.");
      }
    }
    default:
      return normalized;
  }
}

function getSubmitValue(setting: SettingDefinitionItem, rawValue: unknown) {
  switch (setting.type) {
    case "TOGGLE":
      return Boolean(rawValue);
    case "NUMBER":
      return typeof rawValue === "string" ? rawValue.trim() : String(rawValue ?? "");
    case "MULTI_SELECT":
      return Array.isArray(rawValue) ? rawValue : [];
    case "FILE":
      return rawValue ?? null;
    case "PASSWORD":
    case "TEXT":
    case "TEXTAREA":
    case "EMAIL":
    case "PHONE":
    case "URL":
    case "COLOR":
    case "SELECT":
    default:
      return typeof rawValue === "string" ? rawValue : String(rawValue ?? "");
  }
}

function groupSettings(settings: SettingDefinitionItem[]) {
  const grouped = new Map<string, SettingDefinitionItem[]>();

  for (const setting of settings) {
    const groupName = setting.groupName?.trim() || "General";
    const entries = grouped.get(groupName) ?? [];
    entries.push(setting);
    grouped.set(groupName, entries);
  }

  return Array.from(grouped.entries())
    .map(([name, entries]) => ({
      name,
      settings: entries.sort((left, right) => left.displayOrder - right.displayOrder || left.label.localeCompare(right.label)),
    }))
    .sort((left, right) => left.settings[0].displayOrder - right.settings[0].displayOrder || left.name.localeCompare(right.name));
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Never";
  }

  try {
    return new Date(value).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

function formatAuditValue(value: unknown) {
  if (value === null || value === undefined) {
    return "—";
  }

  if (typeof value === "string") {
    return value.length > 64 ? `${value.slice(0, 61)}...` : value;
  }

  try {
    const serialized = JSON.stringify(value);
    return serialized.length > 96 ? `${serialized.slice(0, 93)}...` : serialized;
  } catch {
    return String(value);
  }
}

function getSettingValueSummary(setting: SettingDefinitionItem, rawValue: unknown) {
  if (setting.isEncrypted) {
    if (typeof rawValue === "string" && rawValue.trim().length > 0) {
      return "A new secret will be saved when you apply changes.";
    }

    return setting.hasStoredValue ? "A secret is already stored for this field." : "No secret stored yet.";
  }

  if (setting.type === "FILE") {
    if (isSettingsAssetValue(rawValue)) {
      return `Using ${rawValue.originalName}.`;
    }

    return "No file uploaded.";
  }

  if (setting.hasStoredValue) {
    return "A saved value overrides the default for this setting.";
  }

  return "This field is currently using its default value.";
}

function parseIntegerInput(rawValue: string, fallbackValue = 0) {
  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) ? parsed : fallbackValue;
}

export function SettingsWorkspace() {
  const [overview, setOverview] = useState<SettingsOverview | null>(null);
  const [selectedCategoryCode, setSelectedCategoryCode] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<SettingsCategoryDetail | null>(null);
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [isLoadingCategory, setIsLoadingCategory] = useState(false);
  const [isSavingValues, setIsSavingValues] = useState(false);
  const [isResettingCategory, setIsResettingCategory] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [isSavingDefinition, setIsSavingDefinition] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [testEmailRecipient, setTestEmailRecipient] = useState("");
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [categorySheetMode, setCategorySheetMode] = useState<"create" | "edit">("create");
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(buildEmptyCategoryForm());
  const [definitionSheetOpen, setDefinitionSheetOpen] = useState(false);
  const [definitionSheetMode, setDefinitionSheetMode] = useState<"create" | "edit">("create");
  const [editingDefinitionId, setEditingDefinitionId] = useState<string | null>(null);
  const [definitionForm, setDefinitionForm] = useState<DefinitionFormState>(buildEmptyDefinitionForm());

  async function loadOverview(preferredCategoryCode?: string | null) {
    setIsLoadingOverview(true);

    try {
      const response = await fetch("/api/settings", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as ApiResponse<SettingsOverview> | null;
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error || "Unable to load settings overview.");
      }

      setOverview(payload.data);

      if (payload.data.categories.length === 0) {
        setSelectedCategoryCode(null);
        setSelectedCategory(null);
        setFormValues({});
        return;
      }

      const nextSelectedCode =
        preferredCategoryCode && payload.data.categories.some((category) => category.code === preferredCategoryCode)
          ? preferredCategoryCode
          : selectedCategoryCode && payload.data.categories.some((category) => category.code === selectedCategoryCode)
            ? selectedCategoryCode
            : payload.data.categories[0].code;

      if (nextSelectedCode !== selectedCategoryCode) {
        setSelectedCategoryCode(nextSelectedCode);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load settings overview.");
    } finally {
      setIsLoadingOverview(false);
    }
  }

  async function loadCategory(categoryCode: string) {
    setIsLoadingCategory(true);

    try {
      const response = await fetch(`/api/settings/${categoryCode}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as ApiResponse<SettingsCategoryDetail> | null;
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error || "Unable to load settings category.");
      }

      setSelectedCategory(payload.data);
      setFormValues(buildSettingsFormState(payload.data.settings));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load settings category.");
    } finally {
      setIsLoadingCategory(false);
    }
  }

  useEffect(() => {
    void loadOverview();
  }, []);

  useEffect(() => {
    if (!selectedCategoryCode) {
      return;
    }

    void loadCategory(selectedCategoryCode);
  }, [selectedCategoryCode]);

  const groupedSettings = selectedCategory ? groupSettings(selectedCategory.settings) : [];

  async function handleSaveValues() {
    if (!selectedCategory) {
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsSavingValues(true);

    try {
      const values = selectedCategory.settings.reduce<Record<string, unknown>>((accumulator, setting) => {
        accumulator[setting.key] = getSubmitValue(setting, formValues[setting.key]);
        return accumulator;
      }, {});

      const preserveEncryptedKeys = selectedCategory.settings
        .filter(
          (setting) =>
            setting.isEncrypted &&
            setting.hasStoredValue &&
            typeof formValues[setting.key] === "string" &&
            String(formValues[setting.key]).trim().length === 0,
        )
        .map((setting) => setting.key);

      const response = await fetch(`/api/settings/${selectedCategory.category.code}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          values,
          preserveEncryptedKeys,
        }),
      });

      const payload = (await response.json().catch(() => null)) as ApiResponse<SettingsCategoryDetail> | null;
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error || "Unable to save settings values.");
      }

      setSelectedCategory(payload.data);
      setFormValues(buildSettingsFormState(payload.data.settings));
      setSuccessMessage(`Saved settings for ${payload.data.category.name}.`);
      toast.success(`Saved settings for ${payload.data.category.name}.`);
      await loadOverview(payload.data.category.code);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Unable to save settings values.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSavingValues(false);
    }
  }

  async function handleResetCategory() {
    if (!selectedCategory || !window.confirm(`Reset ${selectedCategory.category.name} to its default values?`)) {
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsResettingCategory(true);

    try {
      const response = await fetch("/api/settings/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          categoryCode: selectedCategory.category.code,
        }),
      });

      const payload = (await response.json().catch(() => null)) as ApiResponse<SettingsCategoryDetail> | null;
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error || "Unable to reset settings category.");
      }

      setSelectedCategory(payload.data);
      setFormValues(buildSettingsFormState(payload.data.settings));
      setSuccessMessage(`${payload.data.category.name} was reset to defaults.`);
      toast.success(`${payload.data.category.name} was reset to defaults.`);
      await loadOverview(payload.data.category.code);
    } catch (resetError) {
      const message = resetError instanceof Error ? resetError.message : "Unable to reset settings category.";
      setError(message);
      toast.error(message);
    } finally {
      setIsResettingCategory(false);
    }
  }

  async function handleSendTestEmail() {
    if (!selectedCategory || selectedCategory.category.code !== "email") {
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsSendingTestEmail(true);

    try {
      const values = selectedCategory.settings.reduce<Record<string, unknown>>((accumulator, setting) => {
        accumulator[setting.key] = getSubmitValue(setting, formValues[setting.key]);
        return accumulator;
      }, {});

      const response = await fetch("/api/settings/test-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipientEmail: testEmailRecipient.trim() || undefined,
          values,
        }),
      });

      const payload = (await response.json().catch(() => null)) as ApiResponse<{ recipientEmail: string; providerMessageId: string | null }> | null;
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error || "Unable to send test email.");
      }

      setSuccessMessage(
        payload.data.providerMessageId
          ? `Test email sent to ${payload.data.recipientEmail}. Provider message id: ${payload.data.providerMessageId}.`
          : `Test email sent to ${payload.data.recipientEmail}.`,
      );
      toast.success(`Test email sent to ${payload.data.recipientEmail}.`);
    } catch (testError) {
      const message = testError instanceof Error ? testError.message : "Unable to send test email.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSendingTestEmail(false);
    }
  }

  async function handleFileUpload(setting: SettingDefinitionItem, file: File | null) {
    if (!file) {
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setUploadingKey(setting.key);

    try {
      const body = new FormData();
      body.append("settingKey", setting.key);
      body.append("file", file);

      const response = await fetch("/api/settings/upload", {
        method: "POST",
        body,
      });

      const payload = (await response.json().catch(() => null)) as ApiResponse<SettingsAssetValue> | null;
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error || `Unable to upload file for ${setting.label}.`);
      }

      setFormValues((current) => ({
        ...current,
        [setting.key]: payload.data,
      }));
      setSuccessMessage(`${file.name} uploaded. Save the category to persist the asset.`);
      toast.success(`${file.name} uploaded successfully.`);
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : `Unable to upload file for ${setting.label}.`;
      setError(message);
      toast.error(message);
    } finally {
      setUploadingKey(null);
    }
  }

  function openCreateCategorySheet() {
    setCategorySheetMode("create");
    setCategoryForm(buildEmptyCategoryForm());
    setCategorySheetOpen(true);
  }

  function openEditCategorySheet() {
    if (!selectedCategory) {
      return;
    }

    setCategorySheetMode("edit");
    setCategoryForm(buildCategoryForm(selectedCategory.category));
    setCategorySheetOpen(true);
  }

  async function handleCategorySubmit() {
    setError(null);
    setSuccessMessage(null);
    setIsSavingCategory(true);

    try {
      const endpoint =
        categorySheetMode === "create" || !selectedCategory ? "/api/settings/categories" : `/api/settings/categories/${selectedCategory.category.id}`;
      const method = categorySheetMode === "create" || !selectedCategory ? "POST" : "PATCH";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: categoryForm.name.trim(),
          code: categoryForm.code.trim(),
          description: categoryForm.description.trim(),
          icon: categoryForm.icon.trim(),
          displayOrder: parseIntegerInput(categoryForm.displayOrder),
          isActive: categoryForm.isActive,
        }),
      });

      const payload = (await response.json().catch(() => null)) as ApiResponse<SettingsCategoryDetail> | null;
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error || "Unable to save settings category.");
      }

      setCategorySheetOpen(false);
      setSelectedCategoryCode(payload.data.category.code);
      setSuccessMessage(
        categorySheetMode === "create"
          ? `Created category ${payload.data.category.name}.`
          : `Updated category ${payload.data.category.name}.`,
      );
      toast.success(categorySheetMode === "create" ? `Created category ${payload.data.category.name}.` : `Updated category ${payload.data.category.name}.`);
      await loadOverview(payload.data.category.code);
      await loadCategory(payload.data.category.code);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Unable to save settings category.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSavingCategory(false);
    }
  }

  async function handleDeleteCategory() {
    if (!selectedCategory || selectedCategory.category.isSystem) {
      return;
    }

    if (!window.confirm(`Delete ${selectedCategory.category.name} and all of its settings?`)) {
      return;
    }

    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/settings/categories/${selectedCategory.category.id}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as ApiResponse<{ ok: true }> | null;
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error || "Unable to delete settings category.");
      }

      const fallbackCategoryCode = overview?.categories.find((category) => category.code !== selectedCategory.category.code)?.code ?? null;
      setSelectedCategoryCode(fallbackCategoryCode);
      setSelectedCategory(null);
      setFormValues({});
      setSuccessMessage(`Deleted category ${selectedCategory.category.name}.`);
      toast.success(`Deleted category ${selectedCategory.category.name}.`);
      await loadOverview(fallbackCategoryCode);
      if (fallbackCategoryCode) {
        await loadCategory(fallbackCategoryCode);
      }
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Unable to delete settings category.";
      setError(message);
      toast.error(message);
    }
  }

  function openCreateDefinitionSheet() {
    setDefinitionSheetMode("create");
    setEditingDefinitionId(null);
    setDefinitionForm(buildEmptyDefinitionForm(selectedCategory?.category.id ?? overview?.categories[0]?.id ?? ""));
    setDefinitionSheetOpen(true);
  }

  function openEditDefinitionSheet(setting: SettingDefinitionItem) {
    if (!selectedCategory) {
      return;
    }

    setDefinitionSheetMode("edit");
    setEditingDefinitionId(setting.id);
    setDefinitionForm(buildDefinitionForm(selectedCategory.category.id, setting));
    setDefinitionSheetOpen(true);
  }

  async function handleDefinitionSubmit() {
    setError(null);
    setSuccessMessage(null);
    setIsSavingDefinition(true);

    try {
      const options = parseOptions(definitionForm.optionsText);
      const validationRules = parseJsonObject(definitionForm.validationRulesText, "Validation rules");
      const payload = {
        categoryId: definitionForm.categoryId,
        key: definitionForm.key.trim(),
        label: definitionForm.label.trim(),
        description: definitionForm.description.trim(),
        type: definitionForm.type,
        defaultValue: parseDefinitionDefaultValue(definitionForm.type, definitionForm.defaultValueText),
        placeholder: definitionForm.placeholder.trim(),
        helpText: definitionForm.helpText.trim(),
        options,
        validationRules,
        groupName: definitionForm.groupName.trim(),
        displayOrder: parseIntegerInput(definitionForm.displayOrder),
        isRequired: definitionForm.isRequired,
        isEncrypted: definitionForm.isEncrypted,
        isReadonly: definitionForm.isReadonly,
        isActive: definitionForm.isActive,
      };

      const requestUrl =
        definitionSheetMode === "create" || !editingDefinitionId ? "/api/settings/definitions" : `/api/settings/definitions/${editingDefinitionId}`;
      const response = await fetch(requestUrl, {
        method: definitionSheetMode === "create" || !editingDefinitionId ? "POST" : "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const parsed = (await response.json().catch(() => null)) as ApiResponse<SettingDefinitionItem & { category?: { code?: string } }> | null;
      if (!response.ok) {
        throw new Error(parsed?.error || "Unable to save setting definition.");
      }

      const nextCategoryCode = overview?.categories.find((category) => category.id === definitionForm.categoryId)?.code ?? selectedCategoryCode;
      setDefinitionSheetOpen(false);
      setSuccessMessage(
        definitionSheetMode === "create"
          ? `Created setting ${definitionForm.label.trim() || definitionForm.key.trim()}.`
          : `Updated setting ${definitionForm.label.trim() || definitionForm.key.trim()}.`,
      );
      toast.success(definitionSheetMode === "create" ? `Created setting ${definitionForm.label.trim() || definitionForm.key.trim()}.` : `Updated setting ${definitionForm.label.trim() || definitionForm.key.trim()}.`);

      if (nextCategoryCode) {
        setSelectedCategoryCode(nextCategoryCode);
        await loadOverview(nextCategoryCode);
        await loadCategory(nextCategoryCode);
      } else {
        await loadOverview();
      }
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Unable to save setting definition.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSavingDefinition(false);
    }
  }

  async function handleDeleteDefinition(setting: SettingDefinitionItem) {
    if (setting.isSystem || !window.confirm(`Delete setting ${setting.label}?`)) {
      return;
    }

    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/settings/definitions/${setting.id}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as ApiResponse<{ ok: true }> | null;
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error || "Unable to delete setting definition.");
      }

      setSuccessMessage(`Deleted setting ${setting.label}.`);
      toast.success(`Deleted setting ${setting.label}.`);

      if (selectedCategoryCode) {
        await loadOverview(selectedCategoryCode);
        await loadCategory(selectedCategoryCode);
      }
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Unable to delete setting definition.";
      setError(message);
      toast.error(message);
    }
  }

  function renderSettingInput(setting: SettingDefinitionItem) {
    const value = formValues[setting.key];
    const disabled = setting.isReadonly || isSavingValues || isResettingCategory || uploadingKey === setting.key;

    if (setting.type === "TOGGLE") {
      return (
        <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">{Boolean(value) ? "Enabled" : "Disabled"}</p>
            <p className="text-xs text-slate-500">Toggle the effective runtime state for this option.</p>
          </div>
          <Checkbox checked={Boolean(value)} disabled={disabled} onCheckedChange={(checked) => {
            setFormValues((current) => ({
              ...current,
              [setting.key]: checked === true,
            }));
          }} />
        </label>
      );
    }

    if (setting.type === "SELECT") {
      return (
        <select
          className={SELECT_CLASS_NAME}
          disabled={disabled}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => {
            setFormValues((current) => ({
              ...current,
              [setting.key]: event.target.value,
            }));
          }}
        >
          <option value="">Select an option</option>
          {setting.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (setting.type === "MULTI_SELECT") {
      const selectedValues = Array.isArray(value) ? value.map((entry) => String(entry)) : [];

      return (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
          {setting.options.map((option) => {
            const checked = selectedValues.includes(option.value);

            return (
              <label key={option.value} className="flex items-center gap-3 text-sm text-slate-700">
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={(nextChecked) => {
                    setFormValues((current) => {
                      const currentEntry = current[setting.key];
                      const currentValues = Array.isArray(currentEntry)
                        ? currentEntry.map((entry: unknown) => String(entry))
                        : [];

                      return {
                        ...current,
                        [setting.key]: nextChecked === true
                          ? Array.from(new Set([...currentValues, option.value]))
                          : currentValues.filter((entry: string) => entry !== option.value),
                      };
                    });
                  }}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      );
    }

    if (setting.type === "TEXTAREA") {
      return (
        <textarea
          className={TEXTAREA_CLASS_NAME}
          disabled={disabled}
          placeholder={setting.placeholder ?? undefined}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => {
            setFormValues((current) => ({
              ...current,
              [setting.key]: event.target.value,
            }));
          }}
        />
      );
    }

    if (setting.type === "FILE") {
      const asset = isSettingsAssetValue(value) ? value : null;
      const isImageAsset = asset?.mimeType.startsWith("image/") ?? false;

      return (
        <div className="space-y-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
          {asset ? (
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{asset.originalName}</p>
                  <p className="text-xs text-slate-500">{asset.mimeType} · {Math.round(asset.size / 1024)} KB</p>
                </div>
                <a href={asset.url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary">
                  Open asset
                </a>
              </div>
              {isImageAsset ? (
                <img src={asset.url} alt={setting.label} className="mt-3 max-h-32 rounded-xl border border-slate-100 object-contain" />
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No asset uploaded for this setting yet.</p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-[#dde1e6] transition-colors hover:bg-slate-50">
              {uploadingKey === setting.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload file
              <input
                className="hidden"
                type="file"
                disabled={disabled}
                onChange={(event) => {
                  void handleFileUpload(setting, event.target.files?.[0] ?? null);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            {asset ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => {
                  setFormValues((current) => ({
                    ...current,
                    [setting.key]: null,
                  }));
                }}
              >
                Remove
              </Button>
            ) : null}
          </div>
        </div>
      );
    }

    const inputType =
      setting.type === "NUMBER"
        ? "number"
        : setting.type === "EMAIL"
          ? "email"
          : setting.type === "PHONE"
            ? "tel"
            : setting.type === "URL"
              ? "url"
              : setting.type === "COLOR"
                ? "color"
                : setting.type === "PASSWORD"
                  ? "password"
                  : "text";

    return (
      <Input
        className={setting.type === "COLOR" ? "h-11 px-2 py-1" : undefined}
        disabled={disabled}
        type={inputType}
        placeholder={setting.isEncrypted && setting.hasStoredValue ? SETTINGS_SECRET_MASK : setting.placeholder ?? undefined}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => {
          setFormValues((current) => ({
            ...current,
            [setting.key]: event.target.value,
          }));
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">Global Settings</h1>
          <p className="mt-2 max-w-3xl text-sm font-medium text-slate-500">
            Centralize branding, authentication controls, SMTP delivery, uploads, and custom configuration from a single admin surface.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => void loadOverview(selectedCategoryCode)} disabled={isLoadingOverview || isLoadingCategory}>
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
          <CanAccess permission="settings.manage">
            <Button type="button" onClick={openCreateCategorySheet}>
              <Plus className="h-4 w-4" />
              New Category
            </Button>
          </CanAccess>
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
      {successMessage ? <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{successMessage}</div> : null}

      <div className="grid gap-4 md:grid-cols-3">
        {(overview?.metrics ?? []).map((metric) => (
          <Card key={metric.label}>
            <CardHeader className="pb-3">
              <CardDescription>{metric.label}</CardDescription>
              <CardTitle className="text-3xl text-slate-950">{isLoadingOverview ? "—" : metric.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">{metric.helper}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px,minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Categories
              </CardTitle>
              <CardDescription>Choose a configuration group to inspect, update, or extend.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoadingOverview && !(overview?.categories.length) ? (
                <p className="text-sm text-slate-500">Loading categories…</p>
              ) : overview?.categories.length ? (
                overview.categories.map((category) => {
                  const Icon = getCategoryIcon(category.icon);
                  const isActive = category.code === selectedCategoryCode;

                  return (
                    <button
                      key={category.code}
                      type="button"
                      onClick={() => {
                        setError(null);
                        setSuccessMessage(null);
                        setSelectedCategoryCode(category.code);
                      }}
                      className={cn(
                        "w-full rounded-2xl border p-4 text-left transition-colors",
                        isActive ? "border-primary bg-[#eef2ff]" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl", isActive ? "bg-white text-primary" : "bg-slate-100 text-slate-600")}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{category.name}</p>
                            <p className="text-xs text-slate-500">{category.code}</p>
                          </div>
                        </div>
                        <Badge variant={category.isSystem ? "info" : "accent"}>{category.isSystem ? "System" : "Custom"}</Badge>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-slate-500">{category.description ?? "No description provided."}</p>
                      <div className="mt-4 flex items-center justify-between text-xs font-semibold text-slate-500">
                        <span>{category.configuredCount}/{category.settingCount} configured</span>
                        <span>{category.isActive ? "Active" : "Disabled"}</span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <p className="text-sm text-slate-500">No categories available yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowUpRight className="h-5 w-5 text-primary" />
                Tools
              </CardTitle>
              <CardDescription>Operational pages that sit under the settings workspace.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(overview?.tools ?? []).map((tool) => (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  <div>
                    <p className="text-sm font-bold text-slate-900">{tool.label}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{tool.description}</p>
                  </div>
                  <ArrowUpRight className="mt-0.5 h-4 w-4 text-slate-400" />
                </Link>
              ))}
              {!overview?.tools.length ? <p className="text-sm text-slate-500">No tools are registered yet.</p> : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {!selectedCategoryCode ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-slate-500">Select a category to begin configuring runtime settings.</CardContent>
            </Card>
          ) : isLoadingCategory && !selectedCategory ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-slate-500">Loading category details…</CardContent>
            </Card>
          ) : selectedCategory ? (
            <>
              <Card className="overflow-hidden">
                <CardHeader className="border-b border-slate-100 bg-[linear-gradient(135deg,#f8fbff_0%,#eef5ff_52%,#f8fbff_100%)]">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={selectedCategory.category.isSystem ? "info" : "accent"}>
                          {selectedCategory.category.isSystem ? "System Category" : "Custom Category"}
                        </Badge>
                        <Badge variant={selectedCategory.category.isActive ? "success" : "warning"}>
                          {selectedCategory.category.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <Badge variant="default">{selectedCategory.settings.length} fields</Badge>
                      </div>
                      <div>
                        <CardTitle className="text-2xl text-slate-950">{selectedCategory.category.name}</CardTitle>
                        <CardDescription className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                          {selectedCategory.category.description ?? "No description has been recorded for this category yet."}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CanAccess permission="settings.manage">
                        <Button type="button" variant="secondary" onClick={openEditCategorySheet}>
                          <Pencil className="h-4 w-4" />
                          Edit Category
                        </Button>
                      </CanAccess>
                      <CanAccess permission="settings.manage">
                        <Button type="button" variant="secondary" onClick={openCreateDefinitionSheet}>
                          <Plus className="h-4 w-4" />
                          Add Field
                        </Button>
                      </CanAccess>
                      <CanAccess permission="settings.edit">
                        <Button type="button" variant="secondary" onClick={() => void handleResetCategory()} disabled={isResettingCategory || isSavingValues}>
                          {isResettingCategory ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                          Reset Defaults
                        </Button>
                      </CanAccess>
                      <CanAccess permission="settings.manage">
                        {!selectedCategory.category.isSystem ? (
                          <Button type="button" variant="ghost" className="text-rose-600 hover:text-rose-700" onClick={() => void handleDeleteCategory()}>
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        ) : null}
                      </CanAccess>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 border-t border-slate-100 bg-white p-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Configured</p>
                      <p className="mt-1 text-lg font-bold text-slate-900">{selectedCategory.category.configuredCount} / {selectedCategory.category.settingCount}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Category Code</p>
                      <p className="mt-1 text-lg font-bold text-slate-900">{selectedCategory.category.code}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Last Updated</p>
                      <p className="mt-1 text-lg font-bold text-slate-900">{formatDateTime(selectedCategory.category.updatedAt)}</p>
                    </div>
                  </div>
                  <CanAccess permission="settings.edit">
                    <Button type="button" onClick={() => void handleSaveValues()} disabled={isSavingValues || isResettingCategory || isLoadingCategory}>
                      {isSavingValues ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save Changes
                    </Button>
                  </CanAccess>
                </CardContent>
              </Card>

              {selectedCategory.category.code === "email" ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="h-5 w-5 text-primary" />
                      SMTP Test
                    </CardTitle>
                    <CardDescription>
                      Send a live test using the current form values. Unsaved SMTP changes are included in the test request.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-end">
                    <div className="flex-1 space-y-2">
                      <label className="text-sm font-semibold text-slate-700" htmlFor="settings-test-email-recipient">Recipient Email</label>
                      <Input
                        id="settings-test-email-recipient"
                        type="email"
                        placeholder="Leave empty to send to your signed-in account"
                        value={testEmailRecipient}
                        onChange={(event) => setTestEmailRecipient(event.target.value)}
                        disabled={isSendingTestEmail}
                      />
                    </div>
                    <Button type="button" onClick={() => void handleSendTestEmail()} disabled={isSendingTestEmail}>
                      {isSendingTestEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                      Send Test Email
                    </Button>
                  </CardContent>
                </Card>
              ) : null}

              {groupedSettings.map((group) => (
                <Card key={group.name}>
                  <CardHeader>
                    <CardTitle>{group.name}</CardTitle>
                    <CardDescription>{group.settings.length} fields in this group.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 lg:grid-cols-2">
                      {group.settings.map((setting) => (
                        <div key={setting.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-bold text-slate-950">{setting.label}</h3>
                                {setting.isRequired ? <Badge variant="warning">Required</Badge> : null}
                                {setting.isEncrypted ? <Badge variant="info">Secret</Badge> : null}
                                {setting.isReadonly ? <Badge variant="default">Read-only</Badge> : null}
                                {setting.isSystem ? <Badge variant="info">System</Badge> : <Badge variant="accent">Custom</Badge>}
                              </div>
                              <p className="mt-2 text-xs leading-5 text-slate-500">{setting.description ?? "No description provided for this setting."}</p>
                            </div>
                            <CanAccess permission="settings.manage">
                              <div className="flex items-center gap-1">
                                <Button type="button" variant="ghost" size="sm" onClick={() => openEditDefinitionSheet(setting)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                {!setting.isSystem ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-rose-600 hover:text-rose-700"
                                    onClick={() => void handleDeleteDefinition(setting)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                ) : null}
                              </div>
                            </CanAccess>
                          </div>

                          <div className="mt-4 space-y-3">
                            {renderSettingInput(setting)}
                            {setting.helpText ? <p className="text-xs text-slate-500">{setting.helpText}</p> : null}
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                              <span>{getSettingValueSummary(setting, formValues[setting.key])}</span>
                              <span className="font-semibold">Key: {setting.key}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    Recent Audit Trail
                  </CardTitle>
                  <CardDescription>Recent change activity captured for the selected category.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedCategory.recentAuditLogs.length > 0 ? (
                    selectedCategory.recentAuditLogs.map((entry) => (
                      <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="default">{entry.action}</Badge>
                              <p className="text-sm font-semibold text-slate-900">{entry.settingKey}</p>
                            </div>
                            <p className="mt-2 text-xs text-slate-500">Changed {formatDateTime(entry.createdAt)} · Actor {entry.actorUserId ?? "system"}</p>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Previous</p>
                            <p className="mt-2 text-sm text-slate-700">{formatAuditValue(entry.oldValue)}</p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Next</p>
                            <p className="mt-2 text-sm text-slate-700">{formatAuditValue(entry.newValue)}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                      No audit entries have been recorded for this category yet.
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-sm text-slate-500">This category could not be loaded. Try refreshing the workspace.</CardContent>
            </Card>
          )}
        </div>
      </div>

      <Sheet open={categorySheetOpen} onOpenChange={setCategorySheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{categorySheetMode === "create" ? "Create Settings Category" : "Edit Settings Category"}</SheetTitle>
            <SheetDescription>Define a reusable settings group that can hold seeded or custom configuration fields.</SheetDescription>
          </SheetHeader>

          <div className="space-y-4 p-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="settings-category-name">Category Name</label>
              <Input
                id="settings-category-name"
                value={categoryForm.name}
                onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))}
                disabled={isSavingCategory}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700" htmlFor="settings-category-code">Code</label>
                <Input
                  id="settings-category-code"
                  value={categoryForm.code}
                  onChange={(event) => setCategoryForm((current) => ({ ...current, code: event.target.value }))}
                  disabled={isSavingCategory || (categorySheetMode === "edit" && selectedCategory?.category.isSystem)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700" htmlFor="settings-category-order">Display Order</label>
                <Input
                  id="settings-category-order"
                  type="number"
                  value={categoryForm.displayOrder}
                  onChange={(event) => setCategoryForm((current) => ({ ...current, displayOrder: event.target.value }))}
                  disabled={isSavingCategory}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="settings-category-icon">Icon</label>
              <select
                id="settings-category-icon"
                className={SELECT_CLASS_NAME}
                value={categoryForm.icon}
                onChange={(event) => setCategoryForm((current) => ({ ...current, icon: event.target.value }))}
                disabled={isSavingCategory}
              >
                {CATEGORY_ICON_OPTIONS.map((iconName) => (
                  <option key={iconName} value={iconName}>
                    {iconName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="settings-category-description">Description</label>
              <textarea
                id="settings-category-description"
                className={TEXTAREA_CLASS_NAME}
                value={categoryForm.description}
                onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))}
                disabled={isSavingCategory}
              />
            </div>
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
              <Checkbox
                checked={categoryForm.isActive}
                disabled={isSavingCategory}
                onCheckedChange={(checked) => setCategoryForm((current) => ({ ...current, isActive: checked === true }))}
              />
              Category is active
            </label>
          </div>

          <SheetFooter>
            <Button type="button" variant="secondary" onClick={() => setCategorySheetOpen(false)} disabled={isSavingCategory}>Cancel</Button>
            <Button type="button" onClick={() => void handleCategorySubmit()} disabled={isSavingCategory}>
              {isSavingCategory ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {categorySheetMode === "create" ? "Create Category" : "Save Category"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={definitionSheetOpen} onOpenChange={setDefinitionSheetOpen}>
        <SheetContent className="sm:max-w-[620px]">
          <SheetHeader>
            <SheetTitle>{definitionSheetMode === "create" ? "Create Setting Field" : "Edit Setting Field"}</SheetTitle>
            <SheetDescription>Fields are stored in the database and drive the dynamic form rendered for the category.</SheetDescription>
          </SheetHeader>

          <div className="space-y-4 p-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="settings-definition-category">Category</label>
              <select
                id="settings-definition-category"
                className={SELECT_CLASS_NAME}
                value={definitionForm.categoryId}
                onChange={(event) => setDefinitionForm((current) => ({ ...current, categoryId: event.target.value }))}
                disabled={isSavingDefinition}
              >
                {(overview?.categories ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700" htmlFor="settings-definition-key">Setting Key</label>
                <Input
                  id="settings-definition-key"
                  value={definitionForm.key}
                  onChange={(event) => setDefinitionForm((current) => ({ ...current, key: event.target.value }))}
                  disabled={isSavingDefinition || (definitionSheetMode === "edit" && selectedCategory?.settings.find((setting) => setting.id === editingDefinitionId)?.isSystem)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700" htmlFor="settings-definition-label">Label</label>
                <Input
                  id="settings-definition-label"
                  value={definitionForm.label}
                  onChange={(event) => setDefinitionForm((current) => ({ ...current, label: event.target.value }))}
                  disabled={isSavingDefinition}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="settings-definition-description">Description</label>
              <textarea
                id="settings-definition-description"
                className={TEXTAREA_CLASS_NAME}
                value={definitionForm.description}
                onChange={(event) => setDefinitionForm((current) => ({ ...current, description: event.target.value }))}
                disabled={isSavingDefinition}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700" htmlFor="settings-definition-type">Field Type</label>
                <select
                  id="settings-definition-type"
                  className={SELECT_CLASS_NAME}
                  value={definitionForm.type}
                  onChange={(event) => setDefinitionForm((current) => ({ ...current, type: event.target.value as SettingFieldType }))}
                  disabled={isSavingDefinition || (definitionSheetMode === "edit" && selectedCategory?.settings.find((setting) => setting.id === editingDefinitionId)?.isSystem)}
                >
                  {SETTING_FIELD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700" htmlFor="settings-definition-order">Display Order</label>
                <Input
                  id="settings-definition-order"
                  type="number"
                  value={definitionForm.displayOrder}
                  onChange={(event) => setDefinitionForm((current) => ({ ...current, displayOrder: event.target.value }))}
                  disabled={isSavingDefinition}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="settings-definition-default">Default Value</label>
              <textarea
                id="settings-definition-default"
                className={TEXTAREA_CLASS_NAME}
                placeholder="Use JSON for arrays or objects. Leave blank for null."
                value={definitionForm.defaultValueText}
                onChange={(event) => setDefinitionForm((current) => ({ ...current, defaultValueText: event.target.value }))}
                disabled={isSavingDefinition}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700" htmlFor="settings-definition-placeholder">Placeholder</label>
                <Input
                  id="settings-definition-placeholder"
                  value={definitionForm.placeholder}
                  onChange={(event) => setDefinitionForm((current) => ({ ...current, placeholder: event.target.value }))}
                  disabled={isSavingDefinition}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700" htmlFor="settings-definition-group">Group Name</label>
                <Input
                  id="settings-definition-group"
                  value={definitionForm.groupName}
                  onChange={(event) => setDefinitionForm((current) => ({ ...current, groupName: event.target.value }))}
                  disabled={isSavingDefinition}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="settings-definition-help">Help Text</label>
              <textarea
                id="settings-definition-help"
                className={TEXTAREA_CLASS_NAME}
                value={definitionForm.helpText}
                onChange={(event) => setDefinitionForm((current) => ({ ...current, helpText: event.target.value }))}
                disabled={isSavingDefinition}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="settings-definition-options">Options JSON</label>
              <textarea
                id="settings-definition-options"
                className={TEXTAREA_CLASS_NAME}
                placeholder='[{"label":"Option A","value":"OPTION_A"}]'
                value={definitionForm.optionsText}
                onChange={(event) => setDefinitionForm((current) => ({ ...current, optionsText: event.target.value }))}
                disabled={isSavingDefinition}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="settings-definition-rules">Validation Rules JSON</label>
              <textarea
                id="settings-definition-rules"
                className={TEXTAREA_CLASS_NAME}
                placeholder='{"minLength": 3, "maxLength": 120}'
                value={definitionForm.validationRulesText}
                onChange={(event) => setDefinitionForm((current) => ({ ...current, validationRulesText: event.target.value }))}
                disabled={isSavingDefinition}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                <Checkbox
                  checked={definitionForm.isRequired}
                  disabled={isSavingDefinition}
                  onCheckedChange={(checked) => setDefinitionForm((current) => ({ ...current, isRequired: checked === true }))}
                />
                Required
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                <Checkbox
                  checked={definitionForm.isEncrypted}
                  disabled={isSavingDefinition || (definitionSheetMode === "edit" && selectedCategory?.settings.find((setting) => setting.id === editingDefinitionId)?.isSystem)}
                  onCheckedChange={(checked) => setDefinitionForm((current) => ({ ...current, isEncrypted: checked === true }))}
                />
                Encrypted
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                <Checkbox
                  checked={definitionForm.isReadonly}
                  disabled={isSavingDefinition}
                  onCheckedChange={(checked) => setDefinitionForm((current) => ({ ...current, isReadonly: checked === true }))}
                />
                Read-only
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                <Checkbox
                  checked={definitionForm.isActive}
                  disabled={isSavingDefinition}
                  onCheckedChange={(checked) => setDefinitionForm((current) => ({ ...current, isActive: checked === true }))}
                />
                Active
              </label>
            </div>
          </div>

          <SheetFooter>
            <Button type="button" variant="secondary" onClick={() => setDefinitionSheetOpen(false)} disabled={isSavingDefinition}>Cancel</Button>
            <Button type="button" onClick={() => void handleDefinitionSubmit()} disabled={isSavingDefinition}>
              {isSavingDefinition ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {definitionSheetMode === "create" ? "Create Field" : "Save Field"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}