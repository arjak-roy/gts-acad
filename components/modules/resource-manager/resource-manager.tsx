"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import {
  EMPTY_LEARNING_RESOURCE_LOOKUPS,
  type LearningResourceListPage,
  type LearningResourceLookups,
  type LearningResourceUploadConfig,
} from "@/components/modules/course-builder/learning-resource-client";
import { LearningResourceFormSheet, type LearningResourceFormSeed } from "@/components/modules/course-builder/learning-resource-form-sheet";
import { LearningResourceDetailSheet } from "@/components/modules/course-builder/learning-resource-detail-sheet";
import { LearningResourceAssignmentsSheet } from "@/components/modules/course-builder/learning-resource-assignments-sheet";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import {
  buildFolderTree,
  DEFAULT_FILTER_STATE,
  ResourceManagerContext,
  type ContentSelectionMode,
  type ResourceFilterState,
  type ResourceManagerPickResult,
  type ViewMode,
} from "./resource-manager-types";
import { useResourceUpload } from "./resource-manager-upload";
import { ResourceManagerToolbar } from "./resource-manager-toolbar";
import { ResourceManagerFolderTree } from "./resource-manager-folder-tree";
import { ResourceManagerFileList } from "./resource-manager-file-list";
import { ResourceManagerDndWrapper } from "./resource-manager-dnd";

// ─── Props ───────────────────────────────────────────────────────────────────

type ResourceManagerBrowseProps = {
  mode: "browse";
};

type ResourceManagerPickProps = {
  mode: "pick";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId?: string;
  existingResourceIds?: string[];
  onSelect: (result: ResourceManagerPickResult) => void | boolean | Promise<void | boolean>;
  onContentCreated?: () => void | Promise<void>;
};

export type ResourceManagerProps = ResourceManagerBrowseProps | ResourceManagerPickProps;

// ─── Component ───────────────────────────────────────────────────────────────

export function ResourceManager(props: ResourceManagerProps) {
  const { mode } = props;

  // ── State ──────────────────────────────────────────────────────────────────
  const [lookups, setLookups] = useState<LearningResourceLookups>(EMPTY_LEARNING_RESOURCE_LOOKUPS);
  const [uploadConfig, setUploadConfig] = useState<LearningResourceUploadConfig | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [filters, setFilters] = useState<ResourceFilterState>(DEFAULT_FILTER_STATE);
  const [resourcePage, setResourcePage] = useState<LearningResourceListPage | null>(null);
  const [isLoadingResources, setIsLoadingResources] = useState(false);
  const [selectedResourceIds, setSelectedResourceIds] = useState<Set<string>>(new Set());
  const [inlineCreateParentId, setInlineCreateParentId] = useState<string | null>(undefined as unknown as null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [isMovingResource, setIsMovingResource] = useState(false);

  // Pick-mode state
  const [selectionMode, setSelectionMode] = useState<ContentSelectionMode>("LINK");
  const [isRequired, setIsRequired] = useState(false);

  // Draft warning dialog state
  const [draftWarningOpen, setDraftWarningOpen] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(false);

  // Form sheet state
  const [formSheetOpen, setFormSheetOpen] = useState(false);
  const [formPreset, setFormPreset] = useState<LearningResourceFormSeed | undefined>(undefined);
  const [editResourceId, setEditResourceId] = useState<string | null>(null);

  // Detail sheet state
  const [detailResourceId, setDetailResourceId] = useState<string | null>(null);

  // Assignments sheet state
  const [assignResourceId, setAssignResourceId] = useState<string | null>(null);
  const [assignResourceTitle, setAssignResourceTitle] = useState<string | null>(null);

  const disabledResourceIds = useMemo(
    () => new Set(mode === "pick" ? (props as ResourceManagerPickProps).existingResourceIds ?? [] : []),
    [mode, props],
  );

  const folderTree = useMemo(() => buildFolderTree(lookups.folders), [lookups.folders]);

  // ── Fetch Lookups ──────────────────────────────────────────────────────────
  const fetchLookups = useCallback(async () => {
    try {
      const res = await fetch("/api/learning-resources/lookups");
      if (!res.ok) return;
      const data = await res.json();
      setLookups(data.data ?? data);
    } catch {}
  }, []);

  const fetchUploadConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/learning-resources/upload");
      if (!res.ok) return;
      const data = await res.json();
      setUploadConfig(data.data ?? data);
    } catch {}
  }, []);

  useEffect(() => {
    void fetchLookups();
    void fetchUploadConfig();
  }, [fetchLookups, fetchUploadConfig]);

  // ── Fetch Resources ────────────────────────────────────────────────────────
  const fetchResources = useCallback(async () => {
    setIsLoadingResources(true);
    try {
      const params = new URLSearchParams();
      if (selectedFolderId) params.set("folderId", selectedFolderId);
      else params.set("folderId", "__root__");
      if (filters.search) params.set("search", filters.search);
      if (filters.status) params.set("status", filters.status);
      if (filters.visibility) params.set("visibility", filters.visibility);
      if (filters.contentType) params.set("contentType", filters.contentType);
      params.set("page", String(filters.page));
      params.set("pageSize", String(filters.pageSize));

      const res = await fetch(`/api/learning-resources?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load resources");
      const data = await res.json();
      setResourcePage(data.data ?? data);
    } catch {
      setResourcePage(null);
    } finally {
      setIsLoadingResources(false);
    }
  }, [selectedFolderId, filters]);

  useEffect(() => {
    void fetchResources();
  }, [fetchResources]);

  // ── Upload ─────────────────────────────────────────────────────────────────
  const { uploadState, startUpload } = useResourceUpload({
    folderId: selectedFolderId,
    uploadConfig,
    onComplete: () => {
      void fetchResources();
      toast.success("Files uploaded successfully");
    },
  });

  // ── Folder Operations ──────────────────────────────────────────────────────
  const createFolder = useCallback(
    async (name: string, parentId: string | null): Promise<boolean> => {
      try {
        const res = await fetch("/api/learning-resources/folders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, parentId }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          toast.error(body.error || "Failed to create folder");
          return false;
        }
        toast.success(`Folder "${name}" created`);
        void fetchLookups();
        return true;
      } catch {
        toast.error("Failed to create folder");
        return false;
      }
    },
    [fetchLookups],
  );

  const renameFolder = useCallback(
    async (folderId: string, name: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/learning-resources/folders/${folderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          toast.error(body.error || "Failed to rename folder");
          return false;
        }
        void fetchLookups();
        return true;
      } catch {
        toast.error("Failed to rename folder");
        return false;
      }
    },
    [fetchLookups],
  );

  const deleteFolder = useCallback(
    async (folderId: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/learning-resources/folders/${folderId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          toast.error(body.error || "Cannot delete folder (must be empty)");
          return false;
        }
        toast.success("Folder deleted");
        if (selectedFolderId === folderId) setSelectedFolderId(null);
        void fetchLookups();
        return true;
      } catch {
        toast.error("Failed to delete folder");
        return false;
      }
    },
    [fetchLookups, selectedFolderId],
  );

  const moveResource = useCallback(
    async (resourceId: string, folderId: string | null): Promise<boolean> => {
      setIsMovingResource(true);
      try {
        const res = await fetch(`/api/learning-resources/${resourceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderId: folderId || null }),
        });
        if (!res.ok) {
          toast.error("Failed to move resource");
          return false;
        }
        toast.success("Resource moved");
        void fetchResources();
        return true;
      } catch {
        toast.error("Failed to move resource");
        return false;
      } finally {
        setIsMovingResource(false);
      }
    },
    [fetchResources],
  );

  // ── Selection (Pick mode) ──────────────────────────────────────────────────
  const toggleResourceSelection = useCallback((id: string) => {
    setSelectedResourceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    if (!resourcePage) return;
    setSelectedResourceIds((prev) => {
      const next = new Set(prev);
      for (const item of resourcePage.items) {
        if (!disabledResourceIds.has(item.id)) next.add(item.id);
      }
      return next;
    });
  }, [resourcePage, disabledResourceIds]);

  const clearSelection = useCallback(() => {
    setSelectedResourceIds(new Set());
  }, []);

  // ── Custom events for toolbar ──────────────────────────────────────────────
  useEffect(() => {
    function handleNewArticle() {
      setFormPreset({ contentType: "ARTICLE", folderId: selectedFolderId ?? undefined });
      setEditResourceId(null);
      setFormSheetOpen(true);
    }
    function handleNewLink() {
      setFormPreset({ contentType: "LINK", folderId: selectedFolderId ?? undefined });
      setEditResourceId(null);
      setFormSheetOpen(true);
    }
    function handleViewResource(e: Event) {
      const { resourceId } = (e as CustomEvent).detail;
      setDetailResourceId(resourceId);
    }
    function handleEditResource(e: Event) {
      const { resourceId } = (e as CustomEvent).detail;
      setEditResourceId(resourceId);
      setFormPreset(undefined);
      setFormSheetOpen(true);
    }
    function handleAssignResource(e: Event) {
      const { resourceId, title } = (e as CustomEvent).detail;
      setAssignResourceId(resourceId);
      setAssignResourceTitle(title);
    }
    window.addEventListener("rm:new-article", handleNewArticle);
    window.addEventListener("rm:new-link", handleNewLink);
    window.addEventListener("rm:view-resource", handleViewResource);
    window.addEventListener("rm:edit-resource", handleEditResource);
    window.addEventListener("rm:assign-resource", handleAssignResource);
    return () => {
      window.removeEventListener("rm:new-article", handleNewArticle);
      window.removeEventListener("rm:new-link", handleNewLink);
      window.removeEventListener("rm:view-resource", handleViewResource);
      window.removeEventListener("rm:edit-resource", handleEditResource);
      window.removeEventListener("rm:assign-resource", handleAssignResource);
    };
  }, [selectedFolderId]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl+Shift+N: New folder
      if (e.ctrlKey && e.shiftKey && e.key === "N") {
        e.preventDefault();
        setInlineCreateParentId(selectedFolderId);
      }
      // F2: Rename selected folder
      if (e.key === "F2" && selectedFolderId) {
        e.preventDefault();
        setRenamingFolderId(selectedFolderId);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedFolderId]);

  // ── Context Value ──────────────────────────────────────────────────────────
  const contextValue = useMemo(
    () => ({
      mode,
      lookups,
      folderTree,
      selectedFolderId,
      setSelectedFolderId,
      viewMode,
      setViewMode,
      filters,
      setFilters,
      resourcePage,
      isLoadingResources,
      refreshResources: () => void fetchResources(),
      refreshLookups: () => void fetchLookups(),
      uploadState,
      uploadConfig,
      startUpload,
      selectedResourceIds,
      toggleResourceSelection,
      selectAllVisible,
      clearSelection,
      disabledResourceIds,
      createFolder,
      renameFolder,
      deleteFolder,
      moveResource,
      isMovingResource,
      inlineCreateParentId,
      setInlineCreateParentId: (id: string | null) => setInlineCreateParentId(id),
      renamingFolderId,
      setRenamingFolderId,
    }),
    [
      mode,
      lookups,
      folderTree,
      selectedFolderId,
      viewMode,
      filters,
      resourcePage,
      isLoadingResources,
      fetchResources,
      fetchLookups,
      uploadState,
      uploadConfig,
      startUpload,
      selectedResourceIds,
      toggleResourceSelection,
      selectAllVisible,
      clearSelection,
      disabledResourceIds,
      createFolder,
      renameFolder,
      deleteFolder,
      moveResource,
      isMovingResource,
      inlineCreateParentId,
      renamingFolderId,
    ],
  );

  // ── Pick confirm logic ─────────────────────────────────────────────────────
  const executePickConfirm = useCallback(async () => {
    if (mode !== "pick" || selectedResourceIds.size === 0) return;
    const result = await (props as ResourceManagerPickProps).onSelect({
      resourceIds: Array.from(selectedResourceIds),
      isRequired,
      contentSelectionMode: selectionMode,
    });
    // Auto-close on success (truthy or void)
    if (result !== false) {
      (props as ResourceManagerPickProps).onOpenChange(false);
    }
  }, [mode, props, selectedResourceIds, isRequired, selectionMode]);

  const draftResourcesForWarning = useMemo(
    () => (resourcePage?.items ?? []).filter(
      (item) => selectedResourceIds.has(item.id) && item.status === "DRAFT",
    ),
    [resourcePage, selectedResourceIds],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  const inner = (
    <ResourceManagerContext.Provider value={contextValue}>
      <ResourceManagerDndWrapper>
        <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {/* Toolbar */}
          <ResourceManagerToolbar />

          {/* Main panels */}
          <div className="flex flex-1 overflow-hidden">
            {/* Left: Folder tree */}
            <div className="w-[260px] shrink-0 overflow-hidden xl:w-[280px]">
              <ResourceManagerFolderTree />
            </div>

            {/* Center: File list */}
            <div className="flex-1 overflow-hidden">
              <ResourceManagerFileList />
            </div>
          </div>

          {/* Pick mode footer */}
          {mode === "pick" && <PickFooter selectionMode={selectionMode} setSelectionMode={setSelectionMode} isRequired={isRequired} setIsRequired={setIsRequired} selectedCount={selectedResourceIds.size} onConfirm={async () => {
            if (selectedResourceIds.size === 0) return;
            // Check for draft resources
            const selectedDrafts = (resourcePage?.items ?? []).filter(
              (item) => selectedResourceIds.has(item.id) && item.status === "DRAFT",
            );
            if (selectedDrafts.length > 0) {
              setDraftWarningOpen(true);
              return;
            }
            await executePickConfirm();
          }} />}
        </div>
      </ResourceManagerDndWrapper>

      {/* Resource creation/edit form */}
      <LearningResourceFormSheet
        open={formSheetOpen}
        onOpenChange={(open) => {
          setFormSheetOpen(open);
          if (!open) setEditResourceId(null);
        }}
        resourceId={editResourceId}
        lookups={lookups}
        onSaved={() => {
          setFormSheetOpen(false);
          setEditResourceId(null);
          void fetchResources();
          // Notify parent (pick mode) that content was created/edited
          if (mode === "pick" && !editResourceId) {
            void (props as ResourceManagerPickProps).onContentCreated?.();
          }
        }}
        createPreset={formPreset}
      />

      {/* Resource detail view */}
      <LearningResourceDetailSheet
        open={!!detailResourceId}
        onOpenChange={(open) => { if (!open) setDetailResourceId(null); }}
        resourceId={detailResourceId}
      />

      {/* Assign to course/batch */}
      <LearningResourceAssignmentsSheet
        open={!!assignResourceId}
        onOpenChange={(open) => { if (!open) { setAssignResourceId(null); setAssignResourceTitle(null); } }}
        resourceId={assignResourceId}
        resourceTitle={assignResourceTitle}
        lookups={lookups}
        onAssignmentsUpdated={() => void fetchResources()}
      />
    </ResourceManagerContext.Provider>
  );

  // Browse mode: render inline
  if (mode === "browse") {
    return <div className="h-[calc(100vh-8rem)]">{inner}</div>;
  }

  // Pick mode: render in dialog
  return (
    <>
      <Dialog open={(props as ResourceManagerPickProps).open} onOpenChange={(props as ResourceManagerPickProps).onOpenChange}>
        <DialogContent size="2xl" className="flex h-[85vh] max-h-[85vh] max-w-7xl flex-col overflow-hidden p-0">
          {inner}
        </DialogContent>
      </Dialog>

      <Dialog open={draftWarningOpen} onOpenChange={setDraftWarningOpen}>
        <DialogContent size="sm" className="p-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Draft content selected
            </DialogTitle>
            <DialogDescription>
              {draftResourcesForWarning.length === 1
                ? "The selected content is still in DRAFT status. Consider publishing it before adding it to the curriculum."
                : `${draftResourcesForWarning.length} selected content items are still in DRAFT status. Consider publishing them before adding them to the curriculum.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 px-6 py-5">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="space-y-2">
                {draftResourcesForWarning.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-slate-900">{item.title}</span>
                    <Badge variant="warning">DRAFT</Badge>
                  </div>
                ))}
              </div>
              {draftResourcesForWarning.length > 5 ? (
                <p className="mt-3 text-xs text-slate-500">+{draftResourcesForWarning.length - 5} more draft item{draftResourcesForWarning.length - 5 === 1 ? "" : "s"}</p>
              ) : null}
            </div>
            <p className="text-xs text-slate-500">
              You can still add them, but learners won&apos;t be able to access draft content until it is published.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setDraftWarningOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="default" disabled={pendingConfirm} onClick={async () => {
              setPendingConfirm(true);
              try {
                await executePickConfirm();
              } finally {
                setPendingConfirm(false);
                setDraftWarningOpen(false);
              }
            }}>
              {pendingConfirm ? "Saving…" : "Add anyway"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Pick Footer ─────────────────────────────────────────────────────────────

function PickFooter({
  selectionMode,
  setSelectionMode,
  isRequired,
  setIsRequired,
  selectedCount,
  onConfirm,
}: {
  selectionMode: ContentSelectionMode;
  setSelectionMode: (mode: ContentSelectionMode) => void;
  isRequired: boolean;
  setIsRequired: (v: boolean) => void;
  selectedCount: number;
  onConfirm: () => Promise<void>;
}) {
  const [isSaving, setIsSaving] = useState(false);

  async function handleConfirm() {
    setIsSaving(true);
    try {
      await onConfirm();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-4 border-t border-slate-200 bg-slate-50 px-4 py-3">
      {/* Selection mode */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={selectionMode === "LINK" ? "default" : "secondary"}
          onClick={() => setSelectionMode("LINK")}
          className="h-7 text-xs"
        >
          Link from Repository
        </Button>
        <Button
          size="sm"
          variant={selectionMode === "COPY_LOCAL" ? "default" : "secondary"}
          onClick={() => setSelectionMode("COPY_LOCAL")}
          className="h-7 text-xs"
        >
          Copy Locally
        </Button>
      </div>

      {/* Required */}
      <label className="flex items-center gap-1.5 text-xs text-slate-600">
        <Checkbox checked={isRequired} onCheckedChange={(v) => setIsRequired(!!v)} className="h-3.5 w-3.5" />
        Mark as required
      </label>

      <div className="flex-1" />

      {/* Confirm */}
      <Button size="sm" disabled={selectedCount === 0 || isSaving} onClick={handleConfirm}>
        {isSaving ? "Saving…" : `${selectionMode === "LINK" ? "Link" : "Copy"} ${selectedCount} item${selectedCount !== 1 ? "s" : ""}`}
      </Button>
    </div>
  );
}
