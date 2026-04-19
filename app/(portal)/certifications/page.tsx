"use client";

import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  Award,
  BookOpen,
  Check,
  Eye,
  FileText,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/ui/can-access";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CertificateCanvasEditor } from "@/components/modules/certifications/certificate-canvas-editor";
import { CertificatePreviewRenderer } from "@/components/modules/certifications/certificate-preview-renderer";
import type { CanvasElement } from "@/services/certifications/types";
import type {
  IssuedCertificateDetail,
  CertificateTemplateDetail,
  CertificateTemplateSummary,
  CertificateTemplateWithPreview,
  IssuedCertificateSummary,
} from "@/services/certifications/types";

// ── Style constants ──────────────────────────────────────────────────────────

const selectClassName =
  "block w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84]";
const inputClassName =
  "block w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84]";

type CourseOption = { id: string; name: string };
type Tab = "templates" | "library" | "issued";

// ── Main page ────────────────────────────────────────────────────────────────

export default function CertificationsPage() {
  const [tab, setTab] = useState<Tab>("templates");
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);

  // Template state
  const [templates, setTemplates] = useState<CertificateTemplateWithPreview[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [addTemplateOpen, setAddTemplateOpen] = useState(false);

  // Library state
  const [baseTemplates, setBaseTemplates] = useState<CertificateTemplateWithPreview[]>([]);
  const [isLoadingBaseTemplates, setIsLoadingBaseTemplates] = useState(false);
  const [addBaseTemplateOpen, setAddBaseTemplateOpen] = useState(false);
  const [importToCourseTemplateId, setImportToCourseTemplateId] = useState<string | null>(null);
  const [promoteTemplateId, setPromoteTemplateId] = useState<string | null>(null);
  const [isPromoting, setIsPromoting] = useState(false);
  const [editorTemplateId, setEditorTemplateId] = useState<string | null>(null);
  const [editorTemplate, setEditorTemplate] = useState<CertificateTemplateDetail | null>(null);
  const [isLoadingEditor, setIsLoadingEditor] = useState(false);
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [brandingSheetId, setBrandingSheetId] = useState<string | null>(null);
  const [brandingTemplate, setBrandingTemplate] = useState<CertificateTemplateDetail | null>(null);
  const [isSavingBranding, setIsSavingBranding] = useState(false);

  // Issued certs state
  const [issuedCerts, setIssuedCerts] = useState<IssuedCertificateSummary[]>([]);
  const [isLoadingIssued, setIsLoadingIssued] = useState(false);
  const [previewCertificateId, setPreviewCertificateId] = useState<string | null>(null);
  const [previewCertificate, setPreviewCertificate] = useState<IssuedCertificateDetail | null>(null);
  const [isLoadingPreviewCertificate, setIsLoadingPreviewCertificate] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [isRevoking, setIsRevoking] = useState(false);

  // Issue dialog
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);

  // ── Load courses ───────────────────────────────────────────────────────────

  useEffect(() => {
    setIsLoadingCourses(true);
    fetch("/api/courses", { cache: "no-store" })
      .then((r) => r.json())
      .then((result: { data?: CourseOption[] }) => {
        const list = result.data ?? [];
        setCourses(list);
        if (list.length > 0) setSelectedCourseId(list[0].id);
      })
      .catch(() => toast.error("Failed to load courses."))
      .finally(() => setIsLoadingCourses(false));
  }, []);

  // ── Load templates ─────────────────────────────────────────────────────────

  const loadTemplates = useCallback(async () => {
    if (!selectedCourseId) return;
    setIsLoadingTemplates(true);
    try {
      const res = await fetch(`/api/certifications/templates?courseId=${selectedCourseId}`);
      const result = (await res.json()) as { data?: CertificateTemplateWithPreview[] };
      setTemplates(result.data ?? []);
    } catch {
      toast.error("Failed to load templates.");
    } finally {
      setIsLoadingTemplates(false);
    }
  }, [selectedCourseId]);

  useEffect(() => {
    if (tab === "templates") void loadTemplates();
  }, [tab, loadTemplates]);

  // ── Load base/library templates ────────────────────────────────────────────

  const loadBaseTemplates = useCallback(async () => {
    setIsLoadingBaseTemplates(true);
    try {
      const res = await fetch("/api/certifications/templates?base=true");
      const result = (await res.json()) as { data?: CertificateTemplateWithPreview[] };
      setBaseTemplates(result.data ?? []);
    } catch {
      toast.error("Failed to load base templates.");
    } finally {
      setIsLoadingBaseTemplates(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "library") void loadBaseTemplates();
  }, [tab, loadBaseTemplates]);

  // ── Load issued certificates ───────────────────────────────────────────────

  const loadIssued = useCallback(async () => {
    setIsLoadingIssued(true);
    try {
      const qs = selectedCourseId ? `?courseId=${selectedCourseId}` : "";
      const res = await fetch(`/api/certifications${qs}`);
      const result = (await res.json()) as { data?: IssuedCertificateSummary[] };
      setIssuedCerts(result.data ?? []);
    } catch {
      toast.error("Failed to load certificates.");
    } finally {
      setIsLoadingIssued(false);
    }
  }, [selectedCourseId]);

  useEffect(() => {
    if (tab === "issued") void loadIssued();
  }, [tab, loadIssued]);

  // ── Create template ────────────────────────────────────────────────────────

  const [newTitle, setNewTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  async function handleCreateTemplate() {
    if (!newTitle.trim() || !selectedCourseId) return;
    setIsCreating(true);
    try {
      const res = await fetch("/api/certifications/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: selectedCourseId, title: newTitle.trim() }),
      });
      if (!res.ok) throw new Error("Failed to create template.");
      toast.success("Template created.");
      setAddTemplateOpen(false);
      setNewTitle("");
      void loadTemplates();
    } catch {
      toast.error("Failed to create template.");
    } finally {
      setIsCreating(false);
    }
  }

  // ── Open canvas editor ─────────────────────────────────────────────────────

  async function openEditor(templateId: string) {
    setEditorTemplateId(templateId);
    setIsLoadingEditor(true);
    try {
      const res = await fetch(`/api/certifications/templates/${templateId}`);
      const result = (await res.json()) as { data?: CertificateTemplateDetail };
      setEditorTemplate(result.data ?? null);
    } catch {
      toast.error("Failed to load template.");
      setEditorTemplateId(null);
    } finally {
      setIsLoadingEditor(false);
    }
  }

  async function handleSaveLayout(elements: CanvasElement[]) {
    if (!editorTemplateId) return;
    setIsSavingLayout(true);
    try {
      const res = await fetch(`/api/certifications/templates/${editorTemplateId}/layout`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layoutJson: elements }),
      });
      if (!res.ok) throw new Error();
      toast.success("Layout saved.");
    } catch {
      toast.error("Failed to save layout.");
    } finally {
      setIsSavingLayout(false);
    }
  }

  // ── Open branding sheet ────────────────────────────────────────────────────

  async function openBranding(templateId: string) {
    setBrandingSheetId(templateId);
    try {
      const res = await fetch(`/api/certifications/templates/${templateId}`);
      const result = (await res.json()) as { data?: CertificateTemplateDetail };
      setBrandingTemplate(result.data ?? null);
    } catch {
      toast.error("Failed to load template.");
      setBrandingSheetId(null);
    }
  }

  // ── Delete template ────────────────────────────────────────────────────────

  async function handleDeleteTemplate(templateId: string) {
    try {
      const res = await fetch(`/api/certifications/templates/${templateId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Template deleted.");
      void loadTemplates();
    } catch {
      toast.error("Failed to delete template.");
    }
  }

  async function handleDeleteBaseTemplate(templateId: string) {
    try {
      const res = await fetch(`/api/certifications/templates/${templateId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Base template deleted.");
      void loadBaseTemplates();
    } catch {
      toast.error("Failed to delete base template.");
    }
  }

  async function handlePromoteToBase() {
    if (!promoteTemplateId) return;
    setIsPromoting(true);
    try {
      const res = await fetch(`/api/certifications/templates/${promoteTemplateId}/promote-to-base`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success("Template saved to library.");
      setPromoteTemplateId(null);
    } catch {
      toast.error("Failed to save to library.");
    } finally {
      setIsPromoting(false);
    }
  }

  // ── Revoke certificate ─────────────────────────────────────────────────────

  async function handleRevoke() {
    if (!revokeId || !revokeReason.trim()) return;
    setIsRevoking(true);
    try {
      const res = await fetch(`/api/certifications/${revokeId}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: revokeReason.trim() }),
      });
      if (!res.ok) throw new Error();
      toast.success("Certificate revoked.");
      setRevokeId(null);
      setRevokeReason("");
      void loadIssued();
    } catch {
      toast.error("Failed to revoke certificate.");
    } finally {
      setIsRevoking(false);
    }
  }

  // ── Open issued certificate preview ───────────────────────────────────────

  async function openIssuedPreview(certificateId: string) {
    setPreviewCertificateId(certificateId);
    setIsLoadingPreviewCertificate(true);
    try {
      const res = await fetch(`/api/certifications/${certificateId}`, { cache: "no-store" });
      const result = (await res.json()) as { data?: IssuedCertificateDetail };
      setPreviewCertificate(result.data ?? null);
    } catch {
      toast.error("Failed to load certificate preview.");
      setPreviewCertificateId(null);
      setPreviewCertificate(null);
    } finally {
      setIsLoadingPreviewCertificate(false);
    }
  }

  // ── Full-screen editor view ────────────────────────────────────────────────

  if (editorTemplateId) {
    return (
      <div className="flex h-[calc(100vh-64px)] flex-col">
        {/* Editor top bar */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { setEditorTemplateId(null); setEditorTemplate(null); }}>
              ← Back
            </Button>
            <h2 className="text-sm font-bold text-slate-800">
              {editorTemplate?.title ?? "Loading…"}
            </h2>
          </div>
        </div>

        {isLoadingEditor || !editorTemplate ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <CertificateCanvasEditor
            template={editorTemplate}
            onSave={handleSaveLayout}
            isSaving={isSavingLayout}
          />
        )}
      </div>
    );
  }

  // ── Main page render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header card */}
      <Card className="overflow-hidden border-slate-200 bg-white/95">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Award className="h-5 w-5 text-[#0d3b84]" />
              Certifications
            </CardTitle>
            <CardDescription>
              Manage certificate templates and issue certificates to learners.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <CanAccess permission="certifications.edit">
              <Link href="/certifications/issuance">
                <Button variant="secondary" size="sm">
                  <Award className="mr-1 h-3.5 w-3.5" />
                  Auto-Issue Config
                </Button>
              </Link>
            </CanAccess>
            <CanAccess permission="certifications.issue">
              <Button variant="secondary" size="sm" onClick={() => setIssueDialogOpen(true)}>
                <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                Issue Certificate
              </Button>
            </CanAccess>
            <CanAccess permission="certifications.create">
              {tab === "library" ? (
                <Button size="sm" onClick={() => setAddBaseTemplateOpen(true)}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  New Base Template
                </Button>
              ) : (
                <Button size="sm" onClick={() => setAddTemplateOpen(true)}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  New Template
                </Button>
              )}
            </CanAccess>
          </div>
        </CardHeader>

        <CardContent>
          {/* Tab selector + course filter */}
          <div className="mb-5 flex flex-wrap items-center gap-4">
            <div className="flex rounded-xl border border-[#dde1e6] bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => setTab("templates")}
                className={`rounded-lg px-4 py-1.5 text-sm font-bold transition-colors ${tab === "templates" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Templates
              </button>
              <button
                type="button"
                onClick={() => setTab("library")}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-bold transition-colors ${tab === "library" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                <BookOpen className="h-3.5 w-3.5" />
                Library
              </button>
              <button
                type="button"
                onClick={() => setTab("issued")}
                className={`rounded-lg px-4 py-1.5 text-sm font-bold transition-colors ${tab === "issued" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Issued Certificates
              </button>
            </div>

            {tab !== "library" && (
              <select
                className={selectClassName + " max-w-xs"}
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                disabled={isLoadingCourses}
              >
                <option value="">All courses</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Templates tab */}
          {tab === "templates" && (
            <TemplatesTab
              templates={templates}
              isLoading={isLoadingTemplates}
              onOpenEditor={openEditor}
              onOpenBranding={openBranding}
              onDelete={handleDeleteTemplate}
              onSaveToLibrary={(id) => setPromoteTemplateId(id)}
            />
          )}

          {/* Library tab */}
          {tab === "library" && (
            <LibraryTab
              templates={baseTemplates}
              isLoading={isLoadingBaseTemplates}
              onOpenEditor={openEditor}
              onOpenBranding={openBranding}
              onDelete={handleDeleteBaseTemplate}
              onImportToCourse={(id) => setImportToCourseTemplateId(id)}
            />
          )}

          {/* Issued tab */}
          {tab === "issued" && (
            <IssuedTab
              certificates={issuedCerts}
              isLoading={isLoadingIssued}
              onPreview={openIssuedPreview}
              onRevoke={(id) => { setRevokeId(id); setRevokeReason(""); }}
            />
          )}
        </CardContent>
      </Card>

      {/* ── Create template dialog ──────────────────────────────────────────── */}
      <Dialog open={addTemplateOpen} onOpenChange={setAddTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Certificate Template</DialogTitle>
            <DialogDescription>Create a blank template for the selected course.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-xs font-semibold text-slate-500 uppercase">
              Title
              <input
                className={inputClassName + " mt-1"}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Default Landscape Certificate"
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setAddTemplateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateTemplate} disabled={isCreating || !newTitle.trim() || !selectedCourseId}>
              {isCreating ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Revoke dialog ───────────────────────────────────────────────────── */}
      <Dialog open={Boolean(revokeId)} onOpenChange={(open) => { if (!open) setRevokeId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Certificate</DialogTitle>
            <DialogDescription>This cannot be undone. The certificate will be marked as revoked.</DialogDescription>
          </DialogHeader>
          <label className="text-xs font-semibold text-slate-500 uppercase">
            Reason
            <textarea
              className={inputClassName + " mt-1 min-h-[80px] resize-y"}
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="Enter revocation reason…"
            />
          </label>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRevokeId(null)}>Cancel</Button>
            <Button
              onClick={handleRevoke}
              disabled={isRevoking || !revokeReason.trim()}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {isRevoking ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Issued certificate preview sheet ──────────────────────────────── */}
      <Sheet
        open={Boolean(previewCertificateId)}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewCertificateId(null);
            setPreviewCertificate(null);
          }
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-5xl">
          <SheetHeader>
            <SheetTitle>Issued Certificate Preview</SheetTitle>
            <SheetDescription>
              Preview the exact issued certificate snapshot and verify current status.
            </SheetDescription>
          </SheetHeader>

          {isLoadingPreviewCertificate ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : !previewCertificate ? (
            <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              Unable to load certificate preview.
            </div>
          ) : (
            <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                {previewCertificate.layoutJson && previewCertificate.templateBranding ? (
                  <CertificatePreviewRenderer
                    layoutJson={previewCertificate.layoutJson}
                    orientation={previewCertificate.templateBranding.orientation}
                    paperSize={previewCertificate.templateBranding.paperSize}
                    backgroundColor={previewCertificate.templateBranding.backgroundColor}
                    backgroundImageUrl={previewCertificate.templateBranding.backgroundImageUrl}
                    logoUrl={previewCertificate.templateBranding.logoUrl}
                    signatory1SignatureUrl={previewCertificate.templateBranding.signatory1SignatureUrl}
                    signatory2SignatureUrl={previewCertificate.templateBranding.signatory2SignatureUrl}
                    renderedData={previewCertificate.renderedDataJson}
                    className="overflow-hidden rounded-lg border border-slate-200"
                  />
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-10 text-center text-sm text-slate-500">
                    Template layout is not available for this certificate.
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Status</span>
                  <Badge variant={previewCertificate.status === "ISSUED" ? "success" : previewCertificate.status === "REVOKED" ? "danger" : "default"}>
                    {previewCertificate.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Certificate Number</span>
                  <span className="font-mono text-xs text-slate-700">{previewCertificate.certificateNumber ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Learner</span>
                  <span className="text-right font-medium text-slate-800">{previewCertificate.learnerName}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Issued</span>
                  <span className="text-right text-slate-700">{new Date(previewCertificate.issuedAt).toLocaleDateString()}</span>
                </div>
                {previewCertificate.revokedAt && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Revoked</span>
                    <span className="text-right text-slate-700">{new Date(previewCertificate.revokedAt).toLocaleDateString()}</span>
                  </div>
                )}
                <div className="pt-2">
                  <Link
                    href={`/verify/${previewCertificate.verificationCode}`}
                    target="_blank"
                    className="inline-flex items-center text-xs font-semibold text-[#0d3b84] hover:underline"
                  >
                    Open public verification page
                  </Link>
                </div>
              </div>
            </div>
          )}

          <SheetFooter className="mt-6">
            <Button variant="secondary" onClick={() => { setPreviewCertificateId(null); setPreviewCertificate(null); }}>
              Close
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Issue dialog ────────────────────────────────────────────────────── */}
      <IssueCertificateDialog
        open={issueDialogOpen}
        onOpenChange={setIssueDialogOpen}
        courses={courses}
        selectedCourseId={selectedCourseId}
        onIssued={() => { void loadIssued(); setTab("issued"); }}
      />

      {/* ── Create base template dialog ─────────────────────────────────────── */}
      <CreateBaseTemplateDialog
        open={addBaseTemplateOpen}
        onOpenChange={setAddBaseTemplateOpen}
        onCreated={() => { setAddBaseTemplateOpen(false); void loadBaseTemplates(); }}
      />

      {/* ── Import to course dialog ─────────────────────────────────────────── */}
      <ImportToCourseDialog
        open={Boolean(importToCourseTemplateId)}
        templateId={importToCourseTemplateId ?? ""}
        courses={courses}
        onOpenChange={(open) => { if (!open) setImportToCourseTemplateId(null); }}
        onImported={() => { setImportToCourseTemplateId(null); }}
      />

      {/* ── Promote to library confirm dialog ──────────────────────────────── */}
      <Dialog open={Boolean(promoteTemplateId)} onOpenChange={(open) => { if (!open) setPromoteTemplateId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save to Library</DialogTitle>
            <DialogDescription>
              This will copy the template to the Base Templates library. The original course template is unchanged.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            The copy will appear in the <strong>Library</strong> tab and can be imported to any course.
          </p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPromoteTemplateId(null)}>Cancel</Button>
            <Button onClick={handlePromoteToBase} disabled={isPromoting}>
              {isPromoting ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              Save to Library
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Branding sheet ──────────────────────────────────────────────────── */}
      <BrandingSheet
        open={Boolean(brandingSheetId)}
        template={brandingTemplate}
        isSaving={isSavingBranding}
        onClose={() => { setBrandingSheetId(null); setBrandingTemplate(null); }}
        onSave={async (data) => {
          if (!brandingSheetId) return;
          setIsSavingBranding(true);
          try {
            const res = await fetch(`/api/certifications/templates/${brandingSheetId}/branding`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error();
            toast.success("Branding saved.");
            setBrandingSheetId(null);
            setBrandingTemplate(null);
            void loadTemplates();
          } catch {
            toast.error("Failed to save branding.");
          } finally {
            setIsSavingBranding(false);
          }
        }}
      />
    </div>
  );
}

// ── Templates tab ────────────────────────────────────────────────────────────

function TemplatesTab({
  templates,
  isLoading,
  onOpenEditor,
  onOpenBranding,
  onDelete,
  onSaveToLibrary,
}: {
  templates: CertificateTemplateWithPreview[];
  isLoading: boolean;
  onOpenEditor: (id: string) => void;
  onOpenBranding: (id: string) => void;
  onDelete: (id: string) => void;
  onSaveToLibrary: (id: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileText className="mb-3 h-10 w-10 text-slate-300" />
        <p className="text-sm font-medium text-slate-500">No templates yet</p>
        <p className="mt-1 text-xs text-slate-400">
          Create your first certificate template to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((tpl) => (
        <div
          key={tpl.id}
          className="group overflow-hidden rounded-xl border border-[#dde1e6] bg-white shadow-sm transition-shadow hover:shadow-md"
        >
          {/* Preview thumbnail */}
          <div
            className="relative cursor-pointer border-b border-[#dde1e6] bg-slate-50"
            onClick={() => onOpenEditor(tpl.id)}
          >
            <CertificatePreviewRenderer
              layoutJson={tpl.layoutJson}
              orientation={tpl.orientation}
              paperSize={tpl.paperSize}
              backgroundColor={tpl.backgroundColor}
              backgroundImageUrl={tpl.backgroundImageUrl}
              logoUrl={tpl.logoUrl}
              signatory1SignatureUrl={tpl.signatory1SignatureUrl}
              signatory2SignatureUrl={tpl.signatory2SignatureUrl}
              className="rounded-t-xl"
            />
            {/* Hover overlay */}
            <div className="absolute inset-0 flex items-center justify-center rounded-t-xl bg-black/0 transition-colors group-hover:bg-black/5">
              <span className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100">
                <Pencil className="mr-1 inline-block h-3 w-3" />
                Edit Layout
              </span>
            </div>
          </div>

          {/* Card body */}
          <div className="px-3.5 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="truncate text-sm font-semibold text-slate-800">{tpl.title}</h3>
                  {tpl.isDefault && <Badge variant="info">Default</Badge>}
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-500">{tpl.courseName}</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <MoreHorizontal className="h-4.5 w-4.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onOpenEditor(tpl.id)}>
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Edit Layout
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onOpenBranding(tpl.id)}>
                    <Eye className="mr-2 h-3.5 w-3.5" />
                    Branding
                  </DropdownMenuItem>
                  <CanAccess permission="certifications.edit">
                    <DropdownMenuItem onClick={() => onSaveToLibrary(tpl.id)}>
                      <BookOpen className="mr-2 h-3.5 w-3.5" />
                      Save to Library
                    </DropdownMenuItem>
                  </CanAccess>
                  <CanAccess permission="certifications.delete">
                    <DropdownMenuItem
                      onClick={() => onDelete(tpl.id)}
                      className="text-rose-600 focus:text-rose-700"
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Delete
                    </DropdownMenuItem>
                  </CanAccess>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Meta row */}
            <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
              <span className="capitalize">{tpl.orientation.toLowerCase()}</span>
              <span>·</span>
              <Badge variant={tpl.isActive ? "success" : "default"} className="text-[10px] px-1.5 py-0">
                {tpl.isActive ? "Active" : "Inactive"}
              </Badge>
              <span className="ml-auto">{new Date(tpl.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Issued tab ───────────────────────────────────────────────────────────────

function IssuedTab({
  certificates,
  isLoading,
  onPreview,
  onRevoke,
}: {
  certificates: IssuedCertificateSummary[];
  isLoading: boolean;
  onPreview: (id: string) => void;
  onRevoke: (id: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (certificates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Award className="mb-3 h-10 w-10 text-slate-300" />
        <p className="text-sm font-medium text-slate-500">No certificates issued</p>
        <p className="mt-1 text-xs text-slate-400">
          Issue certificates after creating a template.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#dde1e6]">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-[#dde1e6] bg-slate-50">
          <tr>
            <th className="px-4 py-3 font-semibold text-slate-600">Number</th>
            <th className="px-4 py-3 font-semibold text-slate-600">Learner</th>
            <th className="px-4 py-3 font-semibold text-slate-600">Course</th>
            <th className="px-4 py-3 font-semibold text-slate-600">Program</th>
            <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
            <th className="px-4 py-3 font-semibold text-slate-600">Issued</th>
            <th className="px-4 py-3 text-right font-semibold text-slate-600">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#dde1e6]">
          {certificates.map((cert) => (
            <tr key={cert.id} className="bg-white transition-colors hover:bg-slate-50/60">
              <td className="px-4 py-3 font-mono text-xs text-slate-700">
                {cert.certificateNumber ?? "—"}
              </td>
              <td className="px-4 py-3 font-medium text-slate-800">{cert.learnerName}</td>
              <td className="px-4 py-3 text-slate-600">{cert.courseName ?? "—"}</td>
              <td className="px-4 py-3 text-slate-600">{cert.programName}</td>
              <td className="px-4 py-3">
                <Badge variant={cert.status === "ISSUED" ? "success" : cert.status === "REVOKED" ? "danger" : "default"}>
                  {cert.status}
                </Badge>
              </td>
              <td className="px-4 py-3 text-xs text-slate-400">
                {new Date(cert.issuedAt).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => onPreview(cert.id)}>
                    <Eye className="mr-1 h-3.5 w-3.5" />
                    Preview
                  </Button>
                  <Link
                    href={`/verify/${cert.verificationCode}`}
                    target="_blank"
                    className="inline-flex h-8 items-center rounded-md px-2.5 text-xs font-medium text-[#0d3b84] hover:bg-slate-100"
                  >
                    Verify
                  </Link>
                  {cert.status === "ISSUED" && (
                    <CanAccess permission="certifications.revoke">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-500 hover:text-rose-700"
                        onClick={() => onRevoke(cert.id)}
                      >
                        <XCircle className="mr-1 h-3.5 w-3.5" />
                        Revoke
                      </Button>
                    </CanAccess>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Issue Certificate Dialog ─────────────────────────────────────────────────

type ProgramOption = { id: string; name: string; courseId: string };
type BatchOption = { id: string; name: string; code: string; status: string };
type EnrolledLearner = { id: string; fullName: string; learnerCode: string };

function IssueCertificateDialog({
  open,
  onOpenChange,
  courses,
  selectedCourseId,
  onIssued,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: CourseOption[];
  selectedCourseId: string;
  onIssued: () => void;
}) {
  const [courseId, setCourseId] = useState(selectedCourseId);
  const [programId, setProgramId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [selectedLearnerIds, setSelectedLearnerIds] = useState<Set<string>>(new Set());
  const [templateId, setTemplateId] = useState("");
  const [isIssuing, setIsIssuing] = useState(false);

  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [learners, setLearners] = useState<EnrolledLearner[]>([]);
  const [courseTemplates, setCourseTemplates] = useState<CertificateTemplateSummary[]>([]);

  const [isLoadingPrograms, setIsLoadingPrograms] = useState(false);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [isLoadingLearners, setIsLoadingLearners] = useState(false);

  // Sync courseId when parent selection changes
  useEffect(() => {
    if (open) setCourseId(selectedCourseId);
  }, [open, selectedCourseId]);

  // ── Load programs (filtered by courseId) ───────────────────────────────────
  useEffect(() => {
    if (!open || !courseId) { setPrograms([]); return; }
    setIsLoadingPrograms(true);
    fetch(`/api/programs?courseId=${courseId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((res: { data?: ProgramOption[] }) => setPrograms(res.data ?? []))
      .catch(() => { })
      .finally(() => setIsLoadingPrograms(false));
  }, [open, courseId]);

  // ── Load batches (filtered by programId) ───────────────────────────────────
  useEffect(() => {
    if (!programId) { setBatches([]); return; }
    setIsLoadingBatches(true);
    fetch(`/api/programs/${programId}/batches`, { cache: "no-store" })
      .then((r) => r.json())
      .then((res: { data?: BatchOption[] }) => setBatches(res.data ?? []))
      .catch(() => { })
      .finally(() => setIsLoadingBatches(false));
  }, [programId]);

  // ── Load enrolled learners (filtered by batchId) ───────────────────────────
  useEffect(() => {
    if (!batchId) { setLearners([]); return; }
    setIsLoadingLearners(true);
    fetch(`/api/batches/${batchId}/enrollments?pageSize=500`, { cache: "no-store" })
      .then((r) => r.json())
      .then((res: { data?: { items?: EnrolledLearner[] } }) =>
        setLearners(res.data?.items ?? []),
      )
      .catch(() => { })
      .finally(() => setIsLoadingLearners(false));
  }, [batchId]);

  // ── Load course templates ──────────────────────────────────────────────────
  useEffect(() => {
    if (!courseId) { setCourseTemplates([]); return; }
    fetch(`/api/certifications/templates?courseId=${courseId}`)
      .then((r) => r.json())
      .then((res: { data?: CertificateTemplateSummary[] }) => {
        const list = res.data ?? [];
        setCourseTemplates(list);
        const def = list.find((t) => t.isDefault);
        if (def) setTemplateId(def.id);
      })
      .catch(() => { });
  }, [courseId]);

  // ── Cascade resets ─────────────────────────────────────────────────────────
  function handleCourseChange(newCourseId: string) {
    setCourseId(newCourseId);
    setProgramId("");
    setBatchId("");
    setSelectedLearnerIds(new Set());
    setTemplateId("");
  }

  function handleProgramChange(newProgramId: string) {
    setProgramId(newProgramId);
    setBatchId("");
    setSelectedLearnerIds(new Set());
  }

  function handleBatchChange(newBatchId: string) {
    setBatchId(newBatchId);
    setSelectedLearnerIds(new Set());
  }

  function toggleAllLearners() {
    if (selectedLearnerIds.size === learners.length) {
      setSelectedLearnerIds(new Set());
    } else {
      setSelectedLearnerIds(new Set(learners.map((l) => l.id)));
    }
  }

  // ── Issue ──────────────────────────────────────────────────────────────────
  async function handleIssue() {
    if (selectedLearnerIds.size === 0 || !courseId || !programId || !templateId) return;
    setIsIssuing(true);
    try {
      const learnerIds = Array.from(selectedLearnerIds);
      const payload =
        learnerIds.length === 1
          ? { learnerId: learnerIds[0], courseId, programId, batchId: batchId || null, templateId }
          : { learnerIds, courseId, programId, batchId: batchId || null, templateId };

      const res = await fetch("/api/certifications/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as { error?: string })?.error ?? "Failed to issue.");
      }
      toast.success(
        learnerIds.length === 1
          ? "Certificate issued."
          : `${learnerIds.length} certificates issued.`,
      );
      onOpenChange(false);
      onIssued();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to issue certificate.");
    } finally {
      setIsIssuing(false);
    }
  }

  const allSelected = learners.length > 0 && selectedLearnerIds.size === learners.length;
  const canIssue = selectedLearnerIds.size > 0 && courseId && programId && templateId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Issue Certificate</DialogTitle>
          <DialogDescription>Select a course, program, batch, and learners to issue certificates.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {/* Course */}
          <label className="text-xs font-semibold text-slate-500 uppercase">
            Course
            <select className={selectClassName + " mt-1"} value={courseId} onChange={(e) => handleCourseChange(e.target.value)}>
              <option value="">Select course…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          {/* Program */}
          <label className="text-xs font-semibold text-slate-500 uppercase">
            Program
            <select
              className={selectClassName + " mt-1"}
              value={programId}
              onChange={(e) => handleProgramChange(e.target.value)}
              disabled={!courseId || isLoadingPrograms}
            >
              <option value="">{isLoadingPrograms ? "Loading…" : "Select program…"}</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>

          {/* Batch */}
          <label className="text-xs font-semibold text-slate-500 uppercase">
            Batch
            <select
              className={selectClassName + " mt-1"}
              value={batchId}
              onChange={(e) => handleBatchChange(e.target.value)}
              disabled={!programId || isLoadingBatches}
            >
              <option value="">{isLoadingBatches ? "Loading…" : "Select batch…"}</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.name || b.code}</option>
              ))}
            </select>
          </label>

          {/* Learners — multi-select checklist */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase">
                Learners
                {selectedLearnerIds.size > 0 && (
                  <span className="ml-1.5 text-[10px] font-medium text-[#0d3b84]">
                    ({selectedLearnerIds.size} selected)
                  </span>
                )}
              </span>
              {learners.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAllLearners}
                  className="text-[11px] font-medium text-[#0d3b84] hover:underline"
                >
                  {allSelected ? "Deselect all" : "Select all"}
                </button>
              )}
            </div>
            <div className="mt-1 max-h-40 overflow-y-auto rounded-xl border border-[#dde1e6] bg-white">
              {!batchId ? (
                <p className="px-3 py-4 text-center text-xs text-slate-400">
                  Select a batch to view enrolled learners.
                </p>
              ) : isLoadingLearners ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                </div>
              ) : learners.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-slate-400">
                  No learners enrolled in this batch.
                </p>
              ) : (
                learners.map((l) => {
                  const isChecked = selectedLearnerIds.has(l.id);
                  return (
                    <label
                      key={l.id}
                      className={`flex cursor-pointer items-center gap-2.5 border-b border-slate-100 px-3 py-2 text-sm transition-colors last:border-b-0 hover:bg-slate-50 ${isChecked ? "bg-blue-50/50" : ""}`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-white transition-colors ${isChecked ? "border-[#0d3b84] bg-[#0d3b84]" : "border-slate-300 bg-white"}`}
                      >
                        {isChecked && <Check className="h-3 w-3" />}
                      </span>
                      <span className="flex-1 truncate text-slate-800">{l.fullName}</span>
                      <span className="text-[10px] text-slate-400">{l.learnerCode}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Template */}
          <label className="text-xs font-semibold text-slate-500 uppercase">
            Template
            <select className={selectClassName + " mt-1"} value={templateId} onChange={(e) => setTemplateId(e.target.value)} disabled={!courseId}>
              <option value="">Select template…</option>
              {courseTemplates.map((t) => (
                <option key={t.id} value={t.id}>{t.title}{t.isDefault ? " (default)" : ""}</option>
              ))}
            </select>
          </label>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleIssue} disabled={isIssuing || !canIssue}>
            {isIssuing ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : selectedLearnerIds.size > 1 ? (
              <Users className="mr-1 h-3.5 w-3.5" />
            ) : (
              <ShieldCheck className="mr-1 h-3.5 w-3.5" />
            )}
            {selectedLearnerIds.size > 1 ? `Issue ${selectedLearnerIds.size} Certificates` : "Issue Certificate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Branding Sheet ───────────────────────────────────────────────────────────

function BrandingImageUpload({
  label,
  value,
  onChange,
  templateId,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  templateId: string;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/certifications/templates/${templateId}/branding/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as { error?: string })?.error ?? "Upload failed.");
      }
      const result = (await res.json()) as { data?: { asset?: { url?: string } } };
      const url = result.data?.asset?.url;
      if (url) onChange(url);
      else throw new Error("Upload returned no URL.");
      toast.success(`${label} uploaded.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-semibold text-slate-500 uppercase">{label}</span>
      {value && (
        <div className="relative rounded-lg border border-slate-200 bg-slate-50 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={label}
            className="mx-auto max-h-24 max-w-full rounded object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-1 top-1 rounded-full bg-white p-0.5 text-slate-400 shadow-sm hover:text-rose-500"
            title="Remove"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={isUploading}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-[#0d3b84] hover:text-[#0d3b84]"
        >
          {isUploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <UploadCloud className="h-3.5 w-3.5" />
          )}
          {isUploading ? "Uploading…" : value ? "Replace" : "Upload Image"}
        </button>
        <span className="text-[10px] text-slate-400">or paste URL below</span>
      </div>
      <input
        className={inputClassName}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://… or upload above"
      />
    </div>
  );
}

function BrandingSheet({
  open,
  template,
  isSaving,
  onClose,
  onSave,
}: {
  open: boolean;
  template: CertificateTemplateDetail | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (data: Record<string, string | null>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    backgroundColor: "",
    backgroundImageUrl: "",
    logoUrl: "",
    signatory1Name: "",
    signatory1Title: "",
    signatory1SignatureUrl: "",
    signatory2Name: "",
    signatory2Title: "",
    signatory2SignatureUrl: "",
  });

  useEffect(() => {
    if (template) {
      setForm({
        backgroundColor: template.backgroundColor ?? "#ffffff",
        backgroundImageUrl: template.backgroundImageUrl ?? "",
        logoUrl: template.logoUrl ?? "",
        signatory1Name: template.signatory1Name ?? "",
        signatory1Title: template.signatory1Title ?? "",
        signatory1SignatureUrl: template.signatory1SignatureUrl ?? "",
        signatory2Name: template.signatory2Name ?? "",
        signatory2Title: template.signatory2Title ?? "",
        signatory2SignatureUrl: template.signatory2SignatureUrl ?? "",
      });
    }
  }, [template]);

  function update(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const templateId = template?.id ?? "";

  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Template Branding</SheetTitle>
          <SheetDescription>Configure background, logo, and signatory details. Upload images or paste URLs.</SheetDescription>
        </SheetHeader>

        {template ? (
          <div className="space-y-4 px-6 py-4">
            <label className="text-xs font-semibold text-slate-500 uppercase">
              Background Color
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={form.backgroundColor}
                  onChange={(e) => update("backgroundColor", e.target.value)}
                  className="h-8 w-8 cursor-pointer rounded border border-slate-200"
                />
                <input
                  className={inputClassName}
                  value={form.backgroundColor}
                  onChange={(e) => update("backgroundColor", e.target.value)}
                />
              </div>
            </label>

            <BrandingImageUpload
              label="Background Image"
              value={form.backgroundImageUrl}
              onChange={(url) => update("backgroundImageUrl", url)}
              templateId={templateId}
            />

            <BrandingImageUpload
              label="Logo"
              value={form.logoUrl}
              onChange={(url) => update("logoUrl", url)}
              templateId={templateId}
            />

            <hr className="border-slate-100" />

            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Signatory 1</h4>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-slate-500">
                Name
                <input className={inputClassName + " mt-1"} value={form.signatory1Name} onChange={(e) => update("signatory1Name", e.target.value)} />
              </label>
              <label className="text-xs text-slate-500">
                Title
                <input className={inputClassName + " mt-1"} value={form.signatory1Title} onChange={(e) => update("signatory1Title", e.target.value)} />
              </label>
            </div>
            <BrandingImageUpload
              label="Signature 1"
              value={form.signatory1SignatureUrl}
              onChange={(url) => update("signatory1SignatureUrl", url)}
              templateId={templateId}
            />

            <hr className="border-slate-100" />

            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Signatory 2</h4>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-slate-500">
                Name
                <input className={inputClassName + " mt-1"} value={form.signatory2Name} onChange={(e) => update("signatory2Name", e.target.value)} />
              </label>
              <label className="text-xs text-slate-500">
                Title
                <input className={inputClassName + " mt-1"} value={form.signatory2Title} onChange={(e) => update("signatory2Title", e.target.value)} />
              </label>
            </div>
            <BrandingImageUpload
              label="Signature 2"
              value={form.signatory2SignatureUrl}
              onChange={(url) => update("signatory2SignatureUrl", url)}
              templateId={templateId}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        )}

        <SheetFooter>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => {
              const data: Record<string, string | null> = {};
              for (const [k, v] of Object.entries(form)) {
                data[k] = v || null;
              }
              void onSave(data);
            }}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
            Save Branding
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ── Library tab ──────────────────────────────────────────────────────────────

function LibraryTab({
  templates,
  isLoading,
  onOpenEditor,
  onOpenBranding,
  onDelete,
  onImportToCourse,
}: {
  templates: CertificateTemplateWithPreview[];
  isLoading: boolean;
  onOpenEditor: (id: string) => void;
  onOpenBranding: (id: string) => void;
  onDelete: (id: string) => void;
  onImportToCourse: (id: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <BookOpen className="mb-3 h-10 w-10 text-slate-300" />
        <p className="text-sm font-medium text-slate-500">No base templates yet</p>
        <p className="mt-1 text-xs text-slate-400">
          Create a base template or save an existing course template to the library.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Base templates are course-independent. Import a copy to any course to get started quickly.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((tpl) => (
          <div
            key={tpl.id}
            className="group overflow-hidden rounded-xl border border-[#dde1e6] bg-white shadow-sm transition-shadow hover:shadow-md"
          >
            {/* Preview thumbnail */}
            <div
              className="relative cursor-pointer border-b border-[#dde1e6] bg-slate-50"
              onClick={() => onOpenEditor(tpl.id)}
            >
              <CertificatePreviewRenderer
                layoutJson={tpl.layoutJson}
                orientation={tpl.orientation}
                paperSize={tpl.paperSize}
                backgroundColor={tpl.backgroundColor}
                backgroundImageUrl={tpl.backgroundImageUrl}
                logoUrl={tpl.logoUrl}
                signatory1SignatureUrl={tpl.signatory1SignatureUrl}
                signatory2SignatureUrl={tpl.signatory2SignatureUrl}
                className="rounded-t-xl"
              />
              <div className="absolute inset-0 flex items-center justify-center rounded-t-xl bg-black/0 transition-colors group-hover:bg-black/5">
                <span className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100">
                  <Pencil className="mr-1 inline-block h-3 w-3" />
                  Edit Layout
                </span>
              </div>
            </div>

            {/* Card body */}
            <div className="px-3.5 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="truncate text-sm font-semibold text-slate-800">{tpl.title}</h3>
                    <Badge variant="info" className="shrink-0 text-[10px]">Library</Badge>
                  </div>
                  {tpl.description && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{tpl.description}</p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                      <MoreHorizontal className="h-4.5 w-4.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onImportToCourse(tpl.id)}>
                      <UploadCloud className="mr-2 h-3.5 w-3.5" />
                      Import to Course
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onOpenEditor(tpl.id)}>
                      <Pencil className="mr-2 h-3.5 w-3.5" />
                      Edit Layout
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onOpenBranding(tpl.id)}>
                      <Eye className="mr-2 h-3.5 w-3.5" />
                      Branding
                    </DropdownMenuItem>
                    <CanAccess permission="certifications.delete">
                      <DropdownMenuItem
                        onClick={() => onDelete(tpl.id)}
                        className="text-rose-600 focus:text-rose-700"
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Delete
                      </DropdownMenuItem>
                    </CanAccess>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Meta row */}
              <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
                <span className="capitalize">{tpl.orientation.toLowerCase()}</span>
                <span>·</span>
                <span>{tpl.paperSize}</span>
                <span className="ml-auto">{new Date(tpl.updatedAt).toLocaleDateString()}</span>
              </div>

              {/* Import shortcut */}
              <Button
                size="sm"
                variant="secondary"
                className="mt-2.5 w-full text-xs"
                onClick={() => onImportToCourse(tpl.id)}
              >
                <UploadCloud className="mr-1.5 h-3 w-3" />
                Import to Course
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Create Base Template Dialog ───────────────────────────────────────────────

function CreateBaseTemplateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!open) { setTitle(""); setDescription(""); }
  }, [open]);

  async function handleCreate() {
    if (!title.trim()) return;
    setIsCreating(true);
    try {
      const res = await fetch("/api/certifications/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim() || null }),
      });
      if (!res.ok) throw new Error("Failed to create base template.");
      toast.success("Base template created.");
      onCreated();
    } catch {
      toast.error("Failed to create base template.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New Base Template</DialogTitle>
          <DialogDescription>
            Create a reusable template that can be imported to any course.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <label className="text-xs font-semibold text-slate-500 uppercase">
            Title
            <input
              className={inputClassName + " mt-1"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Standard Landscape Certificate"
            />
          </label>
          <label className="text-xs font-semibold text-slate-500 uppercase">
            Description
            <textarea
              className={inputClassName + " mt-1 min-h-[60px] resize-y"}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description…"
            />
          </label>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={isCreating || !title.trim()}>
            {isCreating ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Import to Course Dialog ──────────────────────────────────────────────────

function ImportToCourseDialog({
  open,
  templateId,
  courses,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  templateId: string;
  courses: CourseOption[];
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const [courseId, setCourseId] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (!open) setCourseId("");
  }, [open]);

  async function handleImport() {
    if (!courseId || !templateId) return;
    setIsImporting(true);
    try {
      const res = await fetch(`/api/certifications/templates/${templateId}/import-to-course`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as { error?: string })?.error ?? "Failed to import.");
      }
      const courseName = courses.find((c) => c.id === courseId)?.name ?? "the course";
      toast.success(`Template imported to ${courseName}.`);
      onImported();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to import template.");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Import to Course</DialogTitle>
          <DialogDescription>
            A full copy of this base template will be added to the selected course. You can customise it independently after import.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <label className="text-xs font-semibold text-slate-500 uppercase">
            Course
            <select
              className={"block w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84] mt-1"}
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            >
              <option value="">Select course…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleImport} disabled={isImporting || !courseId}>
            {isImporting ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
