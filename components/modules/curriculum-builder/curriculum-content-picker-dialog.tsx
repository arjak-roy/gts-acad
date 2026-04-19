"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileText, Folder, FolderPlus, Library, Plus } from "lucide-react";
import { toast } from "sonner";

import { AddContentFolderSheet } from "@/components/modules/course-builder/add-content-folder-sheet";
import { AddContentSheet } from "@/components/modules/course-builder/add-content-sheet";
import { CurriculumReferencePickerDialog } from "@/components/modules/curriculum-builder/curriculum-reference-picker-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ContentOption = {
  id: string;
  title: string;
  status: string;
  folderId: string | null;
  folderName: string | null;
  contentType: string;
  courseId?: string;
  courseName?: string;
};

type ContentFolderOption = {
  id: string;
  name: string;
  contentCount: number;
};

type AllCourseOption = {
  id: string;
  name: string;
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
  existingContentIds: string[];
  onSubmit: (input: { contentIds: string[]; isRequired: boolean }) => Promise<boolean>;
  onContentCreated: () => void | Promise<void>;
};

type ActiveTab = "course" | "all";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function readPickerApiData<T>(response: Response, fallbackMessage: string) {
  const payload = (await response.json()) as { data?: T; error?: string };
  if (!response.ok) {
    throw new Error(payload.error || fallbackMessage);
  }
  return payload.data as T;
}

/* ------------------------------------------------------------------ */
/*  Content item row (shared between both tabs)                        */
/* ------------------------------------------------------------------ */

function ContentItemRow({
  item,
  isSelected,
  isInCurriculum,
  onToggle,
  showCourse,
}: {
  item: ContentOption;
  isSelected: boolean;
  isInCurriculum: boolean;
  onToggle: () => void;
  showCourse?: boolean;
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
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-4 w-4 text-slate-400" />
          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
          <Badge variant="info">{item.contentType}</Badge>
          <Badge variant="info">{item.status}</Badge>
          {isInCurriculum ? <Badge variant="default">Already added</Badge> : null}
        </div>
        <p className="text-xs text-slate-500">
          {showCourse && item.courseName ? `${item.courseName} · ` : ""}
          {item.folderName ? `Folder: ${item.folderName}` : "Library root"}
        </p>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function CurriculumContentPickerDialog({
  open,
  onOpenChange,
  courseId,
  items,
  folders,
  isLoading,
  isSaving,
  canCreateContent,
  existingContentIds,
  onSubmit,
  onContentCreated,
}: CurriculumContentPickerDialogProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("course");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isRequired, setIsRequired] = useState(false);
  const [expandedFolderIds, setExpandedFolderIds] = useState<string[]>([]);
  const [addContentOpen, setAddContentOpen] = useState(false);
  const [addFolderOpen, setAddFolderOpen] = useState(false);

  // "All" tab data
  const [allCourses, setAllCourses] = useState<AllCourseOption[]>([]);
  const [allContent, setAllContent] = useState<ContentOption[]>([]);
  const [allFolders, setAllFolders] = useState<ContentFolderOption[]>([]);
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [allDataLoaded, setAllDataLoaded] = useState(false);
  const [expandedCourseIds, setExpandedCourseIds] = useState<string[]>([]);
  const [expandedAllFolderIds, setExpandedAllFolderIds] = useState<string[]>([]);

  // Import state
  const [isImporting, setIsImporting] = useState(false);

  const existingIdSet = useMemo(() => new Set(existingContentIds), [existingContentIds]);

  useEffect(() => {
    setExpandedFolderIds(folders.map((folder) => folder.id));
  }, [folders]);

  useEffect(() => {
    if (!open) {
      setSearchTerm("");
      setSelectedIds([]);
      setIsRequired(false);
      setAddContentOpen(false);
      setAddFolderOpen(false);
      setActiveTab("course");
      setAllDataLoaded(false);
      setAllCourses([]);
      setAllContent([]);
      setAllFolders([]);
      setExpandedCourseIds([]);
      setExpandedAllFolderIds([]);
    }
  }, [open]);

  /* ---------------------------------------------------------------- */
  /*  Load "All Repository Content" on tab switch                      */
  /* ---------------------------------------------------------------- */

  const loadAllContent = useCallback(async () => {
    if (allDataLoaded || isLoadingAll) return;
    setIsLoadingAll(true);
    try {
      const [coursesRes, contentRes, foldersRes] = await Promise.allSettled([
        fetch("/api/courses", { cache: "no-store" }).then((r) =>
          readPickerApiData<Array<{ id: string; name: string }>>(r, "Failed to load courses."),
        ),
        fetch("/api/course-content", { cache: "no-store" }).then((r) =>
          readPickerApiData<Array<ContentOption>>(r, "Failed to load content."),
        ),
        fetch("/api/course-content-folders", { cache: "no-store" }).then((r) =>
          readPickerApiData<Array<ContentFolderOption>>(r, "Failed to load folders."),
        ),
      ]);
      if (coursesRes.status === "fulfilled") setAllCourses(coursesRes.value);
      if (contentRes.status === "fulfilled") setAllContent(contentRes.value.filter((c) => c.status !== "ARCHIVED"));
      if (foldersRes.status === "fulfilled") setAllFolders(foldersRes.value);
      setAllDataLoaded(true);
    } catch {
      toast.error("Failed to load repository content.");
    } finally {
      setIsLoadingAll(false);
    }
  }, [allDataLoaded, isLoadingAll]);

  useEffect(() => {
    if (activeTab === "all" && !allDataLoaded) {
      void loadAllContent();
    }
  }, [activeTab, allDataLoaded, loadAllContent]);

  /* ---------------------------------------------------------------- */
  /*  Filtering (Course tab)                                           */
  /* ---------------------------------------------------------------- */

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const visibleItems = useMemo(
    () =>
      items.filter((item) => {
        if (!normalizedSearch) return true;
        return [item.title, item.folderName, item.contentType, item.status]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(normalizedSearch));
      }),
    [items, normalizedSearch],
  );

  const rootItems = visibleItems.filter((item) => !item.folderId);
  const folderSections = folders
    .map((folder) => ({
      folder,
      items: visibleItems.filter((item) => item.folderId === folder.id),
    }))
    .filter(
      (section) =>
        section.items.length > 0 ||
        (!normalizedSearch && items.some((item) => item.folderId === section.folder.id)),
    );

  const allVisibleIds = visibleItems.filter((item) => !existingIdSet.has(item.id)).map((item) => item.id);

  /* ---------------------------------------------------------------- */
  /*  Filtering (All tab) — group by course → folder → item            */
  /* ---------------------------------------------------------------- */

  const allTabTree = useMemo(() => {
    if (activeTab !== "all") return [];
    const contentByCourse = new Map<string, ContentOption[]>();
    for (const c of allContent) {
      const cid = c.courseId ?? "";
      if (!contentByCourse.has(cid)) contentByCourse.set(cid, []);
      contentByCourse.get(cid)!.push(c);
    }

    return allCourses
      .map((course) => {
        const courseContent = (contentByCourse.get(course.id) ?? []).filter((item) => {
          if (!normalizedSearch) return true;
          return [item.title, item.folderName, item.contentType, item.status, course.name]
            .filter(Boolean)
            .some((v) => v!.toLowerCase().includes(normalizedSearch));
        });

        const courseRootItems = courseContent.filter((c) => !c.folderId);
        const folderMap = new Map<string, { folder: ContentFolderOption; items: ContentOption[] }>();
        for (const c of courseContent) {
          if (!c.folderId) continue;
          if (!folderMap.has(c.folderId)) {
            const f = allFolders.find((folder) => folder.id === c.folderId);
            folderMap.set(c.folderId, {
              folder: f ?? { id: c.folderId, name: c.folderName ?? "Unknown Folder", contentCount: 0 },
              items: [],
            });
          }
          folderMap.get(c.folderId)!.items.push(c);
        }

        return {
          course,
          rootItems: courseRootItems,
          folderSections: Array.from(folderMap.values()),
          totalVisible: courseContent.length,
          isCurrentCourse: course.id === courseId,
        };
      })
      .filter((entry) => entry.totalVisible > 0);
  }, [activeTab, allCourses, allContent, allFolders, courseId, normalizedSearch]);

  const allTabVisibleIds = useMemo(() => {
    if (activeTab !== "all") return [];
    return allTabTree.flatMap((entry) => [
      ...entry.rootItems.filter((item) => !existingIdSet.has(item.id)).map((item) => item.id),
      ...entry.folderSections.flatMap((s) => s.items.filter((item) => !existingIdSet.has(item.id)).map((item) => item.id)),
    ]);
  }, [activeTab, allTabTree, existingIdSet]);

  /* ---------------------------------------------------------------- */
  /*  Selection helpers                                                */
  /* ---------------------------------------------------------------- */

  const toggleSelection = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id],
    );
  };

  const toggleFolderExpanded = (folderId: string) => {
    setExpandedFolderIds((current) =>
      current.includes(folderId) ? current.filter((id) => id !== folderId) : [...current, folderId],
    );
  };

  const toggleCourseExpanded = (targetCourseId: string) => {
    setExpandedCourseIds((current) =>
      current.includes(targetCourseId) ? current.filter((id) => id !== targetCourseId) : [...current, targetCourseId],
    );
  };

  const toggleAllFolderExpanded = (folderId: string) => {
    setExpandedAllFolderIds((current) =>
      current.includes(folderId) ? current.filter((id) => id !== folderId) : [...current, folderId],
    );
  };

  /* ---------------------------------------------------------------- */
  /*  Submit handler with import logic                                 */
  /* ---------------------------------------------------------------- */

  const handleConfirm = async () => {
    if (activeTab === "course") {
      const ok = await onSubmit({ contentIds: selectedIds, isRequired });
      if (ok) onOpenChange(false);
      return;
    }

    // "All" tab — separate same-course from external-course items
    const sameCourseIds: string[] = [];
    const externalIds: string[] = [];

    for (const id of selectedIds) {
      const content = allContent.find((c) => c.id === id);
      if (!content) continue;
      if (content.courseId === courseId) {
        sameCourseIds.push(id);
      } else {
        externalIds.push(id);
      }
    }

    let clonedIds: string[] = [];
    if (externalIds.length > 0) {
      setIsImporting(true);
      try {
        const response = await fetch("/api/course-content/clone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceContentIds: externalIds,
            targetCourseId: courseId,
          }),
        });
        const payload = (await response.json()) as { data?: Array<{ id: string }>; error?: string };
        if (!response.ok || !payload.data) {
          throw new Error(payload.error || "Failed to import external content.");
        }
        clonedIds = payload.data.map((c) => c.id);
        toast.success(`${clonedIds.length} content item(s) imported from other courses.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to import content.");
        setIsImporting(false);
        return;
      } finally {
        setIsImporting(false);
      }
    }

    const finalIds = [...sameCourseIds, ...clonedIds];
    if (finalIds.length === 0) {
      toast.error("No content to add.");
      return;
    }

    // Refresh course content so cloned items are found by the stage-items service
    if (clonedIds.length > 0) {
      await onContentCreated();
    }

    const ok = await onSubmit({ contentIds: finalIds, isRequired });
    if (ok) onOpenChange(false);
  };

  /* ---------------------------------------------------------------- */
  /*  Derived counts                                                   */
  /* ---------------------------------------------------------------- */

  const externalSelectedCount = useMemo(() => {
    if (activeTab !== "all") return 0;
    return selectedIds.filter((id) => {
      const c = allContent.find((item) => item.id === id);
      return c && c.courseId !== courseId;
    }).length;
  }, [activeTab, allContent, courseId, selectedIds]);

  const isSubmitting = isSaving || isImporting;

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <>
      <CurriculumReferencePickerDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Add Content to Stage"
        description="Browse content from this course or the full repository. Select items, then add them to this curriculum stage."
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        searchPlaceholder={activeTab === "course" ? "Search content, folder, type, or status" : "Search all courses, folders, or content"}
        selectedCount={selectedIds.length}
        confirmLabel={
          externalSelectedCount > 0
            ? `Import & Add (${selectedIds.length})`
            : `Add Content${selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}`
        }
        isConfirmDisabled={selectedIds.length === 0 || isSubmitting}
        isSubmitting={isSubmitting}
        onConfirm={() => void handleConfirm()}
        actions={
          <>
            {activeTab === "course" ? (
              <>
                <Button type="button" variant="ghost" size="sm" disabled={allVisibleIds.length === 0} onClick={() => setSelectedIds(Array.from(new Set([...selectedIds, ...allVisibleIds])))}>
                  Select visible
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled={selectedIds.length === 0} onClick={() => setSelectedIds([])}>
                  Clear
                </Button>
                {canCreateContent ? (
                  <>
                    <Button type="button" variant="secondary" size="sm" onClick={() => setAddFolderOpen(true)}>
                      <FolderPlus className="h-4 w-4" />
                      New Folder
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={() => setAddContentOpen(true)}>
                      <Plus className="h-4 w-4" />
                      Add Content
                    </Button>
                  </>
                ) : null}
              </>
            ) : (
              <>
                <Button type="button" variant="ghost" size="sm" disabled={allTabVisibleIds.length === 0} onClick={() => setSelectedIds(Array.from(new Set([...selectedIds, ...allTabVisibleIds])))}>
                  Select visible
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled={selectedIds.length === 0} onClick={() => setSelectedIds([])}>
                  Clear
                </Button>
              </>
            )}
          </>
        }
        footerContent={
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <Checkbox checked={isRequired} onCheckedChange={(checked) => setIsRequired(checked === true)} disabled={isSubmitting} />
              Mark every selected content item as required.
            </label>
            {externalSelectedCount > 0 ? (
              <p className="text-xs text-amber-600">
                {externalSelectedCount} item(s) will be imported (cloned) from other courses into this course.
              </p>
            ) : null}
          </div>
        }
      >
        {/* Tab switcher */}
        <div className="mb-4 flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              activeTab === "course" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700",
            )}
            onClick={() => { setActiveTab("course"); setSelectedIds([]); }}
          >
            Course Content
          </button>
          <button
            type="button"
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              activeTab === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700",
            )}
            onClick={() => { setActiveTab("all"); setSelectedIds([]); }}
          >
            <span className="inline-flex items-center gap-1.5">
              <Library className="h-3.5 w-3.5" />
              All Repository Content
            </span>
          </button>
        </div>

        {/* ============================================================ */}
        {/* COURSE TAB                                                    */}
        {/* ============================================================ */}
        {activeTab === "course" ? (
          isLoading ? (
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
                      <ContentItemRow
                        key={item.id}
                        item={item}
                        isSelected={selectedIds.includes(item.id)}
                        isInCurriculum={existingIdSet.has(item.id)}
                        onToggle={() => toggleSelection(item.id)}
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
                            <ContentItemRow
                              key={item.id}
                              item={item}
                              isSelected={selectedIds.includes(item.id)}
                              isInCurriculum={existingIdSet.has(item.id)}
                              onToggle={() => toggleSelection(item.id)}
                            />
                          ))}
                        </div>
                      )
                    ) : null}
                  </div>
                );
              })}
            </div>
          )
        ) : null}

        {/* ============================================================ */}
        {/* ALL REPOSITORY CONTENT TAB                                    */}
        {/* ============================================================ */}
        {activeTab === "all" ? (
          isLoadingAll ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-20 w-full rounded-2xl" />
            </div>
          ) : allTabTree.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-sm text-slate-500">
              {normalizedSearch ? "No content matches the current search across all courses." : "No content is available in the repository yet."}
            </div>
          ) : (
            <div className="space-y-4">
              {allTabTree.map((entry) => {
                const isCourseExpanded = expandedCourseIds.includes(entry.course.id);
                return (
                  <div key={entry.course.id} className="rounded-2xl border border-slate-200 bg-white">
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left"
                      onClick={() => toggleCourseExpanded(entry.course.id)}
                    >
                      {isCourseExpanded ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{entry.course.name}</p>
                          <Badge variant="info">{entry.totalVisible}</Badge>
                          {entry.isCurrentCourse ? <Badge variant="default">This course</Badge> : null}
                        </div>
                      </div>
                    </button>

                    {isCourseExpanded ? (
                      <div className="space-y-0 divide-y divide-slate-50">
                        {entry.rootItems.length > 0 ? (
                          <div className="divide-y divide-slate-100">
                            {entry.rootItems.map((item) => (
                              <ContentItemRow
                                key={item.id}
                                item={item}
                                isSelected={selectedIds.includes(item.id)}
                                isInCurriculum={existingIdSet.has(item.id)}
                                onToggle={() => toggleSelection(item.id)}
                              />
                            ))}
                          </div>
                        ) : null}

                        {entry.folderSections.map((fs) => {
                          const isFolderExpanded = expandedAllFolderIds.includes(fs.folder.id);
                          return (
                            <div key={fs.folder.id}>
                              <button
                                type="button"
                                className="flex w-full items-center gap-3 bg-slate-50/50 px-6 py-2.5 text-left"
                                onClick={() => toggleAllFolderExpanded(fs.folder.id)}
                              >
                                {isFolderExpanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                                <Folder className="h-3.5 w-3.5 text-slate-400" />
                                <p className="text-xs font-semibold text-slate-700">{fs.folder.name}</p>
                                <Badge variant="info" className="text-[10px]">{fs.items.length}</Badge>
                              </button>
                              {isFolderExpanded ? (
                                <div className="divide-y divide-slate-100">
                                  {fs.items.map((item) => (
                                    <ContentItemRow
                                      key={item.id}
                                      item={item}
                                      isSelected={selectedIds.includes(item.id)}
                                      isInCurriculum={existingIdSet.has(item.id)}
                                      onToggle={() => toggleSelection(item.id)}
                                    />
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )
        ) : null}
      </CurriculumReferencePickerDialog>

      {courseId ? (
        <>
          <AddContentSheet
            open={addContentOpen}
            onOpenChange={setAddContentOpen}
            courseId={courseId}
            folders={folders}
            onCreated={() => {
              void onContentCreated();
            }}
          />
          <AddContentFolderSheet
            open={addFolderOpen}
            onOpenChange={setAddFolderOpen}
            courseId={courseId}
            onSaved={() => {
              void onContentCreated();
            }}
          />
        </>
      ) : null}
    </>
  );
}