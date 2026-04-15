"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Languages, Loader2, PencilLine, Plus, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/ui/can-access";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BuddyPersonaDialog } from "@/components/modules/language-lab/buddy-persona-dialog";
import { normalizeCapabilities } from "@/lib/language-lab/content-blocks";
import {
  LANGUAGE_LAB_CATEGORY_CODE,
  LANGUAGE_LAB_DEFAULT_CONFIG,
  LANGUAGE_LAB_SETTING_KEYS,
} from "@/lib/language-lab/default-config";
import type { LanguageLabBuddyPersonaItem } from "@/lib/language-lab/types";
import type { SettingDefinitionItem, SettingsCategoryDetail } from "@/services/settings/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ApiResponse<T> = {
  data?: T;
  error?: string;
};

type BuddyPersonaFilters = {
  search: string;
  isActive: "all" | "active" | "inactive";
};

type CourseOption = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  isActive: boolean;
  programCount: number;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SELECT_CLASS_NAME =
  "flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84] disabled:cursor-not-allowed disabled:opacity-50";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildQueryString(params: Record<string, string | number | boolean | null | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const normalized = typeof value === "string" ? value.trim() : String(value);
    if (!normalized) continue;
    searchParams.set(key, normalized);
  }
  return searchParams.toString();
}

async function readApi<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { cache: "no-store", ...init });
  const body = (await response.json()) as ApiResponse<T>;
  if (!response.ok || body.data === undefined) {
    throw new Error(body.error ?? "Request failed.");
  }
  return body.data;
}

function getSettingByKey(detail: SettingsCategoryDetail | null, key: string) {
  return detail?.settings.find((setting) => setting.key === key);
}

function getResolvedSettingValue(setting: SettingDefinitionItem | undefined, fallbackValue = "") {
  const rawValue = setting?.value ?? setting?.defaultValue;
  if (typeof rawValue === "string") {
    return rawValue.trim().length > 0 ? rawValue : fallbackValue;
  }
  if (rawValue === null || rawValue === undefined) return fallbackValue;
  const normalized = String(rawValue);
  return normalized.trim().length > 0 ? normalized : fallbackValue;
}

function trimPreview(value: string | null | undefined, maxLength = 120) {
  const normalized = value?.trim() ?? "";
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function metricValue(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(parsed);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LanguageLabBuddyPersonasPanel() {
  const [filters, setFilters] = useState<BuddyPersonaFilters>({ search: "", isActive: "all" });
  const [personas, setPersonas] = useState<LanguageLabBuddyPersonaItem[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [baseBuddyPromptValue, setBaseBuddyPromptValue] = useState<string>(LANGUAGE_LAB_DEFAULT_CONFIG.prompts.buddy);

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<LanguageLabBuddyPersonaItem | null>(null);

  const deferredSearch = useDeferredValue(filters.search);

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadPersonas = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const query = buildQueryString({
        search: deferredSearch,
        isActive: filters.isActive === "all" ? undefined : filters.isActive === "active",
      });
      const nextPersonas = await readApi<LanguageLabBuddyPersonaItem[]>(
        `/api/language-lab/buddy-personas${query ? `?${query}` : ""}`,
      );
      setPersonas(nextPersonas);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load Buddy personas.");
    } finally {
      setIsLoading(false);
    }
  }, [deferredSearch, filters.isActive]);

  const loadCourses = useCallback(async () => {
    try {
      const nextCourses = await readApi<CourseOption[]>("/api/language-lab/buddy-personas/course-options");
      setCourses(nextCourses);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load course options.");
    }
  }, []);

  const loadBuddySettings = useCallback(async () => {
    try {
      const detail = await readApi<SettingsCategoryDetail>(`/api/settings/${LANGUAGE_LAB_CATEGORY_CODE}`);
      const buddyPromptValue = getResolvedSettingValue(
        getSettingByKey(detail, LANGUAGE_LAB_SETTING_KEYS.buddySystemPrompt),
        LANGUAGE_LAB_DEFAULT_CONFIG.prompts.buddy,
      );
      setBaseBuddyPromptValue(buddyPromptValue);
    } catch {
      setBaseBuddyPromptValue(LANGUAGE_LAB_DEFAULT_CONFIG.prompts.buddy);
    }
  }, []);

  const refreshAll = useCallback(() => {
    void Promise.all([loadPersonas(), loadCourses(), loadBuddySettings()]);
  }, [loadPersonas, loadCourses, loadBuddySettings]);

  useEffect(() => {
    void loadPersonas();
  }, [loadPersonas]);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    void loadBuddySettings();
  }, [loadBuddySettings]);

  // ---------------------------------------------------------------------------
  // Sheet handlers
  // ---------------------------------------------------------------------------

  const openCreateSheet = useCallback(() => {
    setEditingPersona(null);
    setSheetOpen(true);
  }, []);

  const openEditSheet = useCallback((persona: LanguageLabBuddyPersonaItem) => {
    setEditingPersona(persona);
    setSheetOpen(true);
  }, []);

  const handleSheetSaved = useCallback(() => {
    refreshAll();
  }, [refreshAll]);

  // ---------------------------------------------------------------------------
  // Computed values
  // ---------------------------------------------------------------------------

  const activeCount = useMemo(() => personas.filter((p) => p.isActive).length, [personas]);
  const assignedCoursesCount = useMemo(
    () => personas.reduce((total, p) => total + (p.assignedCourses?.length ?? 0), 0),
    [personas],
  );
  const languageCount = useMemo(
    () => new Set(personas.map((p) => p.languageCode?.trim().toLowerCase() ?? "").filter(Boolean)).size,
    [personas],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Personas"
          value={metricValue(personas.length)}
          helper="Total Buddy personas in catalog."
          badge="Catalog"
          badgeVariant="info"
        />
        <MetricCard
          label="Active"
          value={metricValue(activeCount)}
          helper="Personas available for candidate sessions."
          badge="Live"
          badgeVariant="success"
        />
        <MetricCard
          label="Course links"
          value={metricValue(assignedCoursesCount)}
          helper="Total course assignments."
          badge="Assignments"
        />
        <MetricCard
          label="Languages"
          value={metricValue(languageCount)}
          helper="Distinct language codes."
          badge="Locales"
          badgeVariant="accent"
        />
      </div>

      {/* Error */}
      {errorMessage && (
        <InlineErrorCard
          title="Failed to load personas"
          message={errorMessage}
          onRetry={refreshAll}
        />
      )}

      {/* Catalog */}
      <Card className="border-slate-200 bg-white">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-xl font-bold text-slate-900">Buddy Personas</CardTitle>
              <CardDescription className="mt-1 text-sm text-slate-500">
                Manage reusable Buddy identities with language, capabilities, and course assignments.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={refreshAll} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                Refresh
              </Button>
              <CanAccess permission="lms.edit">
                <Button size="sm" onClick={openCreateSheet}>
                  <Plus className="h-4 w-4" />
                  Create Persona
                </Button>
              </CanAccess>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-3">
            <Input
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder="Search personas..."
              className="max-w-xs"
            />
            <select
              className={SELECT_CLASS_NAME + " w-40"}
              value={filters.isActive}
              onChange={(e) =>
                setFilters((f) => ({ ...f, isActive: e.target.value as BuddyPersonaFilters["isActive"] }))
              }
            >
              <option value="all">All states</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <LoadingState label="Loading personas..." />
          ) : personas.length === 0 ? (
            <EmptyState
              title="No personas found"
              description="Create your first Buddy persona to get started."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {personas.map((persona) => {
                const capabilities = normalizeCapabilities(persona.capabilities);
                const courseCount = persona.assignedCourses?.length ?? 0;

                return (
                  <div
                    key={persona.id}
                    className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    {/* Main info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{persona.name}</h3>
                        <Badge variant={persona.isActive ? "success" : "warning"} className="text-[10px]">
                          {persona.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <Badge variant="accent" className="text-[10px]">
                          {persona.languageCode || "Unknown"}
                        </Badge>
                      </div>
                      {persona.description && (
                        <p className="mt-1 text-sm text-slate-500">{trimPreview(persona.description)}</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <span className="font-semibold text-slate-600">{capabilities.length}</span> capabilities
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="font-semibold text-slate-600">{courseCount}</span> course{courseCount !== 1 ? "s" : ""}
                        </span>
                        <span className="flex items-center gap-1">
                          <Languages className="h-3 w-3" />
                          {formatShortDate(persona.updatedAt)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <CanAccess permission="lms.edit">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditSheet(persona)}
                        className="shrink-0"
                      >
                        <PencilLine className="h-4 w-4" />
                        Edit
                      </Button>
                    </CanAccess>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <BuddyPersonaDialog
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        persona={editingPersona}
        courses={courses}
        baseBuddyPromptValue={baseBuddyPromptValue}
        onSaved={handleSheetSaved}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricCard({
  label,
  value,
  helper,
  badge,
  badgeVariant = "default",
}: {
  label: string;
  value: string;
  helper: string;
  badge: string;
  badgeVariant?: "default" | "success" | "warning" | "danger" | "info" | "accent";
}) {
  return (
    <Card className="border-slate-200 bg-white">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
          <Badge variant={badgeVariant} className="text-[10px]">
            {badge}
          </Badge>
        </div>
        <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
        <p className="mt-1 text-xs text-slate-500">{helper}</p>
      </CardContent>
    </Card>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="py-12 text-center">
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function InlineErrorCard({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-rose-700">{title}</p>
        <p className="text-sm text-rose-600">{message}</p>
      </div>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
