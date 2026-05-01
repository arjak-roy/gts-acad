"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import DOMPurify from "isomorphic-dompurify";
import { Award, BookOpen, Boxes, Copy, Download, Eye, FileText, GripVertical, HeartPulse, LayoutTemplate, Loader2, MoreHorizontal, PanelLeft, PanelLeftClose, Pencil, Plus, Save, Trash2, Workflow } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { CurriculumAssessmentPickerDialog } from "@/components/modules/curriculum-builder/curriculum-assessment-picker-dialog";
import { CurriculumCertificateMilestone } from "@/components/modules/curriculum-builder/curriculum-certificate-milestone";
import { CurriculumContentPickerDialog } from "@/components/modules/curriculum-builder/curriculum-content-picker-dialog";
import { CurriculumInlineContentCreator } from "@/components/modules/curriculum-builder/curriculum-inline-content-creator";
import { CurriculumHealthBadge, CurriculumHealthReport } from "@/components/modules/curriculum-builder/curriculum-health-badge";
import { CurriculumHierarchyView } from "@/components/modules/curriculum-builder/curriculum-hierarchy-view";
import { CurriculumTemplatesTab } from "@/components/modules/curriculum-builder/curriculum-templates-tab";
import { AssessmentDetailSheet } from "@/components/modules/assessment-pool/assessment-detail-sheet";
import { EditContentSheet } from "@/components/modules/course-builder/edit-content-sheet";
import { RichContentEditorSheet } from "@/components/modules/course-builder/rich-content-editor-sheet";
import { CertificatePreviewRenderer } from "@/components/modules/certifications/certificate-preview-renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { QUESTION_TYPE_LABELS } from "@/lib/question-types";
import { useRbac } from "@/lib/rbac-context";
import { cn } from "@/lib/utils";

type ApiEnvelope<T> = {
  data?: T;
  error?: string;
};

type CourseOption = {
  id: string;
  name: string;
  isActive: boolean;
};

type ContentOption = {
  id: string;
  title: string;
  status: string;
  folderId: string | null;
  folderName: string | null;
  contentType: string;
};

type ContentFolderOption = {
  id: string;
  name: string;
  contentCount: number;
};

type AssessmentOption = {
  id: string;
  code: string;
  title: string;
  status: string;
  questionType: string;
  difficultyLevel: string;
  isLinkedToCourse: boolean;
};

type CourseAssessmentLinkOption = {
  assessmentPoolId: string;
};

type CurriculumItemType = "CONTENT" | "ASSESSMENT";
type CurriculumItemReleaseType = "IMMEDIATE" | "ABSOLUTE_DATE" | "BATCH_RELATIVE" | "PREVIOUS_ITEM_COMPLETION" | "PREVIOUS_ITEM_SCORE" | "MANUAL";

type CurriculumStageItemReleaseDetail = {
  releaseType: CurriculumItemReleaseType;
  releaseAt: string | null;
  releaseOffsetDays: number | null;
  prerequisiteStageItemId: string | null;
  prerequisiteTitle: string | null;
  minimumScorePercent: number | null;
  estimatedDurationMinutes: number | null;
  dueAt: string | null;
  dueOffsetDays: number | null;
  resolvedUnlockAt: string | null;
  resolvedDueAt: string | null;
};

type CurriculumStageItemBatchManualRelease = {
  isReleased: boolean;
  releasedAt: string | null;
  releasedByName: string | null;
  note: string | null;
};

type StageItemReferenceOption = {
  id: string;
  label: string;
};

type StageItemReleaseDraft = {
  releaseType: CurriculumItemReleaseType;
  releaseAt: string;
  releaseOffsetDays: string;
  prerequisiteStageItemId: string;
  minimumScorePercent: string;
  estimatedDurationMinutes: string;
  dueMode: "NONE" | "ABSOLUTE_DATE" | "BATCH_RELATIVE";
  dueAt: string;
  dueOffsetDays: string;
};

type CurriculumStageItemDetail = {
  id: string;
  itemType: CurriculumItemType;
  contentId: string | null;
  assessmentPoolId: string | null;
  sortOrder: number;
  isRequired: boolean;
  referenceCode: string | null;
  referenceTitle: string;
  referenceDescription: string | null;
  courseName: string | null;
  status: string | null;
  contentType: string | null;
  questionType: string | null;
  difficultyLevel: string | null;
  folderName: string | null;
  release: CurriculumStageItemReleaseDetail;
  batchManualRelease: CurriculumStageItemBatchManualRelease | null;
};

type CurriculumStageSummary = {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  completionRule: string;
  completionThreshold: number | null;
  prerequisiteStageId: string | null;
  itemCount: number;
  items: CurriculumStageItemDetail[];
};

type CurriculumModuleSummary = {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  completionRule: string;
  completionThreshold: number | null;
  prerequisiteModuleId: string | null;
  stageCount: number;
  itemCount: number;
  stages: CurriculumStageSummary[];
};

type CurriculumDetail = {
  id: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  title: string;
  description: string | null;
  status: string;
  moduleCount: number;
  stageCount: number;
  itemCount: number;
  batchCount: number;
  createdAt: string;
  createdByName: string | null;
  updatedAt: string;
  modules: CurriculumModuleSummary[];
};

type ModuleSaveInput = {
  title: string;
  description: string;
  completionRule?: string;
  completionThreshold?: number | null;
  prerequisiteModuleId?: string | null;
};

type StageSaveInput = {
  title: string;
  description: string;
  completionRule?: string;
  completionThreshold?: number | null;
  prerequisiteStageId?: string | null;
};

type CurriculumSummary = {
  id: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  title: string;
  description: string | null;
  status: string;
  isTemplate?: boolean;
  moduleCount: number;
  stageCount: number;
  itemCount: number;
  batchCount: number;
  createdAt: string;
  updatedAt: string;
};

type CurriculumBatchMapping = {
  mappingId: string | null;
  batchId: string;
  batchCode: string;
  batchName: string;
  programId: string;
  programName: string;
  campus: string | null;
  status: string;
  startDate: string;
  endDate: string | null;
  isMapped: boolean;
  hasEffectiveAccess: boolean;
  assignedAt: string | null;
  assignedByName: string | null;
  assignmentSource: "COURSE" | "BATCH" | "COURSE_AND_BATCH";
  isInheritedFromCourse: boolean;
  canRemoveBatchMapping: boolean;
  canAddBatchMapping: boolean;
};

type WorkspacePopupView = "SEQUENCE" | "REFERENCES" | "BATCHES" | "CLONE" | "TEMPLATES" | "CERTIFICATES" | "HEALTH";

const selectClassName = "block w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84]";
const textareaClassName = "flex min-h-[96px] w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84]";

const statusVariant: Record<string, "default" | "info" | "warning"> = {
  DRAFT: "info",
  PUBLISHED: "default",
  ARCHIVED: "warning",
};

const itemTypeVariant: Record<CurriculumItemType, "info" | "accent"> = {
  CONTENT: "info",
  ASSESSMENT: "accent",
};

const contentTypeLabels: Record<string, string> = {
  PDF: "PDF",
  DOCUMENT: "Document",
  VIDEO: "Video",
  SCORM: "SCORM",
  LINK: "Link",
  OTHER: "Other",
};

const questionTypeLabels: Record<string, string> = QUESTION_TYPE_LABELS;

const assignmentSourceLabels: Record<CurriculumBatchMapping["assignmentSource"], string> = {
  COURSE: "Inherited from course",
  BATCH: "Batch-specific mapping",
  COURSE_AND_BATCH: "Inherited + batch mapping",
};

const releaseTypeLabels: Record<CurriculumItemReleaseType, string> = {
  IMMEDIATE: "Immediate",
  ABSOLUTE_DATE: "On fixed date",
  BATCH_RELATIVE: "After batch start",
  PREVIOUS_ITEM_COMPLETION: "After completion",
  PREVIOUS_ITEM_SCORE: "After score",
  MANUAL: "Manual release",
};

const releaseTypeVariant: Record<CurriculumItemReleaseType, "default" | "info" | "warning" | "accent"> = {
  IMMEDIATE: "default",
  ABSOLUTE_DATE: "info",
  BATCH_RELATIVE: "info",
  PREVIOUS_ITEM_COMPLETION: "accent",
  PREVIOUS_ITEM_SCORE: "accent",
  MANUAL: "warning",
};

async function readApiData<T>(response: Response, fallbackMessage: string) {
  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok) {
    throw new Error(payload.error || fallbackMessage);
  }

  return payload.data as T;
}

async function sendJson<T>(url: string, init: RequestInit, fallbackMessage: string) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  return readApiData<T>(response, fallbackMessage);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function formatDateLabel(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTimeInput(value?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formatDurationLabel(minutes?: number | null) {
  if (!minutes || minutes <= 0) {
    return null;
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? `${hours} hr` : `${hours} hr ${remainingMinutes} min`;
}

function buildReleaseSummary(release: CurriculumStageItemReleaseDetail) {
  if (release.releaseType === "ABSOLUTE_DATE") {
    return release.resolvedUnlockAt ? `Unlocks ${formatDateLabel(release.resolvedUnlockAt)}` : "Unlocks on a fixed date";
  }

  if (release.releaseType === "BATCH_RELATIVE") {
    const dayCount = release.releaseOffsetDays ?? 0;
    return `Unlocks ${dayCount === 1 ? "1 day" : `${dayCount} days`} after batch start`;
  }

  if (release.releaseType === "PREVIOUS_ITEM_COMPLETION") {
    return `Unlocks after ${release.prerequisiteTitle ?? "the previous item"} is completed`;
  }

  if (release.releaseType === "PREVIOUS_ITEM_SCORE") {
    return `Unlocks after ${release.prerequisiteTitle ?? "the previous assessment"} reaches ${release.minimumScorePercent ?? 40}%`;
  }

  if (release.releaseType === "MANUAL") {
    return "Requires manual release per batch";
  }

  return "Available immediately";
}

function createReleaseDraft(release: CurriculumStageItemReleaseDetail): StageItemReleaseDraft {
  return {
    releaseType: release.releaseType,
    releaseAt: formatDateTimeInput(release.releaseAt),
    releaseOffsetDays: typeof release.releaseOffsetDays === "number" ? String(release.releaseOffsetDays) : "",
    prerequisiteStageItemId: release.prerequisiteStageItemId ?? "",
    minimumScorePercent: typeof release.minimumScorePercent === "number" ? String(release.minimumScorePercent) : "",
    estimatedDurationMinutes: typeof release.estimatedDurationMinutes === "number" ? String(release.estimatedDurationMinutes) : "",
    dueMode: release.dueAt ? "ABSOLUTE_DATE" : typeof release.dueOffsetDays === "number" ? "BATCH_RELATIVE" : "NONE",
    dueAt: formatDateTimeInput(release.dueAt),
    dueOffsetDays: typeof release.dueOffsetDays === "number" ? String(release.dueOffsetDays) : "",
  };
}

function validateReleaseDraft(draft: StageItemReleaseDraft) {
  if (draft.releaseType === "ABSOLUTE_DATE" && !draft.releaseAt) {
    return "Choose the unlock date for this item.";
  }

  if (draft.releaseType === "BATCH_RELATIVE" && draft.releaseOffsetDays.trim() === "") {
    return "Enter the number of days after batch start for this item to unlock.";
  }

  if (draft.releaseType === "PREVIOUS_ITEM_SCORE" && draft.minimumScorePercent.trim() === "") {
    return "Enter the minimum score required to unlock this item.";
  }

  if (draft.dueMode === "ABSOLUTE_DATE" && !draft.dueAt) {
    return "Choose the due date for this item or switch due mode.";
  }

  if (draft.dueMode === "BATCH_RELATIVE" && draft.dueOffsetDays.trim() === "") {
    return "Enter the batch-relative due offset or switch due mode.";
  }

  return null;
}

function buildReleaseConfigPayload(draft: StageItemReleaseDraft) {
  return {
    releaseType: draft.releaseType,
    releaseAt: draft.releaseType === "ABSOLUTE_DATE" && draft.releaseAt ? new Date(draft.releaseAt).toISOString() : null,
    releaseOffsetDays: draft.releaseType === "BATCH_RELATIVE" && draft.releaseOffsetDays.trim() !== "" ? Number(draft.releaseOffsetDays) : null,
    prerequisiteStageItemId: draft.releaseType === "PREVIOUS_ITEM_COMPLETION" || draft.releaseType === "PREVIOUS_ITEM_SCORE"
      ? draft.prerequisiteStageItemId || null
      : null,
    minimumScorePercent: draft.releaseType === "PREVIOUS_ITEM_SCORE" && draft.minimumScorePercent.trim() !== ""
      ? Number(draft.minimumScorePercent)
      : null,
    estimatedDurationMinutes: draft.estimatedDurationMinutes.trim() !== "" ? Number(draft.estimatedDurationMinutes) : null,
    dueAt: draft.dueMode === "ABSOLUTE_DATE" && draft.dueAt ? new Date(draft.dueAt).toISOString() : null,
    dueOffsetDays: draft.dueMode === "BATCH_RELATIVE" && draft.dueOffsetDays.trim() !== "" ? Number(draft.dueOffsetDays) : null,
  };
}

function reorderByIds<T extends { id: string; sortOrder: number }>(items: T[], orderedIds: string[]) {
  const lookup = new Map(items.map((item) => [item.id, item]));

  return orderedIds.map((id, index) => ({
    ...lookup.get(id)!,
    sortOrder: index,
  }));
}

function CurriculumMetaEditor({
  curriculum,
  disabled,
  canEdit,
  onSave,
}: {
  curriculum: CurriculumDetail;
  disabled: boolean;
  canEdit: boolean;
  onSave: (input: { title: string; description: string; status: string }) => Promise<boolean>;
}) {
  const [title, setTitle] = useState(curriculum.title);
  const [description, setDescription] = useState(curriculum.description ?? "");
  const [status, setStatus] = useState(curriculum.status);

  useEffect(() => {
    setTitle(curriculum.title);
    setDescription(curriculum.description ?? "");
    setStatus(curriculum.status);
  }, [curriculum.description, curriculum.id, curriculum.status, curriculum.title]);

  const isDirty = title.trim() !== curriculum.title
    || description.trim() !== (curriculum.description ?? "")
    || status !== curriculum.status;

  async function handleSave() {
    if (!isDirty) {
      return;
    }

    await onSave({
      title,
      description,
      status,
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Curriculum details</p>
            <p className="text-xs text-muted-foreground">
              {curriculum.createdByName ? `Created by ${curriculum.createdByName} · ` : ""}
              Last updated {formatDateTime(curriculum.updatedAt)}
            </p>
          </div>
          <Badge variant={statusVariant[curriculum.status] ?? "info"}>{curriculum.status}</Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <div className="space-y-2">
            <label className="text-sm font-medium">Curriculum title</label>
            <Input value={title} disabled={disabled || !canEdit} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <select
              value={status}
              disabled={disabled || !canEdit}
              onChange={(event) => setStatus(event.target.value)}
              className={selectClassName}
            >
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Description</label>
          <textarea
            value={description}
            disabled={disabled || !canEdit}
            onChange={(event) => setDescription(event.target.value)}
            className={textareaClassName}
            placeholder="Summarize the purpose, learning outcomes, or sequencing notes for this curriculum."
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" disabled={disabled || !canEdit || !isDirty} onClick={() => {
            setTitle(curriculum.title);
            setDescription(curriculum.description ?? "");
            setStatus(curriculum.status);
          }}>
            Reset
          </Button>
          <Button type="button" disabled={disabled || !canEdit || !isDirty} onClick={() => void handleSave()}>
            <Save className="h-4 w-4" />
            Save Curriculum
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SortableStageItemRow({
  item,
  courseId,
  contentFolders,
  disabled,
  canEdit,
  stageItemOptions,
  onToggleRequired,
  onSaveReleaseConfig,
  onDelete,
  onContentUpdated,
}: {
  item: CurriculumStageItemDetail;
  courseId: string;
  contentFolders: ContentFolderOption[];
  disabled: boolean;
  canEdit: boolean;
  stageItemOptions: StageItemReferenceOption[];
  onToggleRequired: (itemId: string, nextRequired: boolean) => Promise<boolean>;
  onSaveReleaseConfig: (itemId: string, releaseConfig: ReturnType<typeof buildReleaseConfigPayload>) => Promise<boolean>;
  onDelete: (itemId: string) => Promise<boolean>;
  onContentUpdated: () => void | Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: disabled || !canEdit,
  });
  const [isEditingRelease, setIsEditingRelease] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [releaseDraft, setReleaseDraft] = useState<StageItemReleaseDraft>(() => createReleaseDraft(item.release));

  // Edit state
  const [editContentOpen, setEditContentOpen] = useState(false);
  const [richEditorOpen, setRichEditorOpen] = useState(false);
  const [richEditorHtml, setRichEditorHtml] = useState("");
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const [assessmentDetailOpen, setAssessmentDetailOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const downloadContent = useCallback(async (format: "docx" | "html") => {
    if (!item.contentId || isExporting) return;
    setIsExporting(true);
    try {
      const res = await fetch(`/api/course-content/${item.contentId}/export?format=${format}`, { cache: "no-store" });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Export failed.");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="?([^";]+)"?/i);
      const filename = match?.[1] ? decodeURIComponent(match[1]) : `content.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setIsExporting(false);
    }
  }, [item.contentId, isExporting]);

  const initialReleaseDraft = createReleaseDraft(item.release);
  const isReleaseDirty = JSON.stringify(releaseDraft) !== JSON.stringify(initialReleaseDraft);
  const prerequisiteOptions = stageItemOptions.filter((option) => option.id !== item.id);

  useEffect(() => {
    setReleaseDraft(createReleaseDraft(item.release));
  }, [item.id, item.release]);

  async function handleSaveReleaseRules() {
    const validationError = validateReleaseDraft(releaseDraft);

    if (validationError) {
      toast.error(validationError);
      return;
    }

    const ok = await onSaveReleaseConfig(item.id, buildReleaseConfigPayload(releaseDraft));

    if (ok) {
      setIsEditingRelease(false);
    }
  }

  function handleEdit() {
    if (item.itemType === "ASSESSMENT" && item.assessmentPoolId) {
      setAssessmentDetailOpen(true);
      return;
    }

    if (item.itemType === "CONTENT" && item.contentId) {
      if (item.contentType === "ARTICLE") {
        // For authored lessons, fetch HTML and open Lesson Studio directly
        setIsLoadingEdit(true);
        fetch(`/api/course-content/${item.contentId}`)
          .then((res) => (res.ok ? res.json() : Promise.reject()))
          .then((json: { data?: { bodyJson?: { version?: number; html?: string } | null; renderedHtml?: string | null } }) => {
            const data = json.data;
            if (data?.bodyJson && data.bodyJson.version === 2 && data.bodyJson.html) {
              setRichEditorHtml(data.bodyJson.html);
            } else {
              setRichEditorHtml(data?.renderedHtml ?? "<p></p>");
            }
            setRichEditorOpen(true);
          })
          .catch(() => {
            toast.error("Failed to load content for editing.");
          })
          .finally(() => setIsLoadingEdit(false));
      } else {
        // For non-article content, open the full edit sheet
        setEditContentOpen(true);
      }
    }
  }

  async function handleRichEditorSave(html: string) {
    if (!item.contentId) return;
    try {
      const res = await fetch(`/api/course-content/${item.contentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodyJson: { version: 2, html } }),
      });
      if (!res.ok) {
        toast.error("Failed to save content.");
        return;
      }
      toast.success("Content saved.");
      setRichEditorOpen(false);
      setPreviewHtml(null); // Clear cached preview so it reloads
      void onContentUpdated();
    } catch {
      toast.error("Failed to save content.");
    }
  }

  function handleTogglePreview() {
    if (isPreviewOpen) {
      setIsPreviewOpen(false);
      return;
    }

    setIsPreviewOpen(true);

    if (previewHtml !== null) return; // Already loaded

    const contentId = item.contentId;
    if (!contentId) return;

    setIsLoadingPreview(true);
    fetch(`/api/course-content/${contentId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((json: { data?: { renderedHtml?: string | null; bodyJson?: { version?: number; html?: string } | null } }) => {
        const data = json.data;
        if (!data) {
          setPreviewHtml("<p class='text-slate-400'>No preview available.</p>");
          return;
        }
        // Prefer v2 HTML directly, then renderedHtml, then fallback
        if (data.bodyJson && data.bodyJson.version === 2 && data.bodyJson.html) {
          setPreviewHtml(data.bodyJson.html);
        } else if (data.renderedHtml) {
          setPreviewHtml(data.renderedHtml);
        } else {
          setPreviewHtml("<p class='text-slate-400'>No preview available for this content type.</p>");
        }
      })
      .catch(() => {
        setPreviewHtml("<p class='text-red-400'>Failed to load preview.</p>");
      })
      .finally(() => setIsLoadingPreview(false));
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-xl border border-[#dde1e6] bg-white p-3 shadow-sm",
        isDragging && "opacity-80 shadow-lg",
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          className="mt-1 shrink-0 text-slate-400 transition-colors hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled || !canEdit}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-slate-900">{item.referenceTitle}</p>
            <Badge variant={itemTypeVariant[item.itemType]}>{item.itemType}</Badge>
            {item.status ? <Badge variant={statusVariant[item.status] ?? "default"}>{item.status}</Badge> : null}
            <Badge variant={releaseTypeVariant[item.release.releaseType]}>{releaseTypeLabels[item.release.releaseType]}</Badge>
            {item.release.estimatedDurationMinutes ? <Badge variant="default">{formatDurationLabel(item.release.estimatedDurationMinutes)}</Badge> : null}
            {item.release.resolvedDueAt ? <Badge variant="warning">Due {formatDateLabel(item.release.resolvedDueAt)}</Badge> : null}
          </div>

          <p className="text-xs text-muted-foreground">
            {item.itemType === "CONTENT"
              ? [
                item.contentType ? contentTypeLabels[item.contentType] ?? item.contentType : null,
                item.folderName,
                item.courseName,
              ].filter(Boolean).join(" · ")
              : [
                item.referenceCode,
                item.questionType ? questionTypeLabels[item.questionType] ?? item.questionType : null,
                item.difficultyLevel,
                item.courseName,
              ].filter(Boolean).join(" · ")}
          </p>

          <p className="text-xs text-slate-500">{buildReleaseSummary(item.release)}</p>

          {item.referenceDescription ? (
            <p className="text-sm text-slate-600">{item.referenceDescription}</p>
          ) : null}

          {/* Inline content preview */}
          {item.itemType === "CONTENT" && item.contentId && isPreviewOpen ? (
            <div className="rounded-xl border border-[#dde1e6] bg-slate-50/60">
              {isLoadingPreview ? (
                <div className="space-y-3 p-4">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
                  <div className="h-3 w-full animate-pulse rounded bg-slate-200" />
                  <div className="h-3 w-5/6 animate-pulse rounded bg-slate-200" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
                  <div className="h-3 w-full animate-pulse rounded bg-slate-200" />
                  <div className="h-3 w-4/5 animate-pulse rounded bg-slate-200" />
                </div>
              ) : previewHtml ? (
                <>
                  <div
                    className="prose prose-sm prose-slate max-h-[400px] max-w-none overflow-y-auto p-4 [&_img]:max-w-full [&_img]:rounded-lg [&_table]:text-xs [&_pre]:text-xs"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewHtml) }}
                  />
                  {item.contentType === "ARTICLE" && (
                    <div className="flex items-center gap-1.5 border-t border-[#dde1e6] px-4 py-2">
                      <span className="mr-auto text-[10px] font-medium uppercase tracking-wide text-slate-400">Export</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 rounded-lg px-2.5 text-xs"
                        disabled={isExporting}
                        onClick={() => downloadContent("docx")}
                      >
                        <Download className="h-3 w-3" />
                        DOCX
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 rounded-lg px-2.5 text-xs"
                        disabled={isExporting}
                        onClick={() => downloadContent("html")}
                      >
                        <Download className="h-3 w-3" />
                        HTML
                      </Button>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          ) : null}

          {isEditingRelease ? (
            <div className="rounded-xl border border-dashed border-[#cfd8e3] bg-slate-50/80 p-4">
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Unlock rule</label>
                  <select
                    value={releaseDraft.releaseType}
                    disabled={disabled || !canEdit}
                    onChange={(event) => setReleaseDraft((current) => ({
                      ...current,
                      releaseType: event.target.value as CurriculumItemReleaseType,
                    }))}
                    className={selectClassName}
                  >
                    {Object.entries(releaseTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Estimated duration (minutes)</label>
                  <Input
                    type="number"
                    min={1}
                    max={10080}
                    value={releaseDraft.estimatedDurationMinutes}
                    disabled={disabled || !canEdit}
                    onChange={(event) => setReleaseDraft((current) => ({
                      ...current,
                      estimatedDurationMinutes: event.target.value,
                    }))}
                    placeholder="e.g. 45"
                  />
                </div>

                {releaseDraft.releaseType === "ABSOLUTE_DATE" ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Unlock on</label>
                    <Input
                      type="datetime-local"
                      value={releaseDraft.releaseAt}
                      disabled={disabled || !canEdit}
                      onChange={(event) => setReleaseDraft((current) => ({
                        ...current,
                        releaseAt: event.target.value,
                      }))}
                    />
                  </div>
                ) : null}

                {releaseDraft.releaseType === "BATCH_RELATIVE" ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Unlock after batch start (days)</label>
                    <Input
                      type="number"
                      min={0}
                      max={3650}
                      value={releaseDraft.releaseOffsetDays}
                      disabled={disabled || !canEdit}
                      onChange={(event) => setReleaseDraft((current) => ({
                        ...current,
                        releaseOffsetDays: event.target.value,
                      }))}
                      placeholder="e.g. 7"
                    />
                  </div>
                ) : null}

                {releaseDraft.releaseType === "PREVIOUS_ITEM_COMPLETION" || releaseDraft.releaseType === "PREVIOUS_ITEM_SCORE" ? (
                  <div className="space-y-2 lg:col-span-2">
                    <label className="text-sm font-medium">Prerequisite item</label>
                    <select
                      value={releaseDraft.prerequisiteStageItemId}
                      disabled={disabled || !canEdit}
                      onChange={(event) => setReleaseDraft((current) => ({
                        ...current,
                        prerequisiteStageItemId: event.target.value,
                      }))}
                      className={selectClassName}
                    >
                      <option value="">Use previous sequence item</option>
                      {prerequisiteOptions.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {releaseDraft.releaseType === "PREVIOUS_ITEM_SCORE" ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Minimum score (%)</label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={releaseDraft.minimumScorePercent}
                      disabled={disabled || !canEdit}
                      onChange={(event) => setReleaseDraft((current) => ({
                        ...current,
                        minimumScorePercent: event.target.value,
                      }))}
                      placeholder="e.g. 70"
                    />
                  </div>
                ) : null}

                <div className="space-y-2">
                  <label className="text-sm font-medium">Due rule</label>
                  <select
                    value={releaseDraft.dueMode}
                    disabled={disabled || !canEdit}
                    onChange={(event) => setReleaseDraft((current) => ({
                      ...current,
                      dueMode: event.target.value as StageItemReleaseDraft["dueMode"],
                    }))}
                    className={selectClassName}
                  >
                    <option value="NONE">No due date</option>
                    <option value="ABSOLUTE_DATE">Fixed due date</option>
                    <option value="BATCH_RELATIVE">Relative to batch start</option>
                  </select>
                </div>

                {releaseDraft.dueMode === "ABSOLUTE_DATE" ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Due on</label>
                    <Input
                      type="datetime-local"
                      value={releaseDraft.dueAt}
                      disabled={disabled || !canEdit}
                      onChange={(event) => setReleaseDraft((current) => ({
                        ...current,
                        dueAt: event.target.value,
                      }))}
                    />
                  </div>
                ) : null}

                {releaseDraft.dueMode === "BATCH_RELATIVE" ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Due after batch start (days)</label>
                    <Input
                      type="number"
                      min={0}
                      max={3650}
                      value={releaseDraft.dueOffsetDays}
                      disabled={disabled || !canEdit}
                      onChange={(event) => setReleaseDraft((current) => ({
                        ...current,
                        dueOffsetDays: event.target.value,
                      }))}
                      placeholder="e.g. 14"
                    />
                  </div>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={disabled || !canEdit}
                  onClick={() => {
                    setReleaseDraft(createReleaseDraft(item.release));
                    setIsEditingRelease(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={disabled || !canEdit || !isReleaseDirty}
                  onClick={() => void handleSaveReleaseRules()}
                >
                  <Save className="h-4 w-4" />
                  Save Release Rules
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col items-end gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            <Checkbox
              checked={item.isRequired}
              disabled={disabled || !canEdit}
              onCheckedChange={(checked) => {
                void onToggleRequired(item.id, checked === true);
              }}
            />
            Required
          </label>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled || !canEdit}
            onClick={() => setIsEditingRelease((current) => !current)}
          >
            {isEditingRelease ? "Close Rules" : "Release Rules"}
          </Button>
          {item.itemType === "CONTENT" && item.contentId ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleTogglePreview}
            >
              <Eye className="h-4 w-4" />
              {isPreviewOpen ? "Hide Preview" : "Preview"}
            </Button>
          ) : null}
          {(item.contentId || item.assessmentPoolId) ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled || !canEdit || isLoadingEdit}
              onClick={handleEdit}
            >
              {isLoadingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              Edit
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || !canEdit}
            className="text-rose-600 hover:text-rose-700"
            onClick={() => {
              if (window.confirm(`Remove \"${item.referenceTitle}\" from this stage?`)) {
                void onDelete(item.id);
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
            Remove
          </Button>
        </div>
      </div>

      {/* Edit sheets */}
      {item.itemType === "CONTENT" && item.contentId && item.contentType === "ARTICLE" ? (
        <RichContentEditorSheet
          open={richEditorOpen}
          onOpenChange={setRichEditorOpen}
          initialHtml={richEditorHtml}
          onSave={(html) => void handleRichEditorSave(html)}
          courseId={courseId}
          disabled={disabled}
        />
      ) : null}
      {item.itemType === "CONTENT" && item.contentId && item.contentType !== "ARTICLE" ? (
        <EditContentSheet
          contentId={editContentOpen ? item.contentId : null}
          open={editContentOpen}
          onOpenChange={setEditContentOpen}
          folders={contentFolders.map((f) => ({ id: f.id, name: f.name, description: null }))}
          onUpdated={() => void onContentUpdated()}
        />
      ) : null}
      {item.itemType === "ASSESSMENT" && item.assessmentPoolId ? (
        <AssessmentDetailSheet
          poolId={assessmentDetailOpen ? item.assessmentPoolId : null}
          open={assessmentDetailOpen}
          onOpenChange={setAssessmentDetailOpen}
          onUpdated={() => void onContentUpdated()}
        />
      ) : null}
    </div>
  );
}

function SortableStageCard({
  stage,
  courseId,
  contentOptions,
  contentFolders,
  assessmentOptions,
  isLoadingReferences,
  disabled,
  canEdit,
  canCreateContent,
  stageItemOptions,
  existingContentIds,
  allStages,
  onSave,
  onDelete,
  onCreateItems,
  onRefreshContentReferences,
  onToggleRequired,
  onSaveReleaseConfig,
  onDeleteItem,
  onReorderItems,
}: {
  stage: CurriculumStageSummary;
  courseId: string;
  contentOptions: ContentOption[];
  contentFolders: ContentFolderOption[];
  assessmentOptions: AssessmentOption[];
  isLoadingReferences: boolean;
  disabled: boolean;
  canEdit: boolean;
  canCreateContent: boolean;
  stageItemOptions: StageItemReferenceOption[];
  existingContentIds: string[];
  allStages: CurriculumStageSummary[];
  onSave: (stageId: string, input: StageSaveInput) => Promise<boolean>;
  onDelete: (stageId: string) => Promise<boolean>;
  onCreateItems: (stageId: string, input: { itemType: CurriculumItemType; contentIds: string[]; assessmentPoolIds: string[]; isRequired: boolean }) => Promise<boolean>;
  onRefreshContentReferences: () => Promise<void>;
  onToggleRequired: (itemId: string, nextRequired: boolean) => Promise<boolean>;
  onSaveReleaseConfig: (itemId: string, releaseConfig: ReturnType<typeof buildReleaseConfigPayload>) => Promise<boolean>;
  onDeleteItem: (itemId: string) => Promise<boolean>;
  onReorderItems: (stageId: string, itemIds: string[]) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
    disabled: disabled || !canEdit,
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [isEditing, setIsEditing] = useState(false);
  const [showAddItem, setShowAddItem] = useState(stage.itemCount === 0);
  const [activePicker, setActivePicker] = useState<CurriculumItemType | null>(null);
  const [inlineCreatorOpen, setInlineCreatorOpen] = useState(false);
  const [title, setTitle] = useState(stage.title);
  const [description, setDescription] = useState(stage.description ?? "");
  const [completionRule, setCompletionRule] = useState(stage.completionRule ?? "ALL_REQUIRED");
  const [completionThreshold, setCompletionThreshold] = useState<string>(stage.completionThreshold?.toString() ?? "");
  const [prerequisiteStageId, setPrerequisiteStageId] = useState<string>(stage.prerequisiteStageId ?? "");

  useEffect(() => {
    setTitle(stage.title);
    setDescription(stage.description ?? "");
    setCompletionRule(stage.completionRule ?? "ALL_REQUIRED");
    setCompletionThreshold(stage.completionThreshold?.toString() ?? "");
    setPrerequisiteStageId(stage.prerequisiteStageId ?? "");
  }, [stage.description, stage.id, stage.title, stage.completionRule, stage.completionThreshold, stage.prerequisiteStageId]);

  async function handleSaveStage() {
    const ok = await onSave(stage.id, {
      title,
      description,
      completionRule,
      completionThreshold: completionThreshold ? Number(completionThreshold) : null,
      prerequisiteStageId: prerequisiteStageId || null,
    });
    if (ok) {
      setIsEditing(false);
    }
  }

  function handleItemDragEnd(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) {
      return;
    }

    const currentIds = stage.items.map((item) => item.id);
    const oldIndex = currentIds.indexOf(String(event.active.id));
    const newIndex = currentIds.indexOf(String(event.over.id));

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const orderedIds = arrayMove(currentIds, oldIndex, newIndex);
    void onReorderItems(stage.id, orderedIds);
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-2xl border border-[#dde1e6] bg-slate-50/70 p-4",
        isDragging && "opacity-80 shadow-lg",
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          className="mt-1 shrink-0 text-slate-400 transition-colors hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled || !canEdit}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">{stage.title}</p>
                <Badge variant="default">{stage.itemCount} items</Badge>
              </div>
              {stage.description ? (
                <p className="mt-1 text-sm text-slate-600">{stage.description}</p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">No stage notes yet.</p>
              )}
            </div>

            {canEdit ? (
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => setIsEditing((current) => !current)}>
                  {isEditing ? "Cancel" : "Edit"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  className="text-rose-600 hover:text-rose-700"
                  onClick={() => {
                    if (window.confirm(`Delete stage \"${stage.title}\" and its curriculum items?`)) {
                      void onDelete(stage.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            ) : null}
          </div>

          {isEditing ? (
            <div className="space-y-3 rounded-xl border border-dashed border-[#cfd8e3] bg-white p-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Stage title</label>
                <Input value={title} disabled={disabled} onChange={(event) => setTitle(event.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Stage description</label>
                <textarea
                  value={description}
                  disabled={disabled}
                  onChange={(event) => setDescription(event.target.value)}
                  className={textareaClassName}
                  placeholder="Describe what learners should complete in this stage."
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Completion rule</label>
                  <select
                    value={completionRule}
                    disabled={disabled}
                    onChange={(event) => setCompletionRule(event.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="ALL_REQUIRED">All required items</option>
                    <option value="ALL_ITEMS">All items (required + optional)</option>
                    <option value="PERCENTAGE">Percentage of items</option>
                    <option value="MIN_ITEMS">Minimum number of items</option>
                  </select>
                </div>
                {(completionRule === "PERCENTAGE" || completionRule === "MIN_ITEMS") ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {completionRule === "PERCENTAGE" ? "Threshold (%)" : "Min items"}
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={completionRule === "PERCENTAGE" ? 100 : undefined}
                      value={completionThreshold}
                      disabled={disabled}
                      onChange={(event) => setCompletionThreshold(event.target.value)}
                      placeholder={completionRule === "PERCENTAGE" ? "e.g. 80" : "e.g. 3"}
                    />
                  </div>
                ) : null}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Prerequisite stage</label>
                  <select
                    value={prerequisiteStageId}
                    disabled={disabled}
                    onChange={(event) => setPrerequisiteStageId(event.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">None</option>
                    {allStages
                      .filter((s) => s.id !== stage.id)
                      .map((s) => (
                        <option key={s.id} value={s.id}>{s.title}</option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" disabled={disabled} onClick={() => {
                  setTitle(stage.title);
                  setDescription(stage.description ?? "");
                  setCompletionRule(stage.completionRule ?? "ALL_REQUIRED");
                  setCompletionThreshold(stage.completionThreshold?.toString() ?? "");
                  setPrerequisiteStageId(stage.prerequisiteStageId ?? "");
                  setIsEditing(false);
                }}>
                  Cancel
                </Button>
                <Button type="button" disabled={disabled || !title.trim()} onClick={() => void handleSaveStage()}>
                  Save Stage
                </Button>
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            {stage.items.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-white p-5 text-sm text-muted-foreground">
                No content or assessment items have been assigned to this stage yet.
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleItemDragEnd}>
                <SortableContext items={stage.items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {stage.items.map((item) => (
                      <SortableStageItemRow
                        key={item.id}
                        item={item}
                        courseId={courseId}
                        contentFolders={contentFolders}
                        disabled={disabled}
                        canEdit={canEdit}
                        stageItemOptions={stageItemOptions}
                        onToggleRequired={onToggleRequired}
                        onSaveReleaseConfig={onSaveReleaseConfig}
                        onDelete={onDeleteItem}
                        onContentUpdated={onRefreshContentReferences}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          {canEdit ? (
            <div className="space-y-3 border-t border-dashed border-[#d9e0e7] pt-4">
              {!showAddItem ? (
                <Button type="button" size="sm" variant="secondary" disabled={disabled} onClick={() => setShowAddItem(true)}>
                  <Plus className="h-4 w-4" />
                  Add Stage Item
                </Button>
              ) : (
                <div className="space-y-3 rounded-xl border border-dashed border-[#cfd8e3] bg-white p-4">
                  <p className="text-sm text-slate-600">
                    Open a picker to search and select one or more content or assessment references. Every selected reference is stored as a separate stage item.
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="secondary" disabled={disabled} onClick={() => setActivePicker("CONTENT")}>
                      <Plus className="h-4 w-4" />
                      Add Content
                    </Button>
                    {canCreateContent ? (
                      <Button type="button" variant="secondary" disabled={disabled} onClick={() => setInlineCreatorOpen(true)}>
                        <FileText className="h-4 w-4" />
                        Add Authored Content
                      </Button>
                    ) : null}
                    <Button type="button" variant="secondary" disabled={disabled} onClick={() => setActivePicker("ASSESSMENT")}>
                      <Plus className="h-4 w-4" />
                      Add Assessment
                    </Button>
                  </div>

                  {contentOptions.length === 0 && assessmentOptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No content or assessments are available yet for mapping into this stage.
                    </p>
                  ) : null}

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="secondary" disabled={disabled} onClick={() => setShowAddItem(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <CurriculumContentPickerDialog
        open={activePicker === "CONTENT"}
        onOpenChange={(open) => setActivePicker(open ? "CONTENT" : null)}
        courseId={courseId}
        items={contentOptions}
        folders={contentFolders}
        isLoading={isLoadingReferences}
        isSaving={disabled}
        canCreateContent={canCreateContent}
        existingContentIds={existingContentIds}
        onSubmit={async ({ contentIds, isRequired }) => {
          const ok = await onCreateItems(stage.id, {
            itemType: "CONTENT",
            contentIds,
            assessmentPoolIds: [],
            isRequired,
          });

          if (ok) {
            setShowAddItem(false);
          }

          return ok;
        }}
        onContentCreated={onRefreshContentReferences}
      />

      <CurriculumAssessmentPickerDialog
        open={activePicker === "ASSESSMENT"}
        onOpenChange={(open) => setActivePicker(open ? "ASSESSMENT" : null)}
        items={assessmentOptions}
        isLoading={isLoadingReferences}
        isSaving={disabled}
        onSubmit={async ({ assessmentPoolIds, isRequired }) => {
          const ok = await onCreateItems(stage.id, {
            itemType: "ASSESSMENT",
            contentIds: [],
            assessmentPoolIds,
            isRequired,
          });

          if (ok) {
            setShowAddItem(false);
          }

          return ok;
        }}
      />

      <CurriculumInlineContentCreator
        open={inlineCreatorOpen}
        onOpenChange={setInlineCreatorOpen}
        courseId={courseId}
        folders={contentFolders}
        stageId={stage.id}
        onComplete={async (contentId) => {
          const ok = await onCreateItems(stage.id, {
            itemType: "CONTENT",
            contentIds: [contentId],
            assessmentPoolIds: [],
            isRequired: false,
          });
          if (ok) {
            setShowAddItem(false);
          }
          return ok;
        }}
        onRefresh={onRefreshContentReferences}
        disabled={disabled}
      />
    </div>
  );
}

function SortableModuleCard({
  module,
  courseId,
  contentOptions,
  contentFolders,
  assessmentOptions,
  isLoadingReferences,
  disabled,
  canEdit,
  canCreateContent,
  stageItemOptions,
  existingContentIds,
  allModules,
  onSave,
  onDelete,
  onCreateStage,
  onSaveStage,
  onDeleteStage,
  onReorderStages,
  onCreateItems,
  onRefreshContentReferences,
  onToggleRequired,
  onSaveReleaseConfig,
  onDeleteItem,
  onReorderItems,
}: {
  module: CurriculumModuleSummary;
  courseId: string;
  contentOptions: ContentOption[];
  contentFolders: ContentFolderOption[];
  assessmentOptions: AssessmentOption[];
  isLoadingReferences: boolean;
  disabled: boolean;
  canEdit: boolean;
  canCreateContent: boolean;
  stageItemOptions: StageItemReferenceOption[];
  existingContentIds: string[];
  allModules: CurriculumModuleSummary[];
  onSave: (moduleId: string, input: ModuleSaveInput) => Promise<boolean>;
  onDelete: (moduleId: string) => Promise<boolean>;
  onCreateStage: (moduleId: string, input: { title: string; description: string }) => Promise<boolean>;
  onSaveStage: (stageId: string, input: StageSaveInput) => Promise<boolean>;
  onDeleteStage: (stageId: string) => Promise<boolean>;
  onReorderStages: (moduleId: string, stageIds: string[]) => Promise<void>;
  onCreateItems: (stageId: string, input: { itemType: CurriculumItemType; contentIds: string[]; assessmentPoolIds: string[]; isRequired: boolean }) => Promise<boolean>;
  onRefreshContentReferences: () => Promise<void>;
  onToggleRequired: (itemId: string, nextRequired: boolean) => Promise<boolean>;
  onSaveReleaseConfig: (itemId: string, releaseConfig: ReturnType<typeof buildReleaseConfigPayload>) => Promise<boolean>;
  onDeleteItem: (itemId: string) => Promise<boolean>;
  onReorderItems: (stageId: string, itemIds: string[]) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: module.id,
    disabled: disabled || !canEdit,
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [isEditing, setIsEditing] = useState(false);
  const [showAddStage, setShowAddStage] = useState(module.stageCount === 0);
  const [title, setTitle] = useState(module.title);
  const [description, setDescription] = useState(module.description ?? "");
  const [completionRule, setCompletionRule] = useState(module.completionRule === "ALL_REQUIRED" ? "ALL_ITEMS" : (module.completionRule ?? "ALL_ITEMS"));
  const [completionThreshold, setCompletionThreshold] = useState<string>(module.completionThreshold?.toString() ?? "");
  const [prerequisiteModuleId, setPrerequisiteModuleId] = useState<string>(module.prerequisiteModuleId ?? "");
  const [newStageTitle, setNewStageTitle] = useState("");
  const [newStageDescription, setNewStageDescription] = useState("");

  useEffect(() => {
    setTitle(module.title);
    setDescription(module.description ?? "");
    setCompletionRule(module.completionRule === "ALL_REQUIRED" ? "ALL_ITEMS" : (module.completionRule ?? "ALL_ITEMS"));
    setCompletionThreshold(module.completionThreshold?.toString() ?? "");
    setPrerequisiteModuleId(module.prerequisiteModuleId ?? "");
  }, [module.description, module.id, module.title, module.completionRule, module.completionThreshold, module.prerequisiteModuleId]);

  async function handleSaveModule() {
    const ok = await onSave(module.id, {
      title,
      description,
      completionRule,
      completionThreshold: completionThreshold ? Number(completionThreshold) : null,
      prerequisiteModuleId: prerequisiteModuleId || null,
    });
    if (ok) {
      setIsEditing(false);
    }
  }

  async function handleCreateModuleStage() {
    const ok = await onCreateStage(module.id, {
      title: newStageTitle,
      description: newStageDescription,
    });

    if (ok) {
      setNewStageTitle("");
      setNewStageDescription("");
      setShowAddStage(false);
    }
  }

  function handleStageDragEnd(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) {
      return;
    }

    const currentIds = module.stages.map((stage) => stage.id);
    const oldIndex = currentIds.indexOf(String(event.active.id));
    const newIndex = currentIds.indexOf(String(event.over.id));

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const orderedIds = arrayMove(currentIds, oldIndex, newIndex);
    void onReorderStages(module.id, orderedIds);
  }

  return (
    <Card
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-80 shadow-lg")}
    >
      <CardContent className="space-y-5 pt-6">
        <div className="flex items-start gap-3">
          <button
            type="button"
            className="mt-1 shrink-0 text-slate-400 transition-colors hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled || !canEdit}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-slate-900">{module.title}</h3>
                  <Badge variant="default">{module.stageCount} stages</Badge>
                  <Badge variant="info">{module.itemCount} items</Badge>
                </div>
                {module.description ? (
                  <p className="mt-1 text-sm text-slate-600">{module.description}</p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">No module notes yet.</p>
                )}
              </div>

              {canEdit ? (
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => setIsEditing((current) => !current)}>
                    {isEditing ? "Cancel" : "Edit"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    className="text-rose-600 hover:text-rose-700"
                    onClick={() => {
                      if (window.confirm(`Delete module \"${module.title}\" and all of its stages?`)) {
                        void onDelete(module.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              ) : null}
            </div>

            {isEditing ? (
              <div className="space-y-3 rounded-xl border border-dashed border-[#cfd8e3] bg-slate-50/70 p-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Module title</label>
                  <Input value={title} disabled={disabled} onChange={(event) => setTitle(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Module description</label>
                  <textarea
                    value={description}
                    disabled={disabled}
                    onChange={(event) => setDescription(event.target.value)}
                    className={textareaClassName}
                    placeholder="Describe the learning arc or objective for this module."
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Completion rule</label>
                    <select
                      value={completionRule}
                      disabled={disabled}
                      onChange={(event) => setCompletionRule(event.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="ALL_ITEMS">All stages completed</option>
                      <option value="PERCENTAGE">Percentage of stages</option>
                      <option value="MIN_ITEMS">Minimum number of stages</option>
                    </select>
                  </div>
                  {(completionRule === "PERCENTAGE" || completionRule === "MIN_ITEMS") ? (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        {completionRule === "PERCENTAGE" ? "Threshold (%)" : "Min stages"}
                      </label>
                      <Input
                        type="number"
                        min={completionRule === "PERCENTAGE" ? 1 : 1}
                        max={completionRule === "PERCENTAGE" ? 100 : undefined}
                        value={completionThreshold}
                        disabled={disabled}
                        onChange={(event) => setCompletionThreshold(event.target.value)}
                        placeholder={completionRule === "PERCENTAGE" ? "e.g. 80" : "e.g. 3"}
                      />
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Prerequisite module</label>
                    <select
                      value={prerequisiteModuleId}
                      disabled={disabled}
                      onChange={(event) => setPrerequisiteModuleId(event.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="">None</option>
                      {allModules
                        .filter((m) => m.id !== module.id)
                        .map((m) => (
                          <option key={m.id} value={m.id}>{m.title}</option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="secondary" disabled={disabled} onClick={() => {
                    setTitle(module.title);
                    setDescription(module.description ?? "");
                    setCompletionRule(module.completionRule === "ALL_REQUIRED" ? "ALL_ITEMS" : (module.completionRule ?? "ALL_ITEMS"));
                    setCompletionThreshold(module.completionThreshold?.toString() ?? "");
                    setPrerequisiteModuleId(module.prerequisiteModuleId ?? "");
                    setIsEditing(false);
                  }}>
                    Cancel
                  </Button>
                  <Button type="button" disabled={disabled || !title.trim()} onClick={() => void handleSaveModule()}>
                    Save Module
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="space-y-4">
              {module.stages.length === 0 ? (
                <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                  This module does not have any stages yet.
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleStageDragEnd}>
                  <SortableContext items={module.stages.map((stage) => stage.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-4">
                      {module.stages.map((stage) => (
                        <SortableStageCard
                          key={stage.id}
                          stage={stage}
                          courseId={courseId}
                          contentOptions={contentOptions}
                          contentFolders={contentFolders}
                          assessmentOptions={assessmentOptions}
                          isLoadingReferences={isLoadingReferences}
                          disabled={disabled}
                          canEdit={canEdit}
                          canCreateContent={canCreateContent}
                          stageItemOptions={stageItemOptions}
                          existingContentIds={existingContentIds}
                          allStages={module.stages}
                          onSave={onSaveStage}
                          onDelete={onDeleteStage}
                          onCreateItems={onCreateItems}
                          onRefreshContentReferences={onRefreshContentReferences}
                          onToggleRequired={onToggleRequired}
                          onSaveReleaseConfig={onSaveReleaseConfig}
                          onDeleteItem={onDeleteItem}
                          onReorderItems={onReorderItems}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>

            {canEdit ? (
              <div className="space-y-3 border-t border-dashed border-[#d9e0e7] pt-4">
                {!showAddStage ? (
                  <Button type="button" size="sm" variant="secondary" disabled={disabled} onClick={() => setShowAddStage(true)}>
                    <Plus className="h-4 w-4" />
                    Add Stage
                  </Button>
                ) : (
                  <div className="space-y-3 rounded-xl border border-dashed border-[#cfd8e3] bg-slate-50/70 p-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Stage title</label>
                      <Input value={newStageTitle} disabled={disabled} onChange={(event) => setNewStageTitle(event.target.value)} placeholder="e.g. Stage 1 · Foundations" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Stage description</label>
                      <textarea
                        value={newStageDescription}
                        disabled={disabled}
                        onChange={(event) => setNewStageDescription(event.target.value)}
                        className={textareaClassName}
                        placeholder="Outline what belongs in this stage."
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="secondary" disabled={disabled} onClick={() => {
                        setNewStageTitle("");
                        setNewStageDescription("");
                        setShowAddStage(false);
                      }}>
                        Cancel
                      </Button>
                      <Button type="button" disabled={disabled || !newStageTitle.trim()} onClick={() => void handleCreateModuleStage()}>
                        Add Stage
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CurriculumBatchMappingCard({
  batches,
  isLoading,
  disabled,
  canEdit,
  onToggle,
}: {
  batches: CurriculumBatchMapping[];
  isLoading: boolean;
  disabled: boolean;
  canEdit: boolean;
  onToggle: (batchId: string, nextMapped: boolean) => Promise<void>;
}) {
  const orderedBatches = [...batches].sort((left, right) => {
    if (left.hasEffectiveAccess !== right.hasEffectiveAccess) {
      return left.hasEffectiveAccess ? -1 : 1;
    }

    return new Date(right.startDate).getTime() - new Date(left.startDate).getTime();
  });

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          <p className="text-lg font-semibold text-slate-900">Batch mapping</p>
          <p className="text-sm text-muted-foreground">
            Published curricula are inherited automatically by every batch in the selected course. Batch mappings remain available for unpublished rollout planning.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : orderedBatches.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            No batches exist for programs under this course yet.
          </div>
        ) : (
          <div className="space-y-3">
            {orderedBatches.map((batch) => (
              <div key={batch.batchId} className="flex flex-col gap-3 rounded-xl border border-[#dde1e6] bg-white p-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{batch.batchName}</p>
                    <Badge variant={batch.hasEffectiveAccess ? "default" : "info"}>
                      {batch.hasEffectiveAccess ? assignmentSourceLabels[batch.assignmentSource] : "Available for mapping"}
                    </Badge>
                    <Badge variant="info">{batch.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {batch.batchCode} · {batch.programName}{batch.campus ? ` · ${batch.campus}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Starts {formatDateTime(batch.startDate)}
                    {batch.endDate ? ` · Ends ${formatDateTime(batch.endDate)}` : ""}
                  </p>
                  {batch.isMapped ? (
                    <p className="text-xs text-muted-foreground">
                      Assigned {batch.assignedAt ? formatDateTime(batch.assignedAt) : "recently"}
                      {batch.assignedByName ? ` by ${batch.assignedByName}` : ""}
                    </p>
                  ) : batch.isInheritedFromCourse ? (
                    <p className="text-xs text-muted-foreground">
                      This batch inherits the selected published curriculum automatically because it belongs to the same course.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      This batch can be batch-mapped because it belongs to the same course.
                    </p>
                  )}
                </div>

                {canEdit && batch.canRemoveBatchMapping ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={disabled}
                    onClick={() => {
                      void onToggle(batch.batchId, false);
                    }}
                  >
                    Remove Batch Mapping
                  </Button>
                ) : canEdit && batch.canAddBatchMapping ? (
                  <Button
                    type="button"
                    variant="default"
                    disabled={disabled}
                    onClick={() => {
                      void onToggle(batch.batchId, true);
                    }}
                  >
                    Add Batch Mapping
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CloneCurriculumDialog({
  open,
  onOpenChange,
  curriculumTitle,
  courses,
  defaultCourseId,
  disabled,
  onClone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  curriculumTitle: string;
  courses: CourseOption[];
  defaultCourseId: string;
  disabled: boolean;
  onClone: (title: string, targetCourseId: string) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [targetCourseId, setTargetCourseId] = useState(defaultCourseId);
  const [isCloning, setIsCloning] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(`${curriculumTitle} (Copy)`);
      setTargetCourseId(defaultCourseId);
    }
  }, [open, curriculumTitle, defaultCourseId]);

  async function handleSubmit() {
    if (!title.trim() || !targetCourseId) return;
    setIsCloning(true);
    try {
      await onClone(title.trim(), targetCourseId);
    } finally {
      setIsCloning(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Duplicate Curriculum</DialogTitle>
          <DialogDescription>Create a copy of &ldquo;{curriculumTitle}&rdquo; with all modules, stages, and items.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">New title</label>
            <Input value={title} disabled={isCloning || disabled} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Target course</label>
            <select
              value={targetCourseId}
              disabled={isCloning || disabled}
              onChange={(event) => setTargetCourseId(event.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {courses.map((course) => (
                <option key={course.id} value={course.id}>{course.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" disabled={isCloning} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={isCloning || disabled || !title.trim()} onClick={() => void handleSubmit()}>
              {isCloning ? "Cloning…" : "Duplicate"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Certificate Templates Section (for workspace popup) ──────────────────────

type CertTemplatePreview = {
  id: string;
  title: string;
  description: string | null;
  orientation: string;
  paperSize: string;
  isDefault: boolean;
  isActive: boolean;
  layoutJson: unknown[];
  backgroundColor: string | null;
  backgroundImageUrl: string | null;
  logoUrl: string | null;
  signatory1SignatureUrl: string | null;
  signatory2SignatureUrl: string | null;
};

type CertAutoIssueRule = {
  id: string;
  templateId: string;
  batchName: string;
  batchCode: string;
  programName: string;
  curriculumId: string | null;
  curriculumTitle: string | null;
  trigger: string;
  isActive: boolean;
};

const triggerLabels: Record<string, string> = {
  CURRICULUM_COMPLETION: "Curriculum Completion",
  ENROLLMENT_COMPLETION: "Enrollment Completion",
};

function CurriculumCertificateSection({
  courseId,
  curriculumId,
  curriculumTitle,
}: {
  courseId: string;
  curriculumId: string | null;
  curriculumTitle: string | null;
}) {
  const [templates, setCertTemplates] = useState<CertTemplatePreview[]>([]);
  const [rules, setRules] = useState<CertAutoIssueRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!courseId) return;
    setIsLoading(true);
    Promise.all([
      fetch(`/api/certifications/templates?courseId=${courseId}`)
        .then((r) => r.json())
        .then((res: { data?: CertTemplatePreview[] }) => setCertTemplates(res.data ?? [])),
      fetch(`/api/certifications/auto-issue-rules?courseId=${courseId}`)
        .then((r) => r.json())
        .then((res: { data?: CertAutoIssueRule[] }) => setRules(res.data ?? [])),
    ])
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [courseId]);

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
        <Award className="mb-3 h-10 w-10 text-slate-300" />
        <p className="text-sm font-medium text-slate-500">No certificate templates</p>
        <p className="mt-1 text-xs text-slate-400">
          Create templates in the{" "}
          <Link href="/certifications" className="text-[#0d3b84] underline">Certifications</Link>{" "}
          page.
        </p>
      </div>
    );
  }

  // Filter rules relevant to the current curriculum
  const relevantRules = curriculumId
    ? rules.filter((r) => r.curriculumId === curriculumId || r.curriculumId === null)
    : rules;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-slate-200 bg-slate-50/70">
          <CardContent className="py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Templates</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{templates.length}</p>
            <p className="mt-1 text-sm text-slate-500">Certificate templates for this course.</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-slate-50/70">
          <CardContent className="py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Auto-Issue Rules</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{relevantRules.length}</p>
            <p className="mt-1 text-sm text-slate-500">
              {curriculumId ? `Rules involving "${curriculumTitle}".` : "Total rules for this course."}
            </p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-slate-50/70">
          <CardContent className="py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Configure</p>
            <p className="mt-2 text-sm text-slate-700">
              Manage auto-issue rules in the dedicated configuration page.
            </p>
            <Link href="/certifications/issuance">
              <Button size="sm" variant="secondary" className="mt-2">
                <Award className="mr-1.5 h-3.5 w-3.5" />
                Auto-Issue Config
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Template preview grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((tpl) => {
          const tplRules = relevantRules.filter((r) => r.templateId === tpl.id);
          return (
            <Card key={tpl.id} className="overflow-hidden border-slate-200">
              <div className="border-b border-slate-100 bg-slate-50">
                <CertificatePreviewRenderer
                  layoutJson={tpl.layoutJson as import("@/services/certifications/types").CanvasElement[]}
                  orientation={tpl.orientation}
                  paperSize={tpl.paperSize}
                  backgroundColor={tpl.backgroundColor}
                  backgroundImageUrl={tpl.backgroundImageUrl}
                  logoUrl={tpl.logoUrl}
                  signatory1SignatureUrl={tpl.signatory1SignatureUrl}
                  signatory2SignatureUrl={tpl.signatory2SignatureUrl}
                />
              </div>
              <CardContent className="py-3">
                <div className="flex items-center gap-2">
                  <h4 className="truncate text-sm font-semibold text-slate-800">{tpl.title}</h4>
                  {tpl.isDefault && (
                    <Badge variant="default" className="shrink-0 text-[10px]">Default</Badge>
                  )}
                </div>
                {tpl.description && (
                  <p className="mt-0.5 truncate text-xs text-slate-400">{tpl.description}</p>
                )}
                {tplRules.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {tplRules.map((rule) => (
                      <div
                        key={rule.id}
                        className="flex items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1 text-[11px]"
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${rule.isActive ? "bg-emerald-500" : "bg-slate-300"}`} />
                        <span className="font-medium text-slate-700">{rule.batchName}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500">
                          {rule.curriculumTitle ?? triggerLabels[rule.trigger] ?? rule.trigger}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-slate-400">No auto-issue rules configured.</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function TemplateBrowserDialog({
  open,
  onOpenChange,
  disabled,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled: boolean;
  onCreate: (templateId: string, title: string) => Promise<void>;
}) {
  const [templates, setTemplates] = useState<CurriculumSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [title, setTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    setSelectedTemplateId("");
    setTitle("");
    fetch("/api/curriculum/templates")
      .then((response) => response.json())
      .then((json: ApiEnvelope<CurriculumSummary[]>) => {
        setTemplates(json.data ?? []);
      })
      .catch(() => {
        toast.error("Failed to load templates.");
      })
      .finally(() => setIsLoading(false));
  }, [open]);

  async function handleCreate() {
    if (!selectedTemplateId || !title.trim()) return;
    setIsCreating(true);
    try {
      await onCreate(selectedTemplateId, title.trim());
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create from Template</DialogTitle>
          <DialogDescription>Choose a saved template and create a new curriculum based on it.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No templates found. Save an existing curriculum as a template first.</p>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Template</label>
                <select
                  value={selectedTemplateId}
                  disabled={isCreating || disabled}
                  onChange={(event) => {
                    setSelectedTemplateId(event.target.value);
                    const selected = templates.find((t) => t.id === event.target.value);
                    if (selected) setTitle(selected.title.replace(/^\[Template\]\s*/i, ""));
                  }}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Select a template…</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.title} ({template.moduleCount} modules, {template.itemCount} items)
                    </option>
                  ))}
                </select>
              </div>
              {selectedTemplateId ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Curriculum title</label>
                  <Input value={title} disabled={isCreating || disabled} onChange={(event) => setTitle(event.target.value)} />
                </div>
              ) : null}
            </>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" disabled={isCreating} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={isCreating || disabled || !selectedTemplateId || !title.trim()} onClick={() => void handleCreate()}>
              {isCreating ? "Creating…" : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WorkspaceScreenPopup({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-none flex-col overflow-hidden p-0 sm:h-[calc(100vh-3rem)] sm:w-[calc(100vw-3rem)]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CurriculumBuilderPage() {
  const { can } = useRbac();
  const canCreateCurriculum = can("curriculum.create");
  const canEditCurriculum = can("curriculum.edit");
  const canCreateContent = can("course_content.create");

  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [curricula, setCurricula] = useState<CurriculumSummary[]>([]);
  const [selectedCurriculumId, setSelectedCurriculumId] = useState("");
  const [curriculum, setCurriculum] = useState<CurriculumDetail | null>(null);
  const [curriculumBatches, setCurriculumBatches] = useState<CurriculumBatchMapping[]>([]);
  const [contentOptions, setContentOptions] = useState<ContentOption[]>([]);
  const [contentFolders, setContentFolders] = useState<ContentFolderOption[]>([]);
  const [assessmentOptions, setAssessmentOptions] = useState<AssessmentOption[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [isLoadingCurricula, setIsLoadingCurricula] = useState(false);
  const [isLoadingCurriculum, setIsLoadingCurriculum] = useState(false);
  const [isLoadingCurriculumBatches, setIsLoadingCurriculumBatches] = useState(false);
  const [isLoadingReferences, setIsLoadingReferences] = useState(false);
  const [isCreatingCurriculum, setIsCreatingCurriculum] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [showAddCurriculumForm, setShowAddCurriculumForm] = useState(false);
  const [newCurriculumTitle, setNewCurriculumTitle] = useState("");
  const [newCurriculumDescription, setNewCurriculumDescription] = useState("");
  const [showAddModuleForm, setShowAddModuleForm] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [newModuleDescription, setNewModuleDescription] = useState("");
  const [activeWorkspacePopup, setActiveWorkspacePopup] = useState<WorkspacePopupView | null>(null);
  const [activeTab, setActiveTab] = useState<"builder" | "templates">("builder");
  const [showVariantsPanel, setShowVariantsPanel] = useState(true);
  const [milestoneTemplates, setMilestoneTemplates] = useState<CertTemplatePreview[]>([]);
  const [milestoneRules, setMilestoneRules] = useState<CertAutoIssueRule[]>([]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const selectedCourse = courses.find((course) => course.id === selectedCourseId) ?? null;
  const selectedCurriculumSummary = curricula.find((item) => item.id === selectedCurriculumId) ?? null;
  const isMutating = activeAction !== null;

  const existingContentIds = useMemo(() => {
    if (!curriculum) return [];
    const ids: string[] = [];
    for (const mod of curriculum.modules) {
      for (const stage of mod.stages) {
        for (const item of stage.items) {
          if (item.contentId) ids.push(item.contentId);
        }
      }
    }
    return ids;
  }, [curriculum]);

  const loadCourses = useCallback(async () => {
    setIsLoadingCourses(true);

    try {
      const response = await fetch("/api/courses", { cache: "no-store" });
      const data = await readApiData<CourseOption[]>(response, "Failed to load courses.");
      const activeCourses = data.filter((course) => course.isActive);
      const requestedCourseId = typeof window === "undefined"
        ? ""
        : new URLSearchParams(window.location.search).get("courseId")?.trim() ?? "";
      const preferredCourseId = activeCourses.some((course) => course.id === requestedCourseId)
        ? requestedCourseId
        : activeCourses[0]?.id ?? "";

      setCourses(activeCourses);
      setSelectedCourseId((current) => {
        if (current && activeCourses.some((course) => course.id === current)) {
          return current;
        }

        return preferredCourseId;
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load courses.");
    } finally {
      setIsLoadingCourses(false);
    }
  }, []);

  const loadCurricula = useCallback(async (courseId: string, preferredCurriculumId?: string) => {
    if (!courseId) {
      setCurricula([]);
      setSelectedCurriculumId("");
      return;
    }

    setIsLoadingCurricula(true);

    try {
      const response = await fetch(`/api/curriculum?courseId=${courseId}`, { cache: "no-store" });
      const data = await readApiData<CurriculumSummary[]>(response, "Failed to load curricula.");
      setCurricula(data ?? []);
      setSelectedCurriculumId((current) => {
        const nextId = preferredCurriculumId ?? current;

        if (nextId && data.some((item) => item.id === nextId)) {
          return nextId;
        }

        return data[0]?.id ?? "";
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load curricula.");
      setCurricula([]);
      setSelectedCurriculumId("");
    } finally {
      setIsLoadingCurricula(false);
    }
  }, []);

  const loadCurriculumDetail = useCallback(async (curriculumId: string) => {
    if (!curriculumId) {
      setCurriculum(null);
      return;
    }

    setIsLoadingCurriculum(true);

    try {
      const response = await fetch(`/api/curriculum/${curriculumId}`, { cache: "no-store" });
      const data = await readApiData<CurriculumDetail>(response, "Failed to load curriculum.");
      setCurriculum(data ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load curriculum.");
      setCurriculum(null);
    } finally {
      setIsLoadingCurriculum(false);
    }
  }, []);

  const loadCurriculumBatches = useCallback(async (curriculumId: string) => {
    if (!curriculumId) {
      setCurriculumBatches([]);
      return;
    }

    setIsLoadingCurriculumBatches(true);

    try {
      const response = await fetch(`/api/curriculum/batch-mappings?curriculumId=${curriculumId}`, { cache: "no-store" });
      const data = await readApiData<CurriculumBatchMapping[]>(response, "Failed to load curriculum batch mappings.");
      setCurriculumBatches(data ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load curriculum batch mappings.");
      setCurriculumBatches([]);
    } finally {
      setIsLoadingCurriculumBatches(false);
    }
  }, []);

  const loadReferences = useCallback(async (courseId: string) => {
    if (!courseId) {
      setContentOptions([]);
      setContentFolders([]);
      setAssessmentOptions([]);
      return;
    }

    setIsLoadingReferences(true);

    try {
      const [contentResult, folderResult, assessmentResult, courseAssessmentLinkResult] = await Promise.allSettled([
        fetch(`/api/course-content?courseId=${courseId}`, { cache: "no-store" }).then((response) => readApiData<Array<{
          id: string;
          title: string;
          status: string;
          folderId: string | null;
          folderName: string | null;
          contentType: string;
        }>>(response, "Failed to load course content.")),
        fetch(`/api/course-content-folders?courseId=${courseId}`, { cache: "no-store" }).then((response) => readApiData<Array<{
          id: string;
          name: string;
          contentCount: number;
        }>>(response, "Failed to load course content folders.")),
        fetch(`/api/assessment-pool`, { cache: "no-store" }).then((response) => readApiData<Array<{
          id: string;
          code: string;
          title: string;
          status: string;
          questionType: string;
          difficultyLevel: string;
        }>>(response, "Failed to load assessment pool.")),
        fetch(`/api/course-assessment-link?courseId=${encodeURIComponent(courseId)}`, { cache: "no-store" }).then((response) => readApiData<CourseAssessmentLinkOption[]>(response, "Failed to load course assessment assignments.")),
      ]);

      if (contentResult.status === "fulfilled") {
        setContentOptions(contentResult.value.filter((item) => item.status !== "ARCHIVED"));
      } else {
        setContentOptions([]);
        toast.error(contentResult.reason instanceof Error ? contentResult.reason.message : "Failed to load course content.");
      }

      if (folderResult.status === "fulfilled") {
        setContentFolders(folderResult.value);
      } else {
        setContentFolders([]);
        toast.error(folderResult.reason instanceof Error ? folderResult.reason.message : "Failed to load course content folders.");
      }

      if (assessmentResult.status === "fulfilled") {
        const linkedAssessmentPoolIds = courseAssessmentLinkResult.status === "fulfilled"
          ? new Set(courseAssessmentLinkResult.value.map((item) => item.assessmentPoolId))
          : null;

        setAssessmentOptions(
          assessmentResult.value
            .filter((item) => item.status !== "ARCHIVED")
            .map((item) => ({
              ...item,
              isLinkedToCourse: linkedAssessmentPoolIds ? linkedAssessmentPoolIds.has(item.id) : true,
            })),
        );
      } else {
        setAssessmentOptions([]);
        toast.error(assessmentResult.reason instanceof Error ? assessmentResult.reason.message : "Failed to load assessment pool.");
      }
    } finally {
      setIsLoadingReferences(false);
    }
  }, []);

  const refreshSelectedCurriculumWorkspace = useCallback(async (options?: {
    includeBatchMappings?: boolean;
    preferredCurriculumId?: string;
  }) => {
    if (!selectedCourseId) {
      return;
    }

    const nextCurriculumId = options?.preferredCurriculumId ?? selectedCurriculumId;
    const tasks: Promise<unknown>[] = [loadCurricula(selectedCourseId, nextCurriculumId)];

    if (nextCurriculumId) {
      tasks.push(loadCurriculumDetail(nextCurriculumId));

      if (options?.includeBatchMappings) {
        tasks.push(loadCurriculumBatches(nextCurriculumId));
      }
    }

    await Promise.all(tasks);
  }, [loadCurricula, loadCurriculumBatches, loadCurriculumDetail, selectedCourseId, selectedCurriculumId]);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    if (!selectedCourseId) {
      setCurricula([]);
      setSelectedCurriculumId("");
      setCurriculum(null);
      setCurriculumBatches([]);
      setContentOptions([]);
      setContentFolders([]);
      setAssessmentOptions([]);
      return;
    }

    void loadCurricula(selectedCourseId);
    void loadReferences(selectedCourseId);
  }, [loadCurricula, loadReferences, selectedCourseId]);

  // Load certificate data for the milestone preview
  useEffect(() => {
    if (!selectedCourseId) {
      setMilestoneTemplates([]);
      setMilestoneRules([]);
      return;
    }
    Promise.all([
      fetch(`/api/certifications/templates?courseId=${selectedCourseId}`)
        .then((r) => r.json())
        .then((res: { data?: CertTemplatePreview[] }) => setMilestoneTemplates(res.data ?? [])),
      fetch(`/api/certifications/auto-issue-rules?courseId=${selectedCourseId}`)
        .then((r) => r.json())
        .then((res: { data?: CertAutoIssueRule[] }) => setMilestoneRules(res.data ?? [])),
    ]).catch(() => {});
  }, [selectedCourseId]);

  useEffect(() => {
    if (!selectedCurriculumId) {
      setCurriculum(null);
      setCurriculumBatches([]);
      return;
    }

    void loadCurriculumDetail(selectedCurriculumId);
    void loadCurriculumBatches(selectedCurriculumId);
  }, [loadCurriculumBatches, loadCurriculumDetail, selectedCurriculumId]);

  useEffect(() => {
    if (!selectedCurriculumId) {
      setActiveWorkspacePopup((current) => (
        current === "SEQUENCE" || current === "BATCHES"
          ? null
          : current
      ));
    }
  }, [selectedCurriculumId]);

  useEffect(() => {
    if (!curriculum) {
      setShowAddModuleForm(false);
      return;
    }

    setShowAddModuleForm(curriculum.modules.length === 0);
  }, [curriculum]);

  useEffect(() => {
    if (curricula.length === 0 && canCreateCurriculum) {
      setShowAddCurriculumForm(true);
    }
  }, [canCreateCurriculum, curricula.length]);

  const refreshReferenceInventory = useCallback(async () => {
    if (!selectedCourseId) {
      return;
    }

    await loadReferences(selectedCourseId);
  }, [loadReferences, selectedCourseId]);

  async function handleCreateCurriculum() {
    if (!selectedCourse || !newCurriculumTitle.trim()) {
      return;
    }

    setIsCreatingCurriculum(true);

    try {
      const createdCurriculum = await sendJson<{ id: string }>(`/api/curriculum`, {
        method: "POST",
        body: JSON.stringify({
          courseId: selectedCourse.id,
          title: newCurriculumTitle,
          description: newCurriculumDescription,
        }),
      }, "Failed to create curriculum.");

      toast.success("Curriculum created.");
      setNewCurriculumTitle("");
      setNewCurriculumDescription("");
      setShowAddCurriculumForm(false);
      await refreshSelectedCurriculumWorkspace({
        includeBatchMappings: true,
        preferredCurriculumId: createdCurriculum.id,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create curriculum.");
    } finally {
      setIsCreatingCurriculum(false);
    }
  }

  async function handleSaveCurriculum(input: { title: string; description: string; status: string }) {
    if (!curriculum) {
      return false;
    }

    setActiveAction("curriculum:save");

    try {
      await sendJson(`/api/curriculum/${curriculum.id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }, "Failed to update curriculum.");

      toast.success("Curriculum updated.");
      await refreshSelectedCurriculumWorkspace({ preferredCurriculumId: curriculum.id });
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update curriculum.");
      return false;
    } finally {
      setActiveAction(null);
    }
  }

  async function handleCloneCurriculum(title: string, targetCourseId: string) {
    if (!curriculum) return;

    setActiveAction("curriculum:clone");
    try {
      const cloned = await sendJson<{ id: string }>("/api/curriculum/clone", {
        method: "POST",
        body: JSON.stringify({
          sourceCurriculumId: curriculum.id,
          targetCourseId,
          title,
        }),
      }, "Failed to clone curriculum.");

      toast.success("Curriculum duplicated.");
      setActiveWorkspacePopup(null);

      if (targetCourseId === selectedCourseId) {
        await refreshSelectedCurriculumWorkspace({ preferredCurriculumId: cloned.id });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Clone failed.");
    } finally {
      setActiveAction(null);
    }
  }

  async function handleSaveAsTemplate() {
    if (!curriculum) return;

    setActiveAction("curriculum:template");
    try {
      await sendJson("/api/curriculum/templates", {
        method: "POST",
        body: JSON.stringify({
          action: "save-as-template",
          curriculumId: curriculum.id,
        }),
      }, "Failed to save as template.");

      toast.success("Saved as template.");
      await refreshSelectedCurriculumWorkspace({ preferredCurriculumId: curriculum.id });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save as template.");
    } finally {
      setActiveAction(null);
    }
  }

  async function handleCreateFromTemplate(templateId: string, title: string) {
    if (!selectedCourseId) return;

    setActiveAction("curriculum:from-template");
    try {
      const created = await sendJson<{ id: string }>("/api/curriculum/templates", {
        method: "POST",
        body: JSON.stringify({
          action: "create-from-template",
          templateCurriculumId: templateId,
          targetCourseId: selectedCourseId,
          title,
        }),
      }, "Failed to create from template.");

      toast.success("Curriculum created from template.");
      setActiveWorkspacePopup(null);
      await refreshSelectedCurriculumWorkspace({ preferredCurriculumId: created.id });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create from template.");
    } finally {
      setActiveAction(null);
    }
  }

  async function handleCreateModule() {
    if (!curriculum) {
      return;
    }

    setActiveAction("module:create");

    try {
      await sendJson(`/api/curriculum/modules`, {
        method: "POST",
        body: JSON.stringify({
          curriculumId: curriculum.id,
          title: newModuleTitle,
          description: newModuleDescription,
        }),
      }, "Failed to create module.");

      toast.success("Module created.");
      setNewModuleTitle("");
      setNewModuleDescription("");
      setShowAddModuleForm(false);
      await refreshSelectedCurriculumWorkspace({ preferredCurriculumId: curriculum.id });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create module.");
    } finally {
      setActiveAction(null);
    }
  }

  async function handleSaveModule(moduleId: string, input: ModuleSaveInput) {
    setActiveAction(`module:${moduleId}:save`);

    try {
      await sendJson(`/api/curriculum/modules/${moduleId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }, "Failed to update module.");

      toast.success("Module updated.");
      await loadCurriculumDetail(selectedCurriculumId);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update module.");
      return false;
    } finally {
      setActiveAction(null);
    }
  }

  async function handleDeleteModule(moduleId: string) {
    setActiveAction(`module:${moduleId}:delete`);

    try {
      await sendJson(`/api/curriculum/modules/${moduleId}`, {
        method: "DELETE",
      }, "Failed to delete module.");

      toast.success("Module deleted.");
      await refreshSelectedCurriculumWorkspace({ preferredCurriculumId: selectedCurriculumId });
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete module.");
      return false;
    } finally {
      setActiveAction(null);
    }
  }

  async function handleCreateStage(moduleId: string, input: { title: string; description: string }) {
    setActiveAction(`module:${moduleId}:stage:create`);

    try {
      await sendJson(`/api/curriculum/stages`, {
        method: "POST",
        body: JSON.stringify({
          moduleId,
          title: input.title,
          description: input.description,
        }),
      }, "Failed to create stage.");

      toast.success("Stage created.");
      await refreshSelectedCurriculumWorkspace({ preferredCurriculumId: selectedCurriculumId });
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create stage.");
      return false;
    } finally {
      setActiveAction(null);
    }
  }

  async function handleSaveStage(stageId: string, input: StageSaveInput) {
    setActiveAction(`stage:${stageId}:save`);

    try {
      await sendJson(`/api/curriculum/stages/${stageId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }, "Failed to update stage.");

      toast.success("Stage updated.");
      await loadCurriculumDetail(selectedCurriculumId);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update stage.");
      return false;
    } finally {
      setActiveAction(null);
    }
  }

  async function handleDeleteStage(stageId: string) {
    setActiveAction(`stage:${stageId}:delete`);

    try {
      await sendJson(`/api/curriculum/stages/${stageId}`, {
        method: "DELETE",
      }, "Failed to delete stage.");

      toast.success("Stage deleted.");
      await refreshSelectedCurriculumWorkspace({ preferredCurriculumId: selectedCurriculumId });
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete stage.");
      return false;
    } finally {
      setActiveAction(null);
    }
  }

  async function handleCreateStageItems(stageId: string, input: { itemType: CurriculumItemType; contentIds: string[]; assessmentPoolIds: string[]; isRequired: boolean }) {
    setActiveAction(`stage:${stageId}:item:create`);

    try {
      const createdItems = await sendJson<Array<{ id: string }>>(`/api/curriculum/stage-items`, {
        method: "POST",
        body: JSON.stringify({
          stageId,
          itemType: input.itemType,
          contentIds: input.contentIds,
          assessmentPoolIds: input.assessmentPoolIds,
          isRequired: input.isRequired,
        }),
      }, "Failed to create stage item.");

      const createdCount = createdItems.length;
      toast.success(`${createdCount} ${input.itemType === "CONTENT" ? "content" : "assessment"} item${createdCount === 1 ? "" : "s"} added to stage.`);
      await refreshSelectedCurriculumWorkspace({ preferredCurriculumId: selectedCurriculumId });
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create stage item.");
      return false;
    } finally {
      setActiveAction(null);
    }
  }

  async function handleToggleItemRequired(itemId: string, nextRequired: boolean) {
    setActiveAction(`item:${itemId}:required`);

    try {
      await sendJson(`/api/curriculum/stage-items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ isRequired: nextRequired }),
      }, "Failed to update stage item.");

      await loadCurriculumDetail(selectedCurriculumId);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update stage item.");
      return false;
    } finally {
      setActiveAction(null);
    }
  }

  async function handleSaveStageItemReleaseConfig(itemId: string, releaseConfig: ReturnType<typeof buildReleaseConfigPayload>) {
    setActiveAction(`item:${itemId}:release`);

    try {
      await sendJson(`/api/curriculum/stage-items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ releaseConfig }),
      }, "Failed to update stage item release rules.");

      toast.success("Release rules updated.");
      await loadCurriculumDetail(selectedCurriculumId);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update stage item release rules.");
      return false;
    } finally {
      setActiveAction(null);
    }
  }

  async function handleDeleteStageItem(itemId: string) {
    setActiveAction(`item:${itemId}:delete`);

    try {
      await sendJson(`/api/curriculum/stage-items/${itemId}`, {
        method: "DELETE",
      }, "Failed to delete stage item.");

      toast.success("Stage item removed.");
      await refreshSelectedCurriculumWorkspace({ preferredCurriculumId: selectedCurriculumId });
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete stage item.");
      return false;
    } finally {
      setActiveAction(null);
    }
  }

  async function handleToggleBatchMapping(batchId: string, nextMapped: boolean) {
    if (!selectedCurriculumId) {
      return;
    }

    setActiveAction(`curriculum:${selectedCurriculumId}:batch:${batchId}:${nextMapped ? "assign" : "remove"}`);

    try {
      await sendJson(`/api/curriculum/batch-mappings`, {
        method: nextMapped ? "POST" : "DELETE",
        body: JSON.stringify({
          curriculumId: selectedCurriculumId,
          batchId,
        }),
      }, `Failed to ${nextMapped ? "assign curriculum to batch" : "remove curriculum from batch"}.`);

      toast.success(nextMapped ? "Curriculum mapped to batch." : "Curriculum removed from batch.");
      await refreshSelectedCurriculumWorkspace({
        includeBatchMappings: true,
        preferredCurriculumId: selectedCurriculumId,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${nextMapped ? "assign curriculum to batch" : "remove curriculum from batch"}.`);
    } finally {
      setActiveAction(null);
    }
  }

  async function handleReorderModules(moduleIds: string[]) {
    if (!curriculum) {
      return;
    }

    setCurriculum((current) => current ? {
      ...current,
      modules: reorderByIds(current.modules, moduleIds),
    } : current);

    setActiveAction("modules:reorder");

    try {
      await sendJson(`/api/curriculum/modules/reorder`, {
        method: "POST",
        body: JSON.stringify({ curriculumId: curriculum.id, moduleIds }),
      }, "Failed to reorder modules.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reorder modules.");
      await loadCurriculumDetail(curriculum.id);
    } finally {
      setActiveAction(null);
    }
  }

  async function handleReorderStages(moduleId: string, stageIds: string[]) {
    setCurriculum((current) => current ? {
      ...current,
      modules: current.modules.map((moduleRecord) => (
        moduleRecord.id === moduleId
          ? {
            ...moduleRecord,
            stages: reorderByIds(moduleRecord.stages, stageIds),
          }
          : moduleRecord
      )),
    } : current);

    setActiveAction(`module:${moduleId}:stages:reorder`);

    try {
      await sendJson(`/api/curriculum/stages/reorder`, {
        method: "POST",
        body: JSON.stringify({ moduleId, stageIds }),
      }, "Failed to reorder stages.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reorder stages.");
      await loadCurriculumDetail(selectedCurriculumId);
    } finally {
      setActiveAction(null);
    }
  }

  async function handleReorderStageItems(stageId: string, itemIds: string[]) {
    setCurriculum((current) => current ? {
      ...current,
      modules: current.modules.map((moduleRecord) => ({
        ...moduleRecord,
        stages: moduleRecord.stages.map((stage) => (
          stage.id === stageId
            ? {
              ...stage,
              items: reorderByIds(stage.items, itemIds),
            }
            : stage
        )),
      })),
    } : current);

    setActiveAction(`stage:${stageId}:items:reorder`);

    try {
      await sendJson(`/api/curriculum/stage-items/reorder`, {
        method: "POST",
        body: JSON.stringify({ stageId, itemIds }),
      }, "Failed to reorder stage items.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reorder stage items.");
      await loadCurriculumDetail(selectedCurriculumId);
    } finally {
      setActiveAction(null);
    }
  }

  function handleModuleDragEnd(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id || !curriculum) {
      return;
    }

    const currentIds = curriculum.modules.map((moduleRecord) => moduleRecord.id);
    const oldIndex = currentIds.indexOf(String(event.active.id));
    const newIndex = currentIds.indexOf(String(event.over.id));

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const orderedIds = arrayMove(currentIds, oldIndex, newIndex);
    void handleReorderModules(orderedIds);
  }

  const currentCurriculumTitle = selectedCurriculumSummary?.title ?? curriculum?.title ?? "No curriculum selected";
  const currentCurriculumStatus = curriculum?.status ?? selectedCurriculumSummary?.status ?? null;
  const currentModuleCount = curriculum?.moduleCount ?? selectedCurriculumSummary?.moduleCount ?? 0;
  const currentStageCount = curriculum?.stageCount ?? selectedCurriculumSummary?.stageCount ?? 0;
  const currentItemCount = curriculum?.itemCount ?? selectedCurriculumSummary?.itemCount ?? 0;
  const currentBatchCount = curriculum?.batchCount ?? selectedCurriculumSummary?.batchCount ?? 0;
  const mappedBatchCount = curriculumBatches.filter((batch) => batch.isMapped).length;
  const availableBatchCount = curriculumBatches.length - mappedBatchCount;
  const stageItemOptions = useMemo<StageItemReferenceOption[]>(() => {
    if (!curriculum) {
      return [];
    }

    return curriculum.modules.flatMap((moduleRecord) => (
      moduleRecord.stages.flatMap((stage) => (
        stage.items.map((item) => ({
          id: item.id,
          label: `${moduleRecord.title} / ${stage.title} / ${item.referenceTitle}`,
        }))
      ))
    ));
  }, [curriculum]);
  const activeSequenceTitle = selectedCurriculumId ? currentCurriculumTitle : "Select a curriculum variant";
  const activeSequenceSummary = !selectedCurriculumId
    ? "Choose a curriculum from the left to edit order, structure, and batch rollout."
    : isLoadingCurriculum && !curriculum
      ? "Loading the selected curriculum sequence..."
      : `${currentModuleCount} modules · ${currentStageCount} stages · ${currentItemCount} items · ${currentBatchCount} mapped batches`;
  const activeSequenceDescription = curriculum?.description
    || selectedCurriculumSummary?.description
    || "Use the details card below to define the intent, audience, and rollout status for this curriculum variant.";
  const canPreviewSequence = Boolean(curriculum) && !isLoadingCurriculum;

  function toggleWorkspacePopup(nextPopup: WorkspacePopupView) {
    setActiveWorkspacePopup((current) => current === nextPopup ? null : nextPopup);
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* ─── RIBBON TOOLBAR ─── */}
      <div className="sticky top-0 z-30 shrink-0 border-b border-slate-200 bg-white shadow-sm">
        <div className="flex items-stretch divide-x divide-slate-200">
          {/* ── Navigate Group ── */}
          <div className="flex flex-col justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-primary shadow-sm">
                <Workflow className="h-3.5 w-3.5" />
              </div>
              <h1 className="text-sm font-semibold tracking-tight text-slate-950">Curriculum Builder</h1>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <div className="inline-flex rounded-lg border border-[#dde1e6] bg-slate-50 p-0.5">
                <button
                  type="button"
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all",
                    activeTab === "builder"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                  onClick={() => setActiveTab("builder")}
                >
                  <Workflow className="mr-1 inline h-3 w-3" />
                  Builder
                </button>
                <button
                  type="button"
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all",
                    activeTab === "templates"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                  onClick={() => setActiveTab("templates")}
                >
                  <LayoutTemplate className="mr-1 inline h-3 w-3" />
                  Templates
                </button>
              </div>
              <Button
                type="button"
                size="sm"
                variant={showVariantsPanel ? "default" : "secondary"}
                className="h-7 rounded-lg px-2 text-[11px]"
                onClick={() => setShowVariantsPanel((current) => !current)}
                disabled={!selectedCourseId}
              >
                {showVariantsPanel ? <PanelLeftClose className="mr-1 h-3.5 w-3.5" /> : <PanelLeft className="mr-1 h-3.5 w-3.5" />}
                Variants
              </Button>
            </div>
            <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">Navigate</p>
          </div>

          {/* ── Scope Group ── */}
          <div className="flex flex-col justify-between px-4 py-2">
            <div className="space-y-1">
              <label className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">Course</label>
              <select
                value={selectedCourseId}
                onChange={(event) => {
                  setSelectedCourseId(event.target.value);
                  setCurricula([]);
                  setSelectedCurriculumId("");
                  setCurriculum(null);
                  setCurriculumBatches([]);
                  setActiveWorkspacePopup(null);
                  setShowAddCurriculumForm(false);
                  setShowAddModuleForm(false);
                  setNewModuleTitle("");
                  setNewModuleDescription("");
                }}
                className={cn(selectClassName, "h-8 min-w-[180px] text-xs")}
                disabled={isLoadingCourses || isMutating}
              >
                <option value="">Select a course...</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.name}</option>
                ))}
              </select>
            </div>
            <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">Scope</p>
          </div>

          {/* ── Workspace Group ── */}
          <div className="flex flex-col justify-between px-3 py-2">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                className="h-8 rounded-lg px-2.5 text-[11px]"
                variant={activeWorkspacePopup === "SEQUENCE" ? "default" : "secondary"}
                onClick={() => toggleWorkspacePopup("SEQUENCE")}
                disabled={!canPreviewSequence}
              >
                <Eye className="mr-1 h-3.5 w-3.5" />
                Sequence
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 rounded-lg px-2.5 text-[11px]"
                variant={activeWorkspacePopup === "REFERENCES" ? "default" : "secondary"}
                onClick={() => toggleWorkspacePopup("REFERENCES")}
                disabled={!selectedCourseId}
              >
                <BookOpen className="mr-1 h-3.5 w-3.5" />
                References
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 rounded-lg px-2.5 text-[11px]"
                variant={activeWorkspacePopup === "BATCHES" ? "default" : "secondary"}
                onClick={() => toggleWorkspacePopup("BATCHES")}
                disabled={!selectedCurriculumId}
              >
                <Boxes className="mr-1 h-3.5 w-3.5" />
                Batches
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 rounded-lg px-2.5 text-[11px]"
                variant={activeWorkspacePopup === "CERTIFICATES" ? "default" : "secondary"}
                onClick={() => toggleWorkspacePopup("CERTIFICATES")}
                disabled={!selectedCourseId}
              >
                <Award className="mr-1 h-3.5 w-3.5" />
                Certificates
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 rounded-lg px-2.5 text-[11px]"
                variant={activeWorkspacePopup === "HEALTH" ? "default" : "secondary"}
                onClick={() => toggleWorkspacePopup("HEALTH")}
                disabled={!selectedCurriculumId}
              >
                <HeartPulse className="mr-1 h-3.5 w-3.5" />
                Health
                {selectedCurriculumId ? <CurriculumHealthBadge curriculumId={selectedCurriculumId} className="ml-1" /> : null}
              </Button>
            </div>
            <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">Workspace</p>
          </div>

          {/* ── Actions Group (contextual) ── */}
          {canCreateCurriculum && selectedCurriculumId ? (
            <div className="flex flex-col justify-between px-3 py-2">
              <div className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" size="sm" variant="secondary" className="h-8 rounded-lg px-2.5 text-[11px]">
                      <MoreHorizontal className="mr-1 h-3.5 w-3.5" />
                      More
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-52">
                    <DropdownMenuItem onClick={() => setActiveWorkspacePopup("CLONE")}>
                      <Copy className="mr-2 h-4 w-4" />
                      Duplicate Curriculum
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void handleSaveAsTemplate()}>
                      <LayoutTemplate className="mr-2 h-4 w-4" />
                      Save as Template
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setActiveWorkspacePopup("TEMPLATES")}>
                      <LayoutTemplate className="mr-2 h-4 w-4" />
                      Browse Templates
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">Actions</p>
            </div>
          ) : null}
        </div>

        {/* ── Active Sequence Info Strip ── */}
        <div className="flex items-center gap-2.5 border-t border-slate-100 bg-slate-50/60 px-4 py-1.5">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Active</p>
          {selectedCurriculumId && currentCurriculumStatus ? (
            <Badge variant={statusVariant[currentCurriculumStatus] ?? "info"} className="text-[10px]">{currentCurriculumStatus}</Badge>
          ) : null}
          <span className="text-slate-300">·</span>
          <p className="truncate text-xs font-semibold text-slate-900">{activeSequenceTitle}</p>
          <span className="text-slate-300">·</span>
          <p className="flex-1 truncate text-[10px] text-slate-500">{activeSequenceSummary}</p>
        </div>
      </div>

      {/* ─── MAIN CONTENT (fills remaining viewport) ─── */}
      {activeTab === "builder" ? (
        <div className="flex min-h-0 flex-1">
          {/* ── Variants Sidebar ── */}
          {selectedCourseId ? (
            <div
              className={cn(
                "shrink-0 overflow-hidden border-r border-slate-200 bg-white transition-all duration-200",
                showVariantsPanel ? "w-[300px]" : "w-0"
              )}
            >
              <div className="flex h-full w-[300px] flex-col">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Curriculum Variants</p>
                    <p className="text-[10px] text-slate-500">Choose or create a variant.</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {canCreateCurriculum && !showAddCurriculumForm ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-7 rounded-lg px-2 text-[10px]"
                        disabled={isMutating}
                        onClick={() => setShowAddCurriculumForm(true)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 rounded-lg p-0"
                      onClick={() => setShowVariantsPanel(false)}
                    >
                      <PanelLeftClose className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                  <div className="space-y-3">
                    {canCreateCurriculum && showAddCurriculumForm ? (
                      <div className="space-y-2.5 rounded-xl border border-dashed border-[#cfd8e3] bg-slate-50/70 p-3">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Curriculum title</label>
                          <Input
                            value={newCurriculumTitle}
                            disabled={isCreatingCurriculum || isMutating}
                            onChange={(event) => setNewCurriculumTitle(event.target.value)}
                            placeholder="e.g. Fast-track Intake Curriculum"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Description</label>
                          <textarea
                            value={newCurriculumDescription}
                            disabled={isCreatingCurriculum || isMutating}
                            onChange={(event) => setNewCurriculumDescription(event.target.value)}
                            className={textareaClassName}
                            placeholder="Optional notes about who this curriculum is for or how it differs."
                          />
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            className="h-8 rounded-xl text-xs"
                            disabled={isCreatingCurriculum || isMutating}
                            onClick={() => {
                              setNewCurriculumTitle("");
                              setNewCurriculumDescription("");
                              setShowAddCurriculumForm(false);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            className="h-8 rounded-xl text-xs"
                            disabled={isCreatingCurriculum || isMutating || !newCurriculumTitle.trim()}
                            onClick={() => void handleCreateCurriculum()}
                          >
                            {isCreatingCurriculum ? "Creating…" : "Create"}
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {isLoadingCurricula ? (
                      <div className="space-y-3">
                        <Skeleton className="h-20 w-full rounded-xl" />
                        <Skeleton className="h-20 w-full rounded-xl" />
                        <Skeleton className="h-20 w-full rounded-xl" />
                      </div>
                    ) : curricula.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[#d9e0e7] bg-slate-50/70 p-5 text-xs text-slate-500">
                        No curricula exist for {selectedCourse?.name ?? "this course"} yet.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {curricula.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className={cn(
                              "w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
                              selectedCurriculumId === item.id
                                ? "border-primary bg-primary/5 shadow-sm"
                                : "border-[#dde1e6] bg-white hover:border-primary/40",
                            )}
                            onClick={() => setSelectedCurriculumId(item.id)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-slate-900">{item.title}</p>
                                <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-500">
                                  {item.description || "No description yet."}
                                </p>
                              </div>
                              <Badge variant={statusVariant[item.status] ?? "info"} className="shrink-0 text-[9px]">{item.status}</Badge>
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px] text-slate-500">
                              <span className="rounded-full bg-slate-100 px-1.5 py-0.5">{item.moduleCount} mod</span>
                              <span className="rounded-full bg-slate-100 px-1.5 py-0.5">{item.stageCount} stg</span>
                              <span className="rounded-full bg-slate-100 px-1.5 py-0.5">{item.itemCount} itm</span>
                              <span className="rounded-full bg-slate-100 px-1.5 py-0.5">{item.batchCount} bat</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* ── Main Builder Area ── */}
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-6 p-6">
              {!selectedCourseId ? (
                <div className="rounded-3xl border border-dashed border-[#d9e0e7] bg-white p-12 text-center text-sm text-slate-500 shadow-sm">
                  Select a course to begin building its curriculum workspace.
                </div>
              ) : !selectedCurriculumId ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
                    <div className="space-y-1">
                      <p className="text-base font-semibold">
                        {curricula.length === 0
                          ? `No curriculum yet for ${selectedCourse?.name ?? "this course"}`
                          : "Select a curriculum to continue"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {curricula.length === 0
                          ? "Create the first curriculum for this course, then build modules, stages, and batch mappings from there."
                          : "Choose one of the curricula on the left to edit its delivery sequence and required learning items."}
                      </p>
                    </div>
                    {!canCreateCurriculum && curricula.length === 0 ? (
                      <p className="text-sm text-muted-foreground">You can view curricula but do not currently have permission to create one.</p>
                    ) : null}
                  </CardContent>
                </Card>
              ) : isLoadingCurriculum ? (
                <div className="space-y-3">
                  <Skeleton className="h-36 w-full rounded-xl" />
                  <Skeleton className="h-28 w-full rounded-xl" />
                  <Skeleton className="h-96 w-full rounded-xl" />
                </div>
              ) : curriculum ? (
                <div className="space-y-6">
                  <Card className="overflow-hidden border-slate-200 bg-white/95">
                    <CardContent className="py-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-lg font-semibold text-slate-950">{currentCurriculumTitle}</p>
                            {currentCurriculumStatus ? <Badge variant={statusVariant[currentCurriculumStatus] ?? "info"}>{currentCurriculumStatus}</Badge> : null}
                          </div>
                          <p className="max-w-3xl text-sm leading-6 text-slate-600">{activeSequenceDescription}</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                          <Badge variant="info">Modules: {currentModuleCount}</Badge>
                          <Badge variant="info">Stages: {currentStageCount}</Badge>
                          <Badge variant="info">Items: {currentItemCount}</Badge>
                          <Badge variant="info">Mapped Batches: {currentBatchCount}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <CurriculumMetaEditor
                    curriculum={curriculum}
                    disabled={isMutating}
                    canEdit={canEditCurriculum}
                    onSave={handleSaveCurriculum}
                  />

                  <Card>
                    <CardHeader>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <CardTitle>Module Sequence</CardTitle>
                          <CardDescription>
                            Drag modules, then stages, then items within a stage to persist the delivery order.
                          </CardDescription>
                        </div>
                        {canEditCurriculum && !showAddModuleForm ? (
                          <Button type="button" variant="secondary" disabled={isMutating} onClick={() => setShowAddModuleForm(true)}>
                            <Plus className="h-4 w-4" />
                            Add Module
                          </Button>
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      {canEditCurriculum && showAddModuleForm ? (
                        <div className="space-y-3 rounded-xl border border-dashed border-[#cfd8e3] bg-slate-50/70 p-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Module title</label>
                            <Input value={newModuleTitle} disabled={isMutating} onChange={(event) => setNewModuleTitle(event.target.value)} placeholder="e.g. Module 1 · Foundations" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Module description</label>
                            <textarea
                              value={newModuleDescription}
                              disabled={isMutating}
                              onChange={(event) => setNewModuleDescription(event.target.value)}
                              className={textareaClassName}
                              placeholder="Summarize the focus of this module."
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="secondary" disabled={isMutating} onClick={() => {
                              setNewModuleTitle("");
                              setNewModuleDescription("");
                              setShowAddModuleForm(false);
                            }}>
                              Cancel
                            </Button>
                            <Button type="button" disabled={isMutating || !newModuleTitle.trim()} onClick={() => void handleCreateModule()}>
                              Add Module
                            </Button>
                          </div>
                        </div>
                      ) : null}

                      {curriculum.modules.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-[#d9e0e7] bg-slate-50/70 p-8 text-center text-sm text-slate-500">
                          Add your first module to begin shaping this curriculum.
                        </div>
                      ) : (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleModuleDragEnd}>
                          <SortableContext items={curriculum.modules.map((moduleRecord) => moduleRecord.id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-4">
                              {curriculum.modules.map((moduleRecord) => (
                                <SortableModuleCard
                                  key={moduleRecord.id}
                                  module={moduleRecord}
                                  courseId={selectedCourseId}
                                  contentOptions={contentOptions}
                                  contentFolders={contentFolders}
                                  assessmentOptions={assessmentOptions}
                                  isLoadingReferences={isLoadingReferences}
                                  disabled={isMutating}
                                  canEdit={canEditCurriculum}
                                  canCreateContent={canCreateContent}
                                  stageItemOptions={stageItemOptions}
                                  existingContentIds={existingContentIds}
                                  allModules={curriculum.modules}
                                  onSave={handleSaveModule}
                                  onDelete={handleDeleteModule}
                                  onCreateStage={handleCreateStage}
                                  onSaveStage={handleSaveStage}
                                  onDeleteStage={handleDeleteStage}
                                  onReorderStages={handleReorderStages}
                                  onCreateItems={handleCreateStageItems}
                                  onRefreshContentReferences={refreshReferenceInventory}
                                  onToggleRequired={handleToggleItemRequired}
                                  onSaveReleaseConfig={handleSaveStageItemReleaseConfig}
                                  onDeleteItem={handleDeleteStageItem}
                                  onReorderItems={handleReorderStageItems}
                                />
                              ))}
                            </div>
                          </SortableContext>
                        </DndContext>
                      )}
                    </CardContent>
                  </Card>

                  {/* Certificate completion milestone */}
                  <CurriculumCertificateMilestone
                    templates={milestoneTemplates}
                    rules={milestoneRules}
                    curriculumId={curriculum.id}
                    curriculumTitle={curriculum.title}
                  />
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
                    <div className="space-y-1">
                      <p className="text-base font-semibold">Unable to load the selected curriculum</p>
                      <p className="text-sm text-muted-foreground">
                        Try selecting the curriculum again from the list on the left.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          <CurriculumTemplatesTab
            courses={courses}
            selectedCourseId={selectedCourseId}
            onCreateFromTemplate={() => {
              setActiveTab("builder");
              if (selectedCourseId) {
                loadCurricula(selectedCourseId);
              }
            }}
            disabled={isMutating}
          />
        </div>
      )}

      <WorkspaceScreenPopup
        open={activeWorkspacePopup === "SEQUENCE"}
        onOpenChange={(open) => setActiveWorkspacePopup(open ? "SEQUENCE" : null)}
        title="Curriculum Sequence Preview"
        description="Review the current module, stage, and item ordering in a read-only sequence view."
      >
        {curriculum ? (
          <CurriculumHierarchyView curriculum={curriculum} />
        ) : (
          <div className="rounded-2xl border border-dashed border-[#d9e0e7] bg-slate-50/70 p-8 text-center text-sm text-slate-500">
            Select a curriculum variant to preview its sequence.
          </div>
        )}
      </WorkspaceScreenPopup>

      <WorkspaceScreenPopup
        open={activeWorkspacePopup === "REFERENCES"}
        onOpenChange={(open) => setActiveWorkspacePopup(open ? "REFERENCES" : null)}
        title="Reference Inventory"
        description="Review the course-scoped content and assessment references available for curriculum composition."
      >
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="border-slate-200 bg-slate-50/70">
              <CardContent className="py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Content Library</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{isLoadingReferences ? "..." : contentOptions.length}</p>
                <p className="mt-1 text-sm text-slate-500">Active content items available to map into stages.</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 bg-slate-50/70">
              <CardContent className="py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Assessment Pool</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{isLoadingReferences ? "..." : assessmentOptions.length}</p>
                <p className="mt-1 text-sm text-slate-500">Reusable assessments available for this course.</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 bg-slate-50/70">
              <CardContent className="py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Mapping Readiness</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{selectedCurriculumId ? currentBatchCount : "-"}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedCurriculumId
                    ? "Batches currently linked to the active curriculum."
                    : "Select a curriculum variant to review rollout readiness."}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Content Library Items</CardTitle>
                <CardDescription>Course-ready content that can be attached to stages in the sequence.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingReferences ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full rounded-xl" />
                    <Skeleton className="h-16 w-full rounded-xl" />
                    <Skeleton className="h-16 w-full rounded-xl" />
                  </div>
                ) : contentOptions.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                    No active content references are available for this course yet.
                  </div>
                ) : (
                  <div className="max-h-[52vh] space-y-3 overflow-y-auto pr-1">
                    {contentOptions.map((item) => (
                      <div key={item.id} className="rounded-xl border border-[#dde1e6] bg-white p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                          <Badge variant="info">{item.contentType}</Badge>
                          <Badge variant={statusVariant[item.status] ?? "info"}>{item.status}</Badge>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">{item.folderName ? `Folder: ${item.folderName}` : "Library root"}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Assessment References</CardTitle>
                <CardDescription>Published or draft assessments available to sequence into stages.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingReferences ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full rounded-xl" />
                    <Skeleton className="h-16 w-full rounded-xl" />
                    <Skeleton className="h-16 w-full rounded-xl" />
                  </div>
                ) : assessmentOptions.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                    No reusable assessments are available for this course yet.
                  </div>
                ) : (
                  <div className="max-h-[52vh] space-y-3 overflow-y-auto pr-1">
                    {assessmentOptions.map((item) => (
                      <div key={item.id} className="rounded-xl border border-[#dde1e6] bg-white p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                          <Badge variant="info">{QUESTION_TYPE_LABELS[item.questionType as keyof typeof QUESTION_TYPE_LABELS] ?? item.questionType}</Badge>
                          <Badge variant="info">{item.difficultyLevel}</Badge>
                          <Badge variant={statusVariant[item.status] ?? "info"}>{item.status}</Badge>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">Code: {item.code}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </WorkspaceScreenPopup>

      <WorkspaceScreenPopup
        open={activeWorkspacePopup === "BATCHES"}
        onOpenChange={(open) => setActiveWorkspacePopup(open ? "BATCHES" : null)}
        title="Batch Mapping"
        description="Assign or remove the active curriculum for eligible batches without compressing the sequence editor."
      >
        {selectedCurriculumId ? (
          <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="border-slate-200 bg-slate-50/70">
                <CardContent className="py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Active Curriculum</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">{currentCurriculumTitle}</p>
                  <p className="mt-1 text-sm text-slate-500">Current status: {currentCurriculumStatus ?? "Not selected"}</p>
                </CardContent>
              </Card>
              <Card className="border-slate-200 bg-slate-50/70">
                <CardContent className="py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Mapped Batches</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{isLoadingCurriculumBatches ? "..." : mappedBatchCount}</p>
                  <p className="mt-1 text-sm text-slate-500">Batches currently assigned to this curriculum.</p>
                </CardContent>
              </Card>
              <Card className="border-slate-200 bg-slate-50/70">
                <CardContent className="py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Available Batches</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{isLoadingCurriculumBatches ? "..." : availableBatchCount}</p>
                  <p className="mt-1 text-sm text-slate-500">Eligible batches that can still receive this curriculum.</p>
                </CardContent>
              </Card>
            </div>

            <CurriculumBatchMappingCard
              batches={curriculumBatches}
              isLoading={isLoadingCurriculumBatches}
              disabled={isMutating}
              canEdit={canEditCurriculum}
              onToggle={handleToggleBatchMapping}
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#d9e0e7] bg-slate-50/70 p-8 text-center text-sm text-slate-500">
            Select a curriculum variant to review which batches can receive it.
          </div>
        )}
      </WorkspaceScreenPopup>

      <WorkspaceScreenPopup
        open={activeWorkspacePopup === "CERTIFICATES"}
        onOpenChange={(open) => setActiveWorkspacePopup(open ? "CERTIFICATES" : null)}
        title="Certificate Templates"
        description="View certificate templates for this course and configure auto-issue rules."
      >
        {selectedCourseId ? (
          <CurriculumCertificateSection
            courseId={selectedCourseId}
            curriculumId={selectedCurriculumId}
            curriculumTitle={currentCurriculumTitle}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-[#d9e0e7] bg-slate-50/70 p-8 text-center text-sm text-slate-500">
            Select a course to view its certificate templates.
          </div>
        )}
      </WorkspaceScreenPopup>

      <WorkspaceScreenPopup
        open={activeWorkspacePopup === "HEALTH"}
        onOpenChange={(open) => setActiveWorkspacePopup(open ? "HEALTH" : null)}
        title="Curriculum Health Check"
        description="Review structural issues, missing references, and configuration problems in the active curriculum."
      >
        {selectedCurriculumId ? (
          <CurriculumHealthReport curriculumId={selectedCurriculumId} />
        ) : (
          <div className="rounded-2xl border border-dashed border-[#d9e0e7] bg-slate-50/70 p-8 text-center text-sm text-slate-500">
            Select a curriculum variant to run its health check.
          </div>
        )}
      </WorkspaceScreenPopup>

      <CloneCurriculumDialog
        open={activeWorkspacePopup === "CLONE"}
        onOpenChange={(open) => setActiveWorkspacePopup(open ? "CLONE" : null)}
        curriculumTitle={curriculum?.title ?? ""}
        courses={courses}
        defaultCourseId={selectedCourseId}
        disabled={isMutating}
        onClone={handleCloneCurriculum}
      />

      <TemplateBrowserDialog
        open={activeWorkspacePopup === "TEMPLATES"}
        onOpenChange={(open) => setActiveWorkspacePopup(open ? "TEMPLATES" : null)}
        disabled={isMutating}
        onCreate={handleCreateFromTemplate}
      />
    </div>
  );
}