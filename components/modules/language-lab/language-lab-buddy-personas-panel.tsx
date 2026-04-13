"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Bot, Languages, Loader2, PencilLine, RefreshCcw, Save } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/ui/can-access";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { LanguageLabBuddyPersonaItem } from "@/lib/language-lab/types";
import { cn } from "@/lib/utils";

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

type BuddyPersonaDraft = {
  name: string;
  description: string;
  language: string;
  languageCode: string;
  systemPrompt: string;
  welcomeMessage: string;
  isActive: boolean;
  courseIds: string[];
};

const SELECT_CLASS_NAME =
  "flex h-11 w-full rounded-2xl border border-[#dde1e6] bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84] disabled:cursor-not-allowed disabled:opacity-50";

const TEXTAREA_CLASS_NAME =
  "flex min-h-[120px] w-full rounded-2xl border border-[#dde1e6] bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84] disabled:cursor-not-allowed disabled:opacity-50";

const EMPTY_DRAFT: BuddyPersonaDraft = {
  name: "",
  description: "",
  language: "German",
  languageCode: "de-DE",
  systemPrompt: "",
  welcomeMessage: "",
  isActive: true,
  courseIds: [],
};

function buildQueryString(params: Record<string, string | number | boolean | null | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }

    const normalized = typeof value === "string" ? value.trim() : String(value);
    if (!normalized) {
      continue;
    }

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

function toDraft(persona: LanguageLabBuddyPersonaItem): BuddyPersonaDraft {
  return {
    name: persona.name,
    description: persona.description ?? "",
    language: persona.language,
    languageCode: persona.languageCode,
    systemPrompt: persona.systemPrompt ?? "",
    welcomeMessage: persona.welcomeMessage ?? "",
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

function trimPreview(value: string | null | undefined, maxLength = 180) {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    return "";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function metricValue(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatShortDate(value: string | null | undefined) {
  if (!value) {
    return "Unknown update";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown update";
  }

  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(parsed);
}

export function LanguageLabBuddyPersonasPanel() {
  const [filters, setFilters] = useState<BuddyPersonaFilters>({ search: "", isActive: "all" });
  const [personas, setPersonas] = useState<LanguageLabBuddyPersonaItem[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingPersona, setEditingPersona] = useState<LanguageLabBuddyPersonaItem | null>(null);
  const [draft, setDraft] = useState<BuddyPersonaDraft>(EMPTY_DRAFT);

  const deferredSearch = useDeferredValue(filters.search);

  const loadPersonas = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const query = buildQueryString({
        search: deferredSearch,
        isActive:
          filters.isActive === "all"
            ? undefined
            : filters.isActive === "active",
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
      setErrorMessage(error instanceof Error ? error.message : "Failed to load course options.");
    }
  }, []);

  useEffect(() => {
    void loadPersonas();
  }, [loadPersonas]);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  const handleFieldChange = useCallback((event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setDraft((current) => ({ ...current, [name]: value }));
  }, []);

  const handleActiveChange = useCallback((checked: boolean) => {
    setDraft((current) => ({ ...current, isActive: checked }));
  }, []);

  const toggleCourse = useCallback((courseId: string) => {
    setDraft((current) => ({
      ...current,
      courseIds: current.courseIds.includes(courseId)
        ? current.courseIds.filter((currentCourseId) => currentCourseId !== courseId)
        : [...current.courseIds, courseId],
    }));
  }, []);

  const resetDraft = useCallback(() => {
    setEditingPersona(null);
    setDraft(EMPTY_DRAFT);
  }, []);

  const startEditing = useCallback((persona: LanguageLabBuddyPersonaItem) => {
    setEditingPersona(persona);
    setDraft(toDraft(persona));
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
          isActive: draft.isActive,
          courseIds: draft.courseIds,
        };

        await readApi<LanguageLabBuddyPersonaItem>(
          editingPersona ? `/api/language-lab/buddy-personas/${editingPersona.id}` : "/api/language-lab/buddy-personas",
          {
            method: editingPersona ? "PATCH" : "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          },
        );

        toast.success(editingPersona ? "Buddy persona updated." : "Buddy persona created.");
        resetDraft();
        await Promise.all([loadPersonas(), loadCourses()]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save Buddy persona.");
      } finally {
        setIsSaving(false);
      }
    },
    [draft, editingPersona, loadCourses, loadPersonas, resetDraft],
  );

  const activeCount = useMemo(() => personas.filter((persona) => persona.isActive).length, [personas]);
  const assignedCoursesCount = useMemo(
    () => personas.reduce((total, persona) => total + (persona.assignedCourses?.length ?? 0), 0),
    [personas],
  );
  const languageCount = useMemo(
    () => new Set(personas.map((persona) => persona.languageCode?.trim().toLowerCase() ?? "").filter(Boolean)).size,
    [personas],
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Personas"
          value={metricValue(personas.length)}
          helper="Reusable Buddy personas currently visible under the active filters."
          badge="Catalog"
          badgeVariant="info"
        />
        <MetricCard
          label="Live personas"
          value={metricValue(activeCount)}
          helper="Personas that can resolve into candidate batch workspaces right now."
          badge="Active"
          badgeVariant="success"
        />
        <MetricCard
          label="Course links"
          value={metricValue(assignedCoursesCount)}
          helper="One course can have only one Buddy persona assignment at a time."
          badge="Assignments"
        />
        <MetricCard
          label="Languages"
          value={metricValue(languageCount)}
          helper="Distinct language codes currently used across the Buddy catalog."
          badge="Locales"
          badgeVariant="accent"
        />
      </div>

      {errorMessage ? <InlineErrorCard title="Buddy persona workspace unavailable" message={errorMessage} onRetry={() => void Promise.all([loadPersonas(), loadCourses()])} /> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,1fr)]">
        <Card className="border-[#d8e1ef] bg-white">
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="info">Buddy persona catalog</Badge>
                  <Badge variant="default">Reusable by course</Badge>
                </div>
                <CardTitle className="mt-3 text-2xl font-black tracking-tight text-slate-950">Course-assigned Buddy personas</CardTitle>
                <CardDescription className="max-w-2xl text-sm font-medium leading-6 text-slate-600">
                  Create reusable Buddy identities, bind them to courses, and keep the course-facing language and prompt instructions in one academy-owned place.
                </CardDescription>
              </div>

              <Button type="button" variant="secondary" onClick={() => void Promise.all([loadPersonas(), loadCourses()])} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                Refresh catalog
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
              <Input
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                placeholder="Search persona, language, or course"
              />
              <select
                className={SELECT_CLASS_NAME}
                value={filters.isActive}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    isActive: event.target.value as BuddyPersonaFilters["isActive"],
                  }))
                }
              >
                <option value="all">All rollout states</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
            </div>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <LoadingRows label="Loading Buddy personas" />
            ) : personas.length === 0 ? (
              <EmptyStateCard
                title="No Buddy personas found"
                description="Create the first persona to start assigning Buddy behavior and language to academy courses."
              />
            ) : (
              <div className="space-y-3">
                {personas.map((persona) => {
                  const assignedCourses = persona.assignedCourses ?? [];

                  return (
                    <div
                      key={persona.id}
                      className="rounded-[24px] border border-[#e5ebf4] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-lg font-black tracking-tight text-slate-950">{persona.name}</p>
                            <Badge variant={persona.isActive ? "success" : "warning"}>{persona.isActive ? "Active" : "Inactive"}</Badge>
                            <Badge variant="accent">{persona.languageCode || "Unknown locale"}</Badge>
                            <Badge variant="default">{assignedCourses.length} course{assignedCourses.length === 1 ? "" : "s"}</Badge>
                          </div>
                          <p className="text-sm font-medium text-slate-600">
                            {persona.language || "Unknown language"}
                            {persona.description ? ` • ${trimPreview(persona.description, 120)}` : " • No description yet"}
                          </p>
                        </div>

                        <CanAccess permission="lms.edit">
                          <Button type="button" variant="ghost" size="sm" onClick={() => startEditing(persona)}>
                            <PencilLine className="h-4 w-4" />
                            Edit persona
                          </Button>
                        </CanAccess>
                      </div>

                      {persona.welcomeMessage ? (
                        <div className="mt-4 rounded-[20px] border border-[#ecf1f8] bg-white px-4 py-3">
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Welcome message</p>
                          <p className="mt-2 text-sm font-medium leading-6 text-slate-700">{trimPreview(persona.welcomeMessage, 220)}</p>
                        </div>
                      ) : null}

                      <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_auto]">
                        <div className="flex flex-wrap gap-2">
                          {assignedCourses.length > 0 ? (
                            assignedCourses.map((course) => (
                              <Badge key={course.courseId} variant={course.isCourseActive ? "info" : "warning"}>
                                {course.courseName}
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="default">No courses assigned</Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                          <Languages className="h-4 w-4 text-[#0d3b84]" />
                          Updated {formatShortDate(persona.updatedAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <CanAccess permission="lms.edit" fallback={<ReadOnlyBuddyPersonaCard />}>
          <Card className="border-[#d8e1ef] bg-white">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="accent">{editingPersona ? "Edit persona" : "New persona"}</Badge>
                <Badge variant="info">Admin controlled</Badge>
              </div>
              <CardTitle className="mt-3 text-2xl font-black tracking-tight text-slate-950">
                {editingPersona ? `Update ${editingPersona.name}` : "Create Buddy persona"}
              </CardTitle>
              <CardDescription className="text-sm font-medium leading-6 text-slate-600">
                Define the conversation language, the behavior prompt, and the course assignments that should resolve for candidate Buddy sessions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
                <label className="block space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Persona name</span>
                  <Input name="name" value={draft.name} onChange={handleFieldChange} placeholder="Exam Coach Anna" required />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Conversation language</span>
                    <Input name="language" value={draft.language} onChange={handleFieldChange} placeholder="German" required />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Language code</span>
                    <Input name="languageCode" value={draft.languageCode} onChange={handleFieldChange} placeholder="de-DE" required />
                  </label>
                </div>

                <label className="block space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Description</span>
                  <textarea
                    name="description"
                    value={draft.description}
                    onChange={handleFieldChange}
                    className={TEXTAREA_CLASS_NAME}
                    placeholder="Describe the persona's role, tone, and where it should be used."
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Welcome message</span>
                  <textarea
                    name="welcomeMessage"
                    value={draft.welcomeMessage}
                    onChange={handleFieldChange}
                    className={TEXTAREA_CLASS_NAME}
                    placeholder="The first thing Buddy should sound like when a learner opens the chat."
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">System prompt override</span>
                  <textarea
                    name="systemPrompt"
                    value={draft.systemPrompt}
                    onChange={handleFieldChange}
                    className={cn(TEXTAREA_CLASS_NAME, "min-h-[220px]")}
                    placeholder="Add persona-specific instructions that will be layered onto the academy Buddy runtime prompt."
                  />
                </label>

                <div className="rounded-[22px] border border-[#e5ebf4] bg-slate-50 px-4 py-4">
                  <div className="flex items-center gap-3">
                    <Checkbox checked={draft.isActive} onCheckedChange={(checked) => handleActiveChange(checked === true)} />
                    <div>
                      <p className="text-sm font-bold text-slate-900">Persona active</p>
                      <p className="text-xs font-medium leading-5 text-slate-500">Inactive personas stay editable but will not resolve into candidate workspaces or emails.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Assigned courses</p>
                      <p className="mt-1 text-sm font-medium text-slate-600">Selecting a course moves that course onto this persona and removes it from any previous persona assignment.</p>
                    </div>
                    <Badge variant="default">{draft.courseIds.length} selected</Badge>
                  </div>

                  <div className="grid max-h-[320px] gap-3 overflow-y-auto rounded-[24px] border border-[#dde1e6] p-3">
                    {courses.length === 0 ? (
                      <p className="px-2 py-3 text-sm font-medium text-slate-500">No courses available.</p>
                    ) : (
                      courses.map((course) => {
                        const selected = draft.courseIds.includes(course.id);

                        return (
                          <div
                            key={course.id}
                            role="checkbox"
                            aria-checked={selected}
                            tabIndex={0}
                            onClick={() => toggleCourse(course.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                toggleCourse(course.id);
                              }
                            }}
                            className={cn(
                              "rounded-[20px] border px-4 py-4 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84]",
                              selected
                                ? "border-[#0d3b84] bg-[#edf4ff]"
                                : "border-[#dde1e6] bg-white hover:border-[#c8d4e3] hover:bg-slate-50",
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <Checkbox checked={selected} className="mt-0.5" tabIndex={-1} aria-hidden="true" />
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-bold text-slate-900">{course.name}</p>
                                  <Badge variant={course.isActive ? "info" : "warning"}>{formatStatus(course.status)}</Badge>
                                </div>
                                <p className="text-xs font-medium leading-5 text-slate-500">
                                  {course.description?.trim() || "No course description"}
                                </p>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                  {course.programCount} linked program{course.programCount === 1 ? "" : "s"}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="secondary" onClick={resetDraft} disabled={isSaving}>
                    {editingPersona ? "Cancel edit" : "Clear draft"}
                  </Button>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {editingPersona ? "Save Persona" : "Create Persona"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </CanAccess>
      </div>
    </div>
  );
}

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
    <Card className="border-[#d8e1ef] bg-white">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
          <Badge variant={badgeVariant}>{badge}</Badge>
        </div>
        <p className="text-3xl font-black tracking-tight text-slate-950">{value}</p>
        <p className="text-sm font-medium leading-6 text-slate-600">{helper}</p>
      </CardContent>
    </Card>
  );
}

function LoadingRows({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[22px] border border-[#e5ebf4] bg-slate-50 px-4 py-4 text-base">
      <Loader2 className="h-4 w-4 animate-spin text-[#0d3b84]" />
      <p className="font-medium text-slate-600">{label}</p>
    </div>
  );
}

function EmptyStateCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-[#d4dfef] bg-slate-50 px-5 py-6">
      <p className="text-lg font-black tracking-tight text-slate-950">{title}</p>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function InlineErrorCard({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.16em] text-rose-700">{title}</p>
          <p className="mt-1 text-sm font-medium leading-6 text-rose-900">{message}</p>
        </div>
        <Button type="button" variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      </div>
    </div>
  );
}

function ReadOnlyBuddyPersonaCard() {
  return (
    <Card className="border-[#d8e1ef] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default">View only</Badge>
          <Badge variant="info">Buddy personas protected</Badge>
        </div>
        <CardTitle className="mt-3 text-2xl font-black tracking-tight text-slate-950">Edit access required</CardTitle>
        <CardDescription className="text-sm font-medium leading-6 text-slate-600">
          You can review the Buddy persona catalog and its course assignments here, but creating or editing personas requires the Language Lab edit permission.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-[24px] border border-[#e5ebf4] bg-slate-50 px-5 py-5">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-[#edf4ff] p-3 text-[#0d3b84]">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Admin-owned Buddy definitions</p>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                Persona language, prompt behavior, and course mapping stay editable only for LMS admins so the candidate app always consumes an academy-controlled contract.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}