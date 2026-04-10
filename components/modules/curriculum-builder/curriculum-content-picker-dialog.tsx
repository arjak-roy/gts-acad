"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileText, Folder, Plus } from "lucide-react";

import { AddContentSheet } from "@/components/modules/course-builder/add-content-sheet";
import { CurriculumReferencePickerDialog } from "@/components/modules/curriculum-builder/curriculum-reference-picker-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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

type CurriculumContentPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  items: ContentOption[];
  folders: ContentFolderOption[];
  isLoading: boolean;
  isSaving: boolean;
  canCreateContent: boolean;
  onSubmit: (input: { contentIds: string[]; isRequired: boolean }) => Promise<boolean>;
  onContentCreated: () => void | Promise<void>;
};

export function CurriculumContentPickerDialog({
  open,
  onOpenChange,
  courseId,
  items,
  folders,
  isLoading,
  isSaving,
  canCreateContent,
  onSubmit,
  onContentCreated,
}: CurriculumContentPickerDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isRequired, setIsRequired] = useState(false);
  const [expandedFolderIds, setExpandedFolderIds] = useState<string[]>([]);
  const [addContentOpen, setAddContentOpen] = useState(false);

  useEffect(() => {
    setExpandedFolderIds(folders.map((folder) => folder.id));
  }, [folders]);

  useEffect(() => {
    if (!open) {
      setSearchTerm("");
      setSelectedIds([]);
      setIsRequired(false);
      setAddContentOpen(false);
    }
  }, [open]);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const visibleItems = useMemo(() => items.filter((item) => {
    if (!normalizedSearch) {
      return true;
    }

    return [item.title, item.folderName, item.contentType, item.status]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalizedSearch));
  }), [items, normalizedSearch]);

  const rootItems = visibleItems.filter((item) => !item.folderId);
  const folderSections = folders
    .map((folder) => ({
      folder,
      items: visibleItems.filter((item) => item.folderId === folder.id),
    }))
    .filter((section) => section.items.length > 0 || (!normalizedSearch && items.some((item) => item.folderId === section.folder.id)));

  const allVisibleIds = visibleItems.map((item) => item.id);

  const toggleSelection = (id: string) => {
    setSelectedIds((current) => (
      current.includes(id)
        ? current.filter((itemId) => itemId !== id)
        : [...current, id]
    ));
  };

  const toggleFolderExpanded = (folderId: string) => {
    setExpandedFolderIds((current) => (
      current.includes(folderId)
        ? current.filter((itemId) => itemId !== folderId)
        : [...current, folderId]
    ));
  };

  const handleConfirm = async () => {
    const ok = await onSubmit({
      contentIds: selectedIds,
      isRequired,
    });

    if (ok) {
      onOpenChange(false);
    }
  };

  return (
    <>
      <CurriculumReferencePickerDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Add Content to Stage"
        description="Browse the course content library by folder, search across items, and add one or more references to this stage. Each selected item is saved as a separate stage item."
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        searchPlaceholder="Search content, folder, type, or status"
        selectedCount={selectedIds.length}
        confirmLabel={`Add Content${selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}`}
        isConfirmDisabled={selectedIds.length === 0 || isSaving}
        isSubmitting={isSaving}
        onConfirm={() => void handleConfirm()}
        actions={(
          <>
            <Button type="button" variant="ghost" size="sm" disabled={allVisibleIds.length === 0} onClick={() => setSelectedIds(Array.from(new Set([...selectedIds, ...allVisibleIds])))}>
              Select visible
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={selectedIds.length === 0} onClick={() => setSelectedIds([])}>
              Clear
            </Button>
            {canCreateContent ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => setAddContentOpen(true)}>
                <Plus className="h-4 w-4" />
                Add Content
              </Button>
            ) : null}
          </>
        )}
        footerContent={(
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <Checkbox checked={isRequired} onCheckedChange={(checked) => setIsRequired(checked === true)} disabled={isSaving} />
            Mark every selected content item as required.
          </label>
        )}
      >
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
        ) : visibleItems.length === 0 && folderSections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-sm text-slate-500">
            {normalizedSearch ? "No content matches the current search." : "No content is available for this course yet."}
          </div>
        ) : (
          <div className="space-y-4">
            {rootItems.length > 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white">
                <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                  <Folder className="h-4 w-4 text-slate-400" />
                  <p className="text-sm font-semibold text-slate-900">Repository Root</p>
                  <Badge variant="info">{rootItems.length}</Badge>
                </div>
                <div className="divide-y divide-slate-100">
                  {rootItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50",
                        selectedIds.includes(item.id) && "bg-primary/5",
                      )}
                      onClick={() => toggleSelection(item.id)}
                    >
                      <Checkbox
                        checked={selectedIds.includes(item.id)}
                        onCheckedChange={() => toggleSelection(item.id)}
                        onClick={(event) => event.stopPropagation()}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <FileText className="h-4 w-4 text-slate-400" />
                          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                          <Badge variant="info">{item.contentType}</Badge>
                          <Badge variant="info">{item.status}</Badge>
                        </div>
                        <p className="text-xs text-slate-500">Library root</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {folderSections.map((section) => {
              const isExpanded = expandedFolderIds.includes(section.folder.id);

              return (
                <div key={section.folder.id} className="rounded-2xl border border-slate-200 bg-white">
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left"
                    onClick={() => toggleFolderExpanded(section.folder.id)}
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                    <Folder className="h-4 w-4 text-slate-400" />
                    <p className="text-sm font-semibold text-slate-900">{section.folder.name}</p>
                    <Badge variant="info">{section.items.length}</Badge>
                  </button>

                  {isExpanded ? (
                    section.items.length === 0 ? (
                      <div className="px-4 py-4 text-sm text-slate-500">No content in this folder matches the current search.</div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {section.items.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className={cn(
                              "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50",
                              selectedIds.includes(item.id) && "bg-primary/5",
                            )}
                            onClick={() => toggleSelection(item.id)}
                          >
                            <Checkbox
                              checked={selectedIds.includes(item.id)}
                              onCheckedChange={() => toggleSelection(item.id)}
                              onClick={(event) => event.stopPropagation()}
                              className="mt-1"
                            />
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <FileText className="h-4 w-4 text-slate-400" />
                                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                                <Badge variant="info">{item.contentType}</Badge>
                                <Badge variant="info">{item.status}</Badge>
                              </div>
                              <p className="text-xs text-slate-500">Folder: {section.folder.name}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </CurriculumReferencePickerDialog>

      {courseId ? (
        <AddContentSheet
          open={addContentOpen}
          onOpenChange={setAddContentOpen}
          courseId={courseId}
          folders={folders}
          onCreated={() => {
            void onContentCreated();
          }}
        />
      ) : null}
    </>
  );
}