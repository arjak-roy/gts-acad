"use client";

import { useCallback, useEffect, useState } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BookOpen, Boxes, GripVertical, Plus, Save, Trash2, Workflow } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
  folderName: string | null;
  contentType: string;
};

type AssessmentOption = {
  id: string;
  code: string;
  title: string;
  status: string;
  questionType: string;
  difficultyLevel: string;
};

type CurriculumItemType = "CONTENT" | "ASSESSMENT";

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
};

type CurriculumStageSummary = {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  itemCount: number;
  items: CurriculumStageItemDetail[];
};

type CurriculumModuleSummary = {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
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

type CurriculumSummary = {
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
  assignedAt: string | null;
  assignedByName: string | null;
};

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

const questionTypeLabels: Record<string, string> = {
  MCQ: "Multiple Choice",
  NUMERIC: "Numeric",
  ESSAY: "Essay",
  FILL_IN_THE_BLANK: "Fill in the Blank",
  MULTI_INPUT_REASONING: "Multi-Input Reasoning",
  TWO_PART_ANALYSIS: "Two-Part Analysis",
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
  disabled,
  canEdit,
  onToggleRequired,
  onDelete,
}: {
  item: CurriculumStageItemDetail;
  disabled: boolean;
  canEdit: boolean;
  onToggleRequired: (itemId: string, nextRequired: boolean) => Promise<boolean>;
  onDelete: (itemId: string) => Promise<boolean>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: disabled || !canEdit,
  });

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

          {item.referenceDescription ? (
            <p className="text-sm text-slate-600">{item.referenceDescription}</p>
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
    </div>
  );
}

function SortableStageCard({
  stage,
  contentOptions,
  assessmentOptions,
  disabled,
  canEdit,
  onSave,
  onDelete,
  onCreateItem,
  onToggleRequired,
  onDeleteItem,
  onReorderItems,
}: {
  stage: CurriculumStageSummary;
  contentOptions: ContentOption[];
  assessmentOptions: AssessmentOption[];
  disabled: boolean;
  canEdit: boolean;
  onSave: (stageId: string, input: { title: string; description: string }) => Promise<boolean>;
  onDelete: (stageId: string) => Promise<boolean>;
  onCreateItem: (stageId: string, input: { itemType: CurriculumItemType; contentId: string | null; assessmentPoolId: string | null; isRequired: boolean }) => Promise<boolean>;
  onToggleRequired: (itemId: string, nextRequired: boolean) => Promise<boolean>;
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
  const [title, setTitle] = useState(stage.title);
  const [description, setDescription] = useState(stage.description ?? "");
  const [itemType, setItemType] = useState<CurriculumItemType>("CONTENT");
  const [referenceId, setReferenceId] = useState("");
  const [isRequired, setIsRequired] = useState(false);

  useEffect(() => {
    setTitle(stage.title);
    setDescription(stage.description ?? "");
  }, [stage.description, stage.id, stage.title]);

  useEffect(() => {
    setReferenceId("");
  }, [itemType, stage.id]);

  const referenceOptions = itemType === "CONTENT" ? contentOptions : assessmentOptions;

  async function handleSaveStage() {
    const ok = await onSave(stage.id, { title, description });
    if (ok) {
      setIsEditing(false);
    }
  }

  async function handleCreateStageItem() {
    if (!referenceId) {
      return;
    }

    const ok = await onCreateItem(stage.id, {
      itemType,
      contentId: itemType === "CONTENT" ? referenceId : null,
      assessmentPoolId: itemType === "ASSESSMENT" ? referenceId : null,
      isRequired,
    });

    if (ok) {
      setReferenceId("");
      setIsRequired(false);
      setShowAddItem(false);
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
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" disabled={disabled} onClick={() => {
                  setTitle(stage.title);
                  setDescription(stage.description ?? "");
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
                        disabled={disabled}
                        canEdit={canEdit}
                        onToggleRequired={onToggleRequired}
                        onDelete={onDeleteItem}
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
                  <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Item type</label>
                      <select value={itemType} disabled={disabled} onChange={(event) => setItemType(event.target.value as CurriculumItemType)} className={selectClassName}>
                        <option value="CONTENT">Content</option>
                        <option value="ASSESSMENT">Assessment</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Reference</label>
                      <select value={referenceId} disabled={disabled || referenceOptions.length === 0} onChange={(event) => setReferenceId(event.target.value)} className={selectClassName}>
                        <option value="">Select {itemType === "CONTENT" ? "content" : "assessment"}…</option>
                        {itemType === "CONTENT"
                          ? contentOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {`${option.title}${option.folderName ? ` · ${option.folderName}` : ""}`}
                            </option>
                          ))
                          : assessmentOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {`${option.title} · ${option.code}`}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Checkbox checked={isRequired} disabled={disabled} onCheckedChange={(checked) => setIsRequired(checked === true)} />
                    Make this item required for stage completion
                  </label>

                  {referenceOptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No {itemType === "CONTENT" ? "content library items" : "assessment pool items"} are available for this course yet.
                    </p>
                  ) : null}

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="secondary" disabled={disabled} onClick={() => {
                      setReferenceId("");
                      setIsRequired(false);
                      setShowAddItem(false);
                    }}>
                      Cancel
                    </Button>
                    <Button type="button" disabled={disabled || !referenceId} onClick={() => void handleCreateStageItem()}>
                      Add Item
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SortableModuleCard({
  module,
  contentOptions,
  assessmentOptions,
  disabled,
  canEdit,
  onSave,
  onDelete,
  onCreateStage,
  onSaveStage,
  onDeleteStage,
  onReorderStages,
  onCreateItem,
  onToggleRequired,
  onDeleteItem,
  onReorderItems,
}: {
  module: CurriculumModuleSummary;
  contentOptions: ContentOption[];
  assessmentOptions: AssessmentOption[];
  disabled: boolean;
  canEdit: boolean;
  onSave: (moduleId: string, input: { title: string; description: string }) => Promise<boolean>;
  onDelete: (moduleId: string) => Promise<boolean>;
  onCreateStage: (moduleId: string, input: { title: string; description: string }) => Promise<boolean>;
  onSaveStage: (stageId: string, input: { title: string; description: string }) => Promise<boolean>;
  onDeleteStage: (stageId: string) => Promise<boolean>;
  onReorderStages: (moduleId: string, stageIds: string[]) => Promise<void>;
  onCreateItem: (stageId: string, input: { itemType: CurriculumItemType; contentId: string | null; assessmentPoolId: string | null; isRequired: boolean }) => Promise<boolean>;
  onToggleRequired: (itemId: string, nextRequired: boolean) => Promise<boolean>;
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
  const [newStageTitle, setNewStageTitle] = useState("");
  const [newStageDescription, setNewStageDescription] = useState("");

  useEffect(() => {
    setTitle(module.title);
    setDescription(module.description ?? "");
  }, [module.description, module.id, module.title]);

  async function handleSaveModule() {
    const ok = await onSave(module.id, { title, description });
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
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="secondary" disabled={disabled} onClick={() => {
                    setTitle(module.title);
                    setDescription(module.description ?? "");
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
                          contentOptions={contentOptions}
                          assessmentOptions={assessmentOptions}
                          disabled={disabled}
                          canEdit={canEdit}
                          onSave={onSaveStage}
                          onDelete={onDeleteStage}
                          onCreateItem={onCreateItem}
                          onToggleRequired={onToggleRequired}
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
    if (left.isMapped !== right.isMapped) {
      return left.isMapped ? -1 : 1;
    }

    return new Date(right.startDate).getTime() - new Date(left.startDate).getTime();
  });

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          <p className="text-lg font-semibold text-slate-900">Batch mapping</p>
          <p className="text-sm text-muted-foreground">
            Assign this curriculum to batches whose program belongs to the selected course.
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
                    <Badge variant={batch.isMapped ? "default" : "info"}>
                      {batch.isMapped ? "Mapped" : "Available"}
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
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      This batch can use the selected curriculum because it belongs to the same course.
                    </p>
                  )}
                </div>

                {canEdit ? (
                  <Button
                    type="button"
                    variant={batch.isMapped ? "secondary" : "default"}
                    disabled={disabled}
                    onClick={() => {
                      void onToggle(batch.batchId, !batch.isMapped);
                    }}
                  >
                    {batch.isMapped ? "Remove Mapping" : "Assign Curriculum"}
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

export default function CurriculumBuilderPage() {
  const { can } = useRbac();
  const canCreateCurriculum = can("curriculum.create");
  const canEditCurriculum = can("curriculum.edit");

  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [curricula, setCurricula] = useState<CurriculumSummary[]>([]);
  const [selectedCurriculumId, setSelectedCurriculumId] = useState("");
  const [curriculum, setCurriculum] = useState<CurriculumDetail | null>(null);
  const [curriculumBatches, setCurriculumBatches] = useState<CurriculumBatchMapping[]>([]);
  const [contentOptions, setContentOptions] = useState<ContentOption[]>([]);
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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const selectedCourse = courses.find((course) => course.id === selectedCourseId) ?? null;
  const selectedCurriculumSummary = curricula.find((item) => item.id === selectedCurriculumId) ?? null;
  const isMutating = activeAction !== null;

  const loadCourses = useCallback(async () => {
    setIsLoadingCourses(true);

    try {
      const response = await fetch("/api/courses", { cache: "no-store" });
      const data = await readApiData<CourseOption[]>(response, "Failed to load courses.");
      const activeCourses = data.filter((course) => course.isActive);

      setCourses(activeCourses);
      if (activeCourses.length > 0 && !selectedCourseId) {
        setSelectedCourseId(activeCourses[0].id);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load courses.");
    } finally {
      setIsLoadingCourses(false);
    }
  }, [selectedCourseId]);

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
      setAssessmentOptions([]);
      return;
    }

    setIsLoadingReferences(true);

    try {
      const [contentResult, assessmentResult] = await Promise.allSettled([
        fetch(`/api/course-content?courseId=${courseId}`, { cache: "no-store" }).then((response) => readApiData<Array<{
          id: string;
          title: string;
          status: string;
          folderName: string | null;
          contentType: string;
        }>>(response, "Failed to load course content.")),
        fetch(`/api/assessment-pool?courseId=${courseId}`, { cache: "no-store" }).then((response) => readApiData<Array<{
          id: string;
          code: string;
          title: string;
          status: string;
          questionType: string;
          difficultyLevel: string;
        }>>(response, "Failed to load assessment pool.")),
      ]);

      if (contentResult.status === "fulfilled") {
        setContentOptions(contentResult.value.filter((item) => item.status !== "ARCHIVED"));
      } else {
        setContentOptions([]);
        toast.error(contentResult.reason instanceof Error ? contentResult.reason.message : "Failed to load course content.");
      }

      if (assessmentResult.status === "fulfilled") {
        setAssessmentOptions(assessmentResult.value.filter((item) => item.status !== "ARCHIVED"));
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
      setAssessmentOptions([]);
      return;
    }

    void loadCurricula(selectedCourseId);
    void loadReferences(selectedCourseId);
  }, [loadCurricula, loadReferences, selectedCourseId]);

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

  async function handleSaveModule(moduleId: string, input: { title: string; description: string }) {
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

  async function handleSaveStage(stageId: string, input: { title: string; description: string }) {
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

  async function handleCreateStageItem(stageId: string, input: { itemType: CurriculumItemType; contentId: string | null; assessmentPoolId: string | null; isRequired: boolean }) {
    setActiveAction(`stage:${stageId}:item:create`);

    try {
      await sendJson(`/api/curriculum/stage-items`, {
        method: "POST",
        body: JSON.stringify({
          stageId,
          itemType: input.itemType,
          contentId: input.contentId,
          assessmentPoolId: input.assessmentPoolId,
          isRequired: input.isRequired,
        }),
      }, "Failed to create stage item.");

      toast.success(`${input.itemType === "CONTENT" ? "Content" : "Assessment"} item added to stage.`);
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

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-slate-200 bg-[linear-gradient(135deg,_#ffffff_0%,_#f8fbff_50%,_#edf4ff_100%)]">
        <CardContent className="pt-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-5">
              <div className="space-y-3">
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Curriculum Builder</p>
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-white text-primary shadow-sm">
                    <Workflow className="h-6 w-6" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Curriculum Workspace</h1>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                      Build multiple curriculum variants per course, shape delivery order with drag-and-drop, and keep batch mapping visible alongside the structure being edited.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Course</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{selectedCourse?.name ?? "Select a course"}</p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Curricula</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{isLoadingCurricula ? "…" : curricula.length}</p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Content Sources</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{isLoadingReferences ? "…" : contentOptions.length}</p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Assessments</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{isLoadingReferences ? "…" : assessmentOptions.length}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">Builder Context</p>
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Course</label>
                  <select
                    value={selectedCourseId}
                    onChange={(event) => {
                      setSelectedCourseId(event.target.value);
                      setCurricula([]);
                      setSelectedCurriculumId("");
                      setCurriculum(null);
                      setCurriculumBatches([]);
                      setShowAddCurriculumForm(false);
                      setShowAddModuleForm(false);
                      setNewModuleTitle("");
                      setNewModuleDescription("");
                    }}
                    className={selectClassName}
                    disabled={isLoadingCourses || isMutating}
                  >
                    <option value="">Select a course...</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>{course.name}</option>
                    ))}
                  </select>
                </div>

                <div className="rounded-2xl border border-[#e2e8f0] bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
                  <p className="font-semibold text-slate-900">Current workspace</p>
                  <p className="mt-1">{currentCurriculumTitle}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Select a curriculum variant on the left to edit its structure. Batch mappings stay course-constrained automatically.
                  </p>
                </div>

                <div className="rounded-2xl border border-[#e2e8f0] bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
                  <p className="font-semibold text-slate-900">Recommended flow</p>
                  <p className="mt-2 leading-6">
                    Create the curriculum variant, define modules and stages, add content and assessments, then map the finished sequence to eligible batches.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!selectedCourseId ? (
        <div className="rounded-3xl border border-dashed border-[#d9e0e7] bg-white p-12 text-center text-sm text-slate-500 shadow-sm">
          Select a course to begin building its curriculum workspace.
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
          <Card className="h-fit xl:sticky xl:top-6">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Curriculum Variants</CardTitle>
                  <CardDescription>Select a course-specific variant or create a new one.</CardDescription>
                </div>
                {canCreateCurriculum && !showAddCurriculumForm ? (
                  <Button type="button" size="sm" variant="secondary" disabled={isMutating} onClick={() => setShowAddCurriculumForm(true)}>
                    <Plus className="h-4 w-4" />
                    New Curriculum
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {canCreateCurriculum && showAddCurriculumForm ? (
                <div className="space-y-3 rounded-xl border border-dashed border-[#cfd8e3] bg-slate-50/70 p-4">
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
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isCreatingCurriculum || isMutating}
                      onClick={() => {
                        setNewCurriculumTitle("");
                        setNewCurriculumDescription("");
                        setShowAddCurriculumForm(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="button" disabled={isCreatingCurriculum || isMutating || !newCurriculumTitle.trim()} onClick={() => void handleCreateCurriculum()}>
                      {isCreatingCurriculum ? "Creating…" : "Create Curriculum"}
                    </Button>
                  </div>
                </div>
              ) : null}

              {isLoadingCurricula ? (
                <div className="space-y-3">
                  <Skeleton className="h-24 w-full rounded-xl" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                </div>
              ) : curricula.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#d9e0e7] bg-slate-50/70 p-6 text-sm text-slate-500">
                  No curricula exist for {selectedCourse?.name ?? "this course"} yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {curricula.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={cn(
                        "w-full rounded-2xl border p-4 text-left transition-colors",
                        selectedCurriculumId === item.id
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-[#dde1e6] bg-white hover:border-primary/40",
                      )}
                      onClick={() => setSelectedCurriculumId(item.id)}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <Badge variant={statusVariant[item.status] ?? "info"}>{item.status}</Badge>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs text-slate-500">
                        {item.description || "No description yet."}
                      </p>
                      <p className="mt-3 text-xs text-slate-500">
                        {item.moduleCount} modules · {item.stageCount} stages · {item.itemCount} items · {item.batchCount} mapped batches
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            {!selectedCurriculumId ? (
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
                <Card className="overflow-hidden border-slate-200 bg-[linear-gradient(135deg,_#ffffff_0%,_#f7fbff_55%,_#edf4ff_100%)]">
                  <CardContent className="pt-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xl font-semibold text-slate-950">{currentCurriculumTitle}</p>
                          {currentCurriculumStatus ? <Badge variant={statusVariant[currentCurriculumStatus] ?? "info"}>{currentCurriculumStatus}</Badge> : null}
                        </div>
                        <p className="max-w-3xl text-sm leading-6 text-slate-600">
                          {curriculum.description || "Use the details card below to define the intent, audience, and rollout status for this curriculum variant."}
                        </p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-4">
                        <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm">
                          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Modules</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{currentModuleCount}</p>
                        </div>
                        <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm">
                          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Stages</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{currentStageCount}</p>
                        </div>
                        <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm">
                          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Items</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{currentItemCount}</p>
                        </div>
                        <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm">
                          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Mapped Batches</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{currentBatchCount}</p>
                        </div>
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
                                contentOptions={contentOptions}
                                assessmentOptions={assessmentOptions}
                                disabled={isMutating}
                                canEdit={canEditCurriculum}
                                onSave={handleSaveModule}
                                onDelete={handleDeleteModule}
                                onCreateStage={handleCreateStage}
                                onSaveStage={handleSaveStage}
                                onDeleteStage={handleDeleteStage}
                                onReorderStages={handleReorderStages}
                                onCreateItem={handleCreateStageItem}
                                onToggleRequired={handleToggleItemRequired}
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

          <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <Card>
              <CardHeader>
                <CardTitle>Reference Inventory</CardTitle>
                <CardDescription>These reusable assets are available for the selected course when composing stages.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-[#e2e8f0] bg-slate-50/80 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <BookOpen className="h-4 w-4 text-primary" />
                    Content library
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{isLoadingReferences ? "Loading references..." : `${contentOptions.length} active content item${contentOptions.length === 1 ? "" : "s"}`}</p>
                </div>
                <div className="rounded-2xl border border-[#e2e8f0] bg-slate-50/80 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Boxes className="h-4 w-4 text-primary" />
                    Assessment pool
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{isLoadingReferences ? "Loading references..." : `${assessmentOptions.length} reusable assessment${assessmentOptions.length === 1 ? "" : "s"}`}</p>
                </div>
                <div className="rounded-2xl border border-[#e2e8f0] bg-slate-50/80 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Workflow className="h-4 w-4 text-primary" />
                    Mapping readiness
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {selectedCurriculumId
                      ? `${currentBatchCount} batch mapping${currentBatchCount === 1 ? "" : "s"} currently reference this curriculum.`
                      : "Select a curriculum variant to review its batch rollout readiness."}
                  </p>
                </div>
              </CardContent>
            </Card>

            {selectedCurriculumId ? (
              <CurriculumBatchMappingCard
                batches={curriculumBatches}
                isLoading={isLoadingCurriculumBatches}
                disabled={isMutating}
                canEdit={canEditCurriculum}
                onToggle={handleToggleBatchMapping}
              />
            ) : (
              <Card>
                <CardContent className="py-10 text-center text-sm text-slate-500">
                  Select a curriculum variant to review which batches can receive it.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}