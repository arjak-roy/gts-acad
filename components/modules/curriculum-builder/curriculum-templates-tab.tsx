"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Eye, LayoutTemplate, Loader2, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { CurriculumHealthBadge, CurriculumHealthReport } from "@/components/modules/curriculum-builder/curriculum-health-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

type TemplateSummary = {
  id: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  title: string;
  description: string | null;
  status: string;
  isTemplate: boolean;
  moduleCount: number;
  stageCount: number;
  itemCount: number;
  batchCount: number;
  createdAt: string;
  updatedAt: string;
};

type CourseOption = {
  id: string;
  name: string;
};

const statusVariant: Record<string, "default" | "info" | "warning"> = {
  DRAFT: "info",
  PUBLISHED: "default",
  ARCHIVED: "warning",
};

export function CurriculumTemplatesTab({
  courses,
  selectedCourseId,
  onCreateFromTemplate,
  disabled,
}: {
  courses: CourseOption[];
  selectedCourseId: string;
  onCreateFromTemplate?: (curriculumId: string) => void;
  disabled?: boolean;
}) {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterCourseId, setFilterCourseId] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createFromId, setCreateFromId] = useState<string | null>(null);
  const [createTitle, setCreateTitle] = useState("");
  const [createTargetCourseId, setCreateTargetCourseId] = useState(selectedCourseId);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [healthViewId, setHealthViewId] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const url = filterCourseId
        ? `/api/curriculum/templates?courseId=${filterCourseId}`
        : "/api/curriculum/templates";
      const res = await fetch(url);
      const json = await res.json();
      setTemplates(json.data ?? []);
    } catch {
      toast.error("Failed to load curriculum templates");
    } finally {
      setIsLoading(false);
    }
  }, [filterCourseId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleCreateFromTemplate = async () => {
    if (!createFromId || !createTitle.trim() || !createTargetCourseId) return;
    setIsCreating(true);
    try {
      const res = await fetch("/api/curriculum/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_from_template",
          templateId: createFromId,
          targetCourseId: createTargetCourseId,
          title: createTitle.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to create curriculum from template");
        return;
      }
      toast.success("Curriculum created from template");
      setCreateDialogOpen(false);
      setCreateFromId(null);
      setCreateTitle("");
      if (onCreateFromTemplate) {
        onCreateFromTemplate(json.data?.id ?? "");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!deleteConfirmId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/curriculum/${deleteConfirmId}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error ?? "Failed to delete template");
        return;
      }
      toast.success("Template deleted");
      setDeleteConfirmId(null);
      loadTemplates();
    } catch {
      toast.error("Network error");
    } finally {
      setIsDeleting(false);
    }
  };

  const openCreateDialog = (templateId: string, templateTitle: string) => {
    setCreateFromId(templateId);
    setCreateTitle(`${templateTitle.replace(/^\[Template\]\s*/i, "")} (Copy)`);
    setCreateTargetCourseId(selectedCourseId);
    setCreateDialogOpen(true);
  };

  const selectClassName = "block w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84]";

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card className="overflow-hidden border-slate-200 bg-white/95">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base">Curriculum Templates</CardTitle>
              <CardDescription>Browse, create from, and manage reusable curriculum templates.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Filter by Course
              </label>
              <select
                value={filterCourseId}
                onChange={(e) => setFilterCourseId(e.target.value)}
                className={selectClassName}
                style={{ minWidth: 200 }}
              >
                <option value="">All courses</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <p className="text-xs text-slate-400">
              {isLoading ? "Loading…" : `${templates.length} template${templates.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Template grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-[#d9e0e7] bg-white p-12 text-center shadow-sm">
          <LayoutTemplate className="h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">No curriculum templates found</p>
          <p className="text-xs text-slate-400">
            Save any curriculum as a template from the Builder tab to populate this list.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((tpl) => (
            <Card key={tpl.id} className="group overflow-hidden border-slate-200 transition-shadow hover:shadow-md">
              <CardContent className="p-0">
                {/* Card header with colored accent */}
                <div className="relative border-b border-slate-100 bg-gradient-to-br from-[#0d3b84]/5 to-[#d4a853]/5 px-4 py-5">
                  <div className="absolute right-2 top-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 rounded-lg p-0 opacity-0 transition-opacity group-hover:opacity-100"
                          disabled={disabled}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl">
                        <DropdownMenuItem
                          onClick={() => openCreateDialog(tpl.id, tpl.title)}
                          className="gap-2"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Create from Template
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setHealthViewId(healthViewId === tpl.id ? null : tpl.id)}
                          className="gap-2"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View Health Report
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleteConfirmId(tpl.id)}
                          className="gap-2 text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete Template
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0d3b84] shadow-sm">
                      <LayoutTemplate className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-slate-900">{tpl.title}</h3>
                      <p className="truncate text-xs text-slate-500">{tpl.courseName}</p>
                    </div>
                  </div>
                </div>

                {/* Card body */}
                <div className="space-y-3 px-4 py-3">
                  {/* Stats */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="info" className="text-[10px]">{tpl.moduleCount} modules</Badge>
                    <Badge variant="info" className="text-[10px]">{tpl.stageCount} stages</Badge>
                    <Badge variant="info" className="text-[10px]">{tpl.itemCount} items</Badge>
                    <Badge variant={statusVariant[tpl.status] ?? "info"} className="text-[10px]">{tpl.status}</Badge>
                    <CurriculumHealthBadge curriculumId={tpl.id} />
                  </div>

                  {/* Description */}
                  {tpl.description && (
                    <p className="line-clamp-2 text-xs leading-5 text-slate-500">{tpl.description}</p>
                  )}

                  {/* Updated */}
                  <p className="text-[10px] text-slate-400">
                    Updated {new Date(tpl.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>

                  {/* Health report expand */}
                  {healthViewId === tpl.id && (
                    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                      <CurriculumHealthReport curriculumId={tpl.id} />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create from Template Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create from Template</DialogTitle>
            <DialogDescription>
              A new curriculum will be created by cloning this template into the selected course.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">New Curriculum Title</label>
              <Input
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="Enter a title…"
                className="rounded-xl"
                disabled={isCreating}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Target Course</label>
              <select
                value={createTargetCourseId}
                onChange={(e) => setCreateTargetCourseId(e.target.value)}
                className={selectClassName}
                disabled={isCreating}
              >
                <option value="">Select a course…</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" className="rounded-xl" onClick={() => setCreateDialogOpen(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button
              className="rounded-xl"
              disabled={isCreating || !createTitle.trim() || !createTargetCourseId}
              onClick={handleCreateFromTemplate}
            >
              {isCreating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this template? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" className="rounded-xl" onClick={() => setDeleteConfirmId(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="default"
              className="rounded-xl bg-red-600 hover:bg-red-700"
              disabled={isDeleting}
              onClick={handleDeleteTemplate}
            >
              {isDeleting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
