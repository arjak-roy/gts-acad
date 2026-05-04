"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Copy, FileText, Folder, Library, Link2, Plus } from "lucide-react";

import { AddContentSheet } from "@/components/modules/course-builder/add-content-sheet";
import { CurriculumReferencePickerDialog } from "@/components/modules/curriculum-builder/curriculum-reference-picker-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type RepositoryResourceOption = {
  id: string;
  sourceContentId: string | null;
  title: string;
  status: string;
  folderId: string | null;
  folderName: string | null;
  folderPath: string | null;
  contentType: string;
  sourceCourseId: string | null;
  sourceCourseName: string | null;
  sourceFolderName: string | null;
  isOwnedByCourse: boolean;
  isAssignedToCourse: boolean;
  hasSourceContent: boolean;
};

type RepositoryFolderOption = {
  id: string;
  parentId: string | null;
  name: string;
  description: string | null;
  sortOrder: number;
  pathLabel: string;
};

type AuthoringFolderOption = {
  id: string;
  name: string;
  contentCount: number;
};

type ContentSelectionMode = "LINK" | "COPY_LOCAL";

type CurriculumContentPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  items: RepositoryResourceOption[];
  repositoryFolders: RepositoryFolderOption[];
  authoringFolders: AuthoringFolderOption[];
  isLoading: boolean;
  isSaving: boolean;
  canCreateContent: boolean;
  existingSourceContentIds: string[];
  onSubmit: (input: {
    resourceIds: string[];
    isRequired: boolean;
    contentSelectionMode: ContentSelectionMode;
  }) => Promise<boolean>;
  onContentCreated: () => void | Promise<void>;
};

function RepositoryResourceRow({
  item,
  isSelected,
  isInCurriculum,
  onToggle,
}: {
  item: RepositoryResourceOption;
  isSelected: boolean;
  isInCurriculum: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50",
        isSelected && "bg-primary/5",
        isInCurriculum && "opacity-50",
      )}
      onClick={onToggle}
      disabled={isInCurriculum}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={onToggle}
        onClick={(event) => event.stopPropagation()}
        className="mt-1"
        disabled={isInCurriculum}
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-4 w-4 text-slate-400" />
          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
          <Badge variant="info">{item.contentType}</Badge>
          <Badge variant="info">{item.status}</Badge>
          {item.isOwnedByCourse ? <Badge variant="default">This course</Badge> : null}
          {!item.isOwnedByCourse && item.isAssignedToCourse ? <Badge variant="info">Shared to course</Badge> : null}
          {!item.hasSourceContent ? <Badge variant="info">Standalone</Badge> : null}
          {isInCurriculum ? <Badge variant="default">Already added</Badge> : null}
        </div>
        <p className="text-xs text-slate-500">
          {item.folderPath ? `Repository folder: ${item.folderPath}` : "Repository root"}
          {item.sourceCourseName
            ? ` · Source: ${item.sourceCourseName}${item.sourceFolderName ? ` / ${item.sourceFolderName}` : ""}`
            : " · No source content yet"}
        </p>
      </div>
    </button>
  );
}

export function CurriculumContentPickerDialog({
  open,
  onOpenChange,
  courseId,
  items,
  repositoryFolders,
  authoringFolders,
  isLoading,
  isSaving,
  canCreateContent,
  existingSourceContentIds,
  onSubmit,
  onContentCreated,
}: CurriculumContentPickerDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isRequired, setIsRequired] = useState(false);
  const [contentSelectionMode, setContentSelectionMode] = useState<ContentSelectionMode>("LINK");
  const [expandedFolderIds, setExpandedFolderIds] = useState<string[]>([]);
  const [addContentOpen, setAddContentOpen] = useState(false);

  const existingSourceContentIdSet = useMemo(
    () => new Set(existingSourceContentIds),
    [existingSourceContentIds],
  );

  useEffect(() => {
    setExpandedFolderIds(repositoryFolders.map((folder) => folder.id));
  }, [repositoryFolders]);

  useEffect(() => {
    if (!open) {
      setSearchTerm("");
      setSelectedIds([]);
      setIsRequired(false);
      setContentSelectionMode("LINK");
      setAddContentOpen(false);
    }
  }, [open]);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const visibleItems = useMemo(
    () =>
      items.filter((item) => {
        if (!normalizedSearch) {
          return true;
        }

        return [
          item.title,
          item.folderPath,
          item.folderName,
          item.contentType,
          item.status,
          item.sourceCourseName,
          item.sourceFolderName,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedSearch));
      }),
    [items, normalizedSearch],
  );

  const isInCurriculum = (item: RepositoryResourceOption) => (
    Boolean(item.sourceContentId && existingSourceContentIdSet.has(item.sourceContentId))
  );

  const rootItems = visibleItems.filter((item) => !item.folderId);
  const folderSections = repositoryFolders
    .map((folder) => ({
      folder,
      items: visibleItems.filter((item) => item.folderId === folder.id),
    }))
    .filter(
      (section) =>
        section.items.length > 0
        || (!normalizedSearch && items.some((item) => item.folderId === section.folder.id)),
    );

  const selectableVisibleIds = visibleItems
    .filter((item) => !isInCurriculum(item))
    .map((item) => item.id);

  const isSubmitting = isSaving;

  const handleConfirm = async () => {
    const ok = await onSubmit({
      resourceIds: selectedIds,
      isRequired,
      contentSelectionMode,
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
        title="Add Repository Content to Stage"
        description="Browse the learning-resource repository, then link canonical records into this curriculum or copy them locally only when you need course-specific edits."
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        searchPlaceholder="Search repository resource, folder, source course, or type"
        selectedCount={selectedIds.length}
        confirmLabel={
          contentSelectionMode === "COPY_LOCAL"
            ? `Copy Locally & Add${selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}`
            : `Link from Repository${selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}`
        }
        isConfirmDisabled={selectedIds.length === 0 || isSubmitting}
        isSubmitting={isSubmitting}
        onConfirm={() => void handleConfirm()}
        actions={
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={selectableVisibleIds.length === 0}
              onClick={() => setSelectedIds(Array.from(new Set([...selectedIds, ...selectableVisibleIds])))}
            >
              Select visible
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={selectedIds.length === 0} onClick={() => setSelectedIds([])}>
              Clear
            </Button>
            {canCreateContent ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => setAddContentOpen(true)}>
                <Plus className="h-4 w-4" />
                Add Authored Content
              </Button>
            ) : null}
          </>
        }
        footerContent={
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <Checkbox checked={isRequired} onCheckedChange={(checked) => setIsRequired(checked === true)} disabled={isSubmitting} />
              Mark every selected content item as required.
            </label>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className={cn(
                  "rounded-xl border px-4 py-3 text-left transition-colors",
                  contentSelectionMode === "LINK"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                )}
                onClick={() => setContentSelectionMode("LINK")}
                disabled={isSubmitting}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Link2 className="h-4 w-4" />
                  Link from repository
                </span>
                <span className={cn("mt-1 block text-xs", contentSelectionMode === "LINK" ? "text-slate-200" : "text-slate-500")}>
                  Keep stage content tied to the canonical repository record. Shared resources are assigned automatically.
                </span>
              </button>

              <button
                type="button"
                className={cn(
                  "rounded-xl border px-4 py-3 text-left transition-colors",
                  contentSelectionMode === "COPY_LOCAL"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                )}
                onClick={() => setContentSelectionMode("COPY_LOCAL")}
                disabled={isSubmitting}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Copy className="h-4 w-4" />
                  Copy locally
                </span>
                <span className={cn("mt-1 block text-xs", contentSelectionMode === "COPY_LOCAL" ? "text-slate-200" : "text-slate-500")}>
                  Create a draft course-local copy when the curriculum needs its own edited version.
                </span>
              </button>
            </div>
          </div>
        }
      >
        <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-start gap-3">
            <Library className="mt-0.5 h-4 w-4 text-slate-500" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900">Repository-first selection</p>
              <p className="text-xs text-slate-500">
                Use repository records as the default source of truth. Only choose <span className="font-medium text-slate-700">Copy locally</span> when the course truly needs its own editable variant.
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
        ) : visibleItems.length === 0 && folderSections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-sm text-slate-500">
            {normalizedSearch ? "No repository resources match the current search." : "No repository resources are available yet."}
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
                    <RepositoryResourceRow
                      key={item.id}
                      item={item}
                      isSelected={selectedIds.includes(item.id)}
                      isInCurriculum={isInCurriculum(item)}
                      onToggle={() => setSelectedIds((current) => (
                        current.includes(item.id)
                          ? current.filter((value) => value !== item.id)
                          : [...current, item.id]
                      ))}
                    />
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
                    onClick={() => setExpandedFolderIds((current) => (
                      current.includes(section.folder.id)
                        ? current.filter((value) => value !== section.folder.id)
                        : [...current, section.folder.id]
                    ))}
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                    <Folder className="h-4 w-4 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">{section.folder.pathLabel}</p>
                      {section.folder.description ? <p className="text-xs text-slate-500">{section.folder.description}</p> : null}
                    </div>
                    <Badge variant="info">{section.items.length}</Badge>
                  </button>
                  {isExpanded ? (
                    section.items.length === 0 ? (
                      <div className="px-4 py-4 text-sm text-slate-500">No resources in this folder match the current search.</div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {section.items.map((item) => (
                          <RepositoryResourceRow
                            key={item.id}
                            item={item}
                            isSelected={selectedIds.includes(item.id)}
                            isInCurriculum={isInCurriculum(item)}
                            onToggle={() => setSelectedIds((current) => (
                              current.includes(item.id)
                                ? current.filter((value) => value !== item.id)
                                : [...current, item.id]
                            ))}
                          />
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
          folders={authoringFolders}
          onCreated={() => {
            void onContentCreated();
          }}
        />
      ) : null}
    </>
  );
}