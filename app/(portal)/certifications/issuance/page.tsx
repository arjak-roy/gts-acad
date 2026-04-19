"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  FileText,
  Loader2,
  Plus,
  Power,
  RotateCcw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CertificatePreviewRenderer } from "@/components/modules/certifications/certificate-preview-renderer";
import type {
  CertificateTemplateWithPreview,
} from "@/services/certifications/types";

// ── Style constants ──────────────────────────────────────────────────────────

const selectClassName =
  "block w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84]";

// ── Types ────────────────────────────────────────────────────────────────────

type CourseOption = { id: string; name: string };

type CurriculumOption = { id: string; title: string; status: string };
type AutoIssueRule = {
  id: string;
  templateId: string;
  templateTitle: string;
  curriculumId: string | null;
  curriculumTitle: string | null;
  trigger: string;
  isActive: boolean;
  createdAt: string;
};
type AutoIssueAttempt = {
  id: string;
  learnerId: string;
  learnerName: string;
  batchId: string;
  batchCode: string;
  batchName: string;
  curriculumId: string | null;
  curriculumTitle: string | null;
  templateId: string | null;
  templateTitle: string | null;
  trigger: string;
  status: "ISSUED" | "SKIPPED" | "FAILED";
  reason: string | null;
  certificateId: string | null;
  attemptedAt: string;
  retriedFromAttemptId: string | null;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const triggerLabels: Record<string, string> = {
  CURRICULUM_COMPLETION: "Curriculum Completion",
  ENROLLMENT_COMPLETION: "Enrollment Completion",
};

// ── Main Page ────────────────────────────────────────────────────────────────

export default function IssuanceConfigPage() {
  // Course filter
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);

  // Templates for selected course
  const [templates, setTemplates] = useState<CertificateTemplateWithPreview[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  // Rules
  const [rules, setRules] = useState<AutoIssueRule[]>([]);
  const [isLoadingRules, setIsLoadingRules] = useState(false);

  // Failed attempts
  const [failedAttempts, setFailedAttempts] = useState<AutoIssueAttempt[]>([]);
  const [isLoadingAttempts, setIsLoadingAttempts] = useState(false);
  const [retryingAttemptId, setRetryingAttemptId] = useState<string | null>(null);

  // Add rule dialog
  const [addRuleOpen, setAddRuleOpen] = useState(false);
  const [addRuleTemplateId, setAddRuleTemplateId] = useState("");

  // ── Load courses ───────────────────────────────────────────────────────────
  useEffect(() => {
    setIsLoadingCourses(true);
    fetch("/api/courses")
      .then((r) => r.json())
      .then((res: { data?: CourseOption[] }) => {
        const list = res.data ?? [];
        setCourses(list);
        if (list.length > 0 && !selectedCourseId) {
          setSelectedCourseId(list[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingCourses(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load templates + rules when course changes ─────────────────────────────
  useEffect(() => {
    if (!selectedCourseId) {
      setTemplates([]);
      setRules([]);
      setFailedAttempts([]);
      return;
    }

    setIsLoadingTemplates(true);
    setIsLoadingRules(true);
    setIsLoadingAttempts(true);

    Promise.all([
      fetch(`/api/certifications/templates?courseId=${selectedCourseId}`)
        .then((r) => r.json())
        .then((res: { data?: CertificateTemplateWithPreview[] }) => setTemplates(res.data ?? [])),
      fetch(`/api/certifications/auto-issue-rules?courseId=${selectedCourseId}`)
        .then((r) => r.json())
        .then((res: { data?: AutoIssueRule[] }) => setRules(res.data ?? [])),
      fetch(`/api/certifications/auto-issue-attempts?courseId=${selectedCourseId}&status=FAILED&limit=25`)
        .then((r) => r.json())
        .then((res: { data?: AutoIssueAttempt[] }) => setFailedAttempts(res.data ?? [])),
    ])
      .catch(() => {})
      .finally(() => {
        setIsLoadingTemplates(false);
        setIsLoadingRules(false);
        setIsLoadingAttempts(false);
      });
  }, [selectedCourseId]);

  // ── Refresh rules ──────────────────────────────────────────────────────────
  function refreshRules() {
    if (!selectedCourseId) return;
    fetch(`/api/certifications/auto-issue-rules?courseId=${selectedCourseId}`)
      .then((r) => r.json())
      .then((res: { data?: AutoIssueRule[] }) => setRules(res.data ?? []))
      .catch(() => {});
  }

  function refreshFailedAttempts() {
    if (!selectedCourseId) return;
    fetch(`/api/certifications/auto-issue-attempts?courseId=${selectedCourseId}&status=FAILED&limit=25`)
      .then((r) => r.json())
      .then((res: { data?: AutoIssueAttempt[] }) => setFailedAttempts(res.data ?? []))
      .catch(() => {});
  }

  // ── Toggle rule ────────────────────────────────────────────────────────────
  async function handleToggleRule(ruleId: string, isActive: boolean) {
    try {
      const res = await fetch(`/api/certifications/auto-issue-rules/${ruleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error();
      toast.success(isActive ? "Rule activated." : "Rule deactivated.");
      refreshRules();
    } catch {
      toast.error("Failed to update rule.");
    }
  }

  // ── Delete rule ────────────────────────────────────────────────────────────
  async function handleDeleteRule(ruleId: string) {
    try {
      const res = await fetch(`/api/certifications/auto-issue-rules/${ruleId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Rule deleted.");
      refreshRules();
    } catch {
      toast.error("Failed to delete rule.");
    }
  }

  async function handleRetryAttempt(attemptId: string) {
    try {
      setRetryingAttemptId(attemptId);

      const res = await fetch(`/api/certifications/auto-issue-attempts/${attemptId}/retry`, {
        method: "POST",
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error((body as { error?: string } | null)?.error ?? "Failed to retry auto-issue.");
      }

      const result = (body as { data?: { issued: boolean; status: string; reason?: string } } | null)?.data;

      if (result?.issued) {
        toast.success("Certificate issued on retry.");
      } else if (result?.status === "SKIPPED") {
        toast(result.reason ?? "Retry completed without issuing a certificate.");
      } else {
        toast.error(result?.reason ?? "Retry failed.");
      }

      refreshFailedAttempts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to retry auto-issue.");
    } finally {
      setRetryingAttemptId(null);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const isLoading = isLoadingCourses || isLoadingTemplates || isLoadingRules || isLoadingAttempts;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/certifications">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Auto-Issue Configuration</h1>
          <p className="text-sm text-slate-500">
            Configure automatic certificate issuance rules per batch and curriculum.
          </p>
        </div>
      </div>

      {/* Course selector */}
      <Card className="border-[#dde1e6]">
        <CardContent className="pt-5">
          <label className="text-xs font-semibold text-slate-500 uppercase">
            Course
            <select
              className={selectClassName + " mt-1 max-w-sm"}
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              disabled={isLoadingCourses}
            >
              <option value="">{isLoadingCourses ? "Loading…" : "Select course…"}</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        </CardContent>
      </Card>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      )}

      {!isLoading && selectedCourseId && (
        <Card className="border-[#dde1e6]">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Failed Auto-Issue Attempts
                </CardTitle>
                <CardDescription>
                  Recent unresolved certificate auto-issue failures for the selected course.
                </CardDescription>
              </div>
              <Badge variant={failedAttempts.length > 0 ? "warning" : "default"} className="text-[10px]">
                {failedAttempts.length} open
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {failedAttempts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center">
                <p className="text-sm font-medium text-slate-500">No unresolved failures</p>
                <p className="mt-1 text-xs text-slate-400">
                  Certificate auto-issue attempts are currently succeeding or have already been retried.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-[#dde1e6]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#dde1e6] bg-slate-50/80 text-left text-[11px] font-semibold uppercase text-slate-500">
                      <th className="px-3 py-2">Learner</th>
                      <th className="px-3 py-2">Batch</th>
                      <th className="px-3 py-2">Scope</th>
                      <th className="px-3 py-2">Reason</th>
                      <th className="px-3 py-2">Attempted</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failedAttempts.map((attempt) => (
                      <tr key={attempt.id} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-3 py-2 align-top">
                          <div className="font-medium text-slate-800">{attempt.learnerName}</div>
                          <div className="text-[11px] text-slate-400">{attempt.learnerId}</div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="font-medium text-slate-800">{attempt.batchCode}</div>
                          <div className="text-[11px] text-slate-400">{attempt.batchName}</div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <Badge variant="info" className="mb-1 text-[10px]">
                            {triggerLabels[attempt.trigger] ?? attempt.trigger}
                          </Badge>
                          <div className="text-[11px] text-slate-600">
                            {attempt.curriculumTitle ?? attempt.templateTitle ?? "Enrollment-level rule"}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top text-[12px] text-slate-600">
                          {attempt.reason ?? "Unknown failure"}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="text-[11px] text-slate-500">
                            {new Date(attempt.attemptedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {new Date(attempt.attemptedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleRetryAttempt(attempt.id)}
                            disabled={retryingAttemptId === attempt.id}
                          >
                            {retryingAttemptId === attempt.id ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Retry
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!isLoading && selectedCourseId && templates.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">No certificate templates</p>
          <p className="mt-1 text-xs text-slate-400">
            Create a template in the <Link href="/certifications" className="text-[#0d3b84] underline">Certifications</Link> page first.
          </p>
        </div>
      )}

      {/* Template cards with rules */}
      {!isLoading && templates.map((tpl) => {
        const templateRules = rules.filter((r) => r.templateId === tpl.id);
        return (
          <Card key={tpl.id} className="overflow-hidden border-[#dde1e6]">
            <div className="flex flex-col lg:flex-row">
              {/* Preview thumbnail */}
              <div className="w-full shrink-0 border-b border-[#dde1e6] bg-slate-50 lg:w-64 lg:border-b-0 lg:border-r">
                <CertificatePreviewRenderer
                  layoutJson={tpl.layoutJson}
                  orientation={tpl.orientation}
                  paperSize={tpl.paperSize}
                  backgroundColor={tpl.backgroundColor}
                  backgroundImageUrl={tpl.backgroundImageUrl}
                  logoUrl={tpl.logoUrl}
                  signatory1SignatureUrl={tpl.signatory1SignatureUrl}
                  signatory2SignatureUrl={tpl.signatory2SignatureUrl}
                />
              </div>

              {/* Template info + rules */}
              <div className="min-w-0 flex-1">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Award className="h-4 w-4 text-[#0d3b84]" />
                        {tpl.title}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {tpl.description || "No description"}
                        {tpl.isDefault && (
                          <Badge variant="default" className="ml-2 text-[10px]">Default</Badge>
                        )}
                        {!tpl.isActive && (
                          <Badge variant="danger" className="ml-2 text-[10px]">Inactive</Badge>
                        )}
                      </CardDescription>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => { setAddRuleTemplateId(tpl.id); setAddRuleOpen(true); }}
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Add Rule
                    </Button>
                    {templateRules.length > 0 && (
                      <Badge variant="info" className="text-[10px]">
                        {templateRules.length} {templateRules.length === 1 ? "rule" : "rules"}
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent>
                  {templateRules.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center">
                      <p className="text-xs text-slate-400">No auto-issue rules configured for this template.</p>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-[#dde1e6]">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#dde1e6] bg-slate-50/80 text-left text-[11px] font-semibold uppercase text-slate-500">
                            <th className="px-3 py-2">Curriculum</th>
                            <th className="px-3 py-2">Trigger</th>
                            <th className="px-3 py-2">Created</th>
                            <th className="px-3 py-2 text-center">Status</th>
                            <th className="px-3 py-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {templateRules.map((rule) => (
                            <tr key={rule.id} className="border-b border-slate-100 last:border-b-0">
                              <td className="px-3 py-2 text-slate-700">
                                {rule.curriculumTitle ?? <span className="text-slate-400">—</span>}
                              </td>
                              <td className="px-3 py-2">
                                <Badge variant="info" className="text-[10px]">
                                  {triggerLabels[rule.trigger] ?? rule.trigger}
                                </Badge>
                              </td>
                              <td className="px-3 py-2">
                                <div className="text-[11px] text-slate-500">
                                  {new Date(rule.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {new Date(rule.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <button
                                  onClick={() => handleToggleRule(rule.id, !rule.isActive)}
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                                    rule.isActive
                                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                  }`}
                                >
                                  <Power className="h-2.5 w-2.5" />
                                  {rule.isActive ? "Active" : "Inactive"}
                                </button>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  onClick={() => handleDeleteRule(rule.id)}
                                  className="rounded p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
                                  title="Delete rule"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </div>
            </div>
          </Card>
        );
      })}

      {/* Add Rule Dialog */}
      <AddRuleDialog
        open={addRuleOpen}
        templateId={addRuleTemplateId}
        courseId={selectedCourseId}
        templates={templates}
        onOpenChange={setAddRuleOpen}
        onCreated={() => { setAddRuleOpen(false); refreshRules(); }}
      />
    </div>
  );
}

// ── Add Rule Dialog ──────────────────────────────────────────────────────────

function AddRuleDialog({
  open,
  templateId,
  courseId,
  templates,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  templateId: string;
  courseId: string;
  templates: CertificateTemplateWithPreview[];
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [curricula, setCurricula] = useState<CurriculumOption[]>([]);
  const [isLoadingCurricula, setIsLoadingCurricula] = useState(false);

  const [curriculumId, setCurriculumId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [existingRuleIds, setExistingRuleIds] = useState<Set<string>>(new Set());

  // Reset form state when dialog closes
  useEffect(() => {
    if (!open) {
      setCurriculumId("");
      setSaveError(null);
      setExistingRuleIds(new Set());
    }
  }, [open]);

  // Load curricula for the course
  useEffect(() => {
    if (!open || !courseId) return;
    setIsLoadingCurricula(true);
    fetch(`/api/curriculum?courseId=${courseId}`)
      .then((r) => r.json())
      .then((res: { data?: CurriculumOption[] }) => {
        const published = (res.data ?? []).filter((c) => c.status === "PUBLISHED");
        setCurricula(published);
      })
      .catch(() => {})
      .finally(() => setIsLoadingCurricula(false));
  }, [open, courseId]);

  // Load existing rules to detect duplicates
  useEffect(() => {
    if (!open || !templateId) return;
    fetch(`/api/certifications/templates/${templateId}/auto-issue-rules`)
      .then((r) => r.json())
      .then((res: { data?: { id: string; curriculumId: string | null }[] }) => {
        const ids = new Set((res.data ?? []).map((r) => r.curriculumId ?? ""));
        setExistingRuleIds(ids);
      })
      .catch(() => {});
  }, [open, templateId]);

  async function handleSave() {
    if (!curriculumId) {
      toast.error("Please select a curriculum.");
      return;
    }

    if (existingRuleIds.has(curriculumId)) {
      setSaveError("A rule for this curriculum already exists.");
      return;
    }

    setSaveError(null);
    setIsSaving(true);
    try {
      const res = await fetch(`/api/certifications/templates/${templateId}/auto-issue-rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          curriculumId,
          trigger: "CURRICULUM_COMPLETION",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as { error?: string })?.error ?? "Failed to create rule.");
      }
      toast.success("Auto-issue rule created.");
      onCreated();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to create rule.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Auto-Issue Rule</DialogTitle>
          <DialogDescription>
            Configure when this template should automatically issue certificates.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Template inactive warning */}
          {templateId && templates.find((t) => t.id === templateId)?.isActive === false && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-xs font-semibold text-amber-900">⚠️ Template Inactive</p>
              <p className="mt-0.5 text-[11px] text-amber-800">This template is inactive and will not issue certificates. Activate it in the Certifications page before enabling auto-issue.</p>
            </div>
          )}
          {/* Trigger type — Currently only Curriculum Completion is supported */}
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-xs font-semibold text-slate-500 uppercase">Trigger</p>
            <p className="mt-1 text-sm text-slate-700">Curriculum Completion</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Certificate issues when learner completes the selected curriculum.</p>
          </div>



          {/* Curriculum */}
          <label className="text-xs font-semibold text-slate-500 uppercase">
            Curriculum
            <select
              className={selectClassName + " mt-1"}
              value={curriculumId}
              onChange={(e) => setCurriculumId(e.target.value)}
              disabled={isLoadingCurricula || curricula.length === 0}
            >
              <option value="">{isLoadingCurricula ? "Loading…" : curricula.length === 0 ? "No published curricula" : "Select curriculum…"}</option>
              {curricula.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </label>
          {!isLoadingCurricula && curricula.length === 0 && (
            <p className="text-[11px] text-amber-600">No published curricula found for this course. Publish a curriculum first before creating auto-issue rules.</p>
          )}

          {/* Duplicate warning */}
          {curriculumId && existingRuleIds.has(curriculumId) && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2">
              <p className="text-xs font-semibold text-orange-900">⚠️ Rule Already Exists</p>
              <p className="mt-0.5 text-[11px] text-orange-800">A rule for this curriculum already exists. You can update it from the rules table.</p>
            </div>
          )}

          {/* Info text */}
          <p className="text-[11px] text-slate-400">
            A certificate will be auto-issued when any learner completes all required items in the selected curriculum, regardless of which batch they are enrolled in.
          </p>

          {/* Inline save error */}
          {saveError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
              <p className="text-xs font-semibold text-rose-900">Error</p>
              <p className="mt-0.5 text-[11px] text-rose-800">{saveError}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            Create Rule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
