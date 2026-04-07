"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ExternalLink, Folder, FolderOpen, FolderPlus, HardDrive, Info, MoreHorizontal, Search } from "lucide-react";
import { toast } from "sonner";

import { BuilderSectionRibbon, type BuilderShellSection } from "@/components/modules/builders/builder-shell";
import { AddContentFolderSheet } from "@/components/modules/course-builder/add-content-folder-sheet";
import { AddContentSheet } from "@/components/modules/course-builder/add-content-sheet";
import { CourseContentDetailSheet } from "@/components/modules/course-builder/course-content-detail-sheet";
import { CourseContentTab, type CourseContentItem } from "@/components/modules/course-builder/course-content-tab";
import { EditContentSheet } from "@/components/modules/course-builder/edit-content-sheet";
import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/ui/can-access";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type CourseOption = {
  id: string;
  name: string;
  isActive: boolean;
};

type FolderOption = {
  id: string;
  courseId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  contentCount: number;
  createdAt: string;
};

const selectClassName = "block w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84]";

const explorerQueryKeys = {
  course: "course",
  folder: "folder",
};

const contentManagerSections: BuilderShellSection[] = [
  {
    href: "/course-builder/content",
    label: "Content Library",
    description: "Organize folders, upload assets, and keep course materials easy to source.",
  },
  {
    href: "/course-builder/batch-mapping",
    label: "Batch Mapping",
    description: "Assign approved content and assessments to live batches in a cleaner operational workspace.",
  },
];

function parseExplorerQuery(search: string) {
  const params = new URLSearchParams(search);
  return {
    courseId: params.get(explorerQueryKeys.course) ?? "",
    folderId: params.get(explorerQueryKeys.folder) ?? "",
  };
}

function buildExplorerQuery(courseId: string, folderId: string) {
  const params = new URLSearchParams();

  if (courseId) {
    params.set(explorerQueryKeys.course, courseId);
  }

  if (courseId && folderId) {
    params.set(explorerQueryKeys.folder, folderId);
  }

  return params.toString();
}

export default function ContentLibraryPage() {
  const router = useRouter();
  const pathname = usePathname();
  const tooltipId = useId();
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [isQueryReady, setIsQueryReady] = useState(false);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [addFolderSheetOpen, setAddFolderSheetOpen] = useState(false);
  const [viewingContentId, setViewingContentId] = useState<string | null>(null);
  const [editingContentId, setEditingContentId] = useState<string | null>(null);
  const [contentPendingDelete, setContentPendingDelete] = useState<CourseContentItem | null>(null);
  const [editingFolder, setEditingFolder] = useState<FolderOption | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [folderSearch, setFolderSearch] = useState("");
  const [isWorkflowTooltipOpen, setIsWorkflowTooltipOpen] = useState(false);
  const [openFolderInfoId, setOpenFolderInfoId] = useState<string | null>(null);
  const [isDeletingContent, setIsDeletingContent] = useState(false);

  const selectedCourse = courses.find((course) => course.id === selectedCourseId) ?? null;
  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId) ?? null;
  const filteredFolders = useMemo(() => {
    const normalized = folderSearch.trim().toLowerCase();
    if (!normalized) {
      return folders;
    }

    return folders.filter((folder) => {
      const source = `${folder.name} ${folder.description ?? ""}`.toLowerCase();
      return source.includes(normalized);
    });
  }, [folderSearch, folders]);

  const totalFolderContentCount = useMemo(
    () => filteredFolders.reduce((sum, folder) => sum + folder.contentCount, 0),
    [filteredFolders],
  );

  const totalContentCount = useMemo(
    () => folders.reduce((sum, folder) => sum + folder.contentCount, 0),
    [folders],
  );

  const loadCourses = useCallback(async () => {
    setIsLoadingCourses(true);

    try {
      const response = await fetch("/api/courses", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load courses.");
      }

      const result = (await response.json()) as { data?: CourseOption[] };
      const active = (result.data ?? []).filter((course) => course.isActive);
      setCourses(active);

      setSelectedCourseId((current) => {
        if (current && active.some((course) => course.id === current)) {
          return current;
        }

        return active[0]?.id ?? "";
      });
    } catch {
      toast.error("Failed to load courses.");
    } finally {
      setIsLoadingCourses(false);
    }
  }, []);

  const loadFolders = useCallback(async (courseId: string) => {
    if (!courseId) {
      setFolders([]);
      setSelectedFolderId("");
      return;
    }

    setIsLoadingFolders(true);

    try {
      const response = await fetch(`/api/course-content-folders?courseId=${courseId}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load folders.");
      }

      const result = (await response.json()) as { data?: FolderOption[] };
      const nextFolders = result.data ?? [];
      setFolders(nextFolders);
      setSelectedFolderId((current) => (nextFolders.some((folder) => folder.id === current) ? current : ""));
    } catch {
      toast.error("Failed to load content folders.");
      setFolders([]);
      setSelectedFolderId("");
    } finally {
      setIsLoadingFolders(false);
    }
  }, []);

  useEffect(() => {
    const { courseId, folderId } = parseExplorerQuery(window.location.search);

    if (courseId) {
      setSelectedCourseId(courseId);
    }

    if (folderId) {
      setSelectedFolderId(folderId);
    }

    setIsQueryReady(true);
  }, []);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    if (!selectedCourseId) {
      setFolders([]);
      setSelectedFolderId("");
      return;
    }

    void loadFolders(selectedCourseId);
  }, [loadFolders, selectedCourseId]);

  useEffect(() => {
    if (!isQueryReady) {
      return;
    }

    const nextQuery = buildExplorerQuery(selectedCourseId, selectedFolderId);
    const currentQuery = window.location.search.startsWith("?")
      ? window.location.search.slice(1)
      : window.location.search;

    if (nextQuery === currentQuery) {
      return;
    }

    const nextHref = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.replace(nextHref, { scroll: false });
  }, [isQueryReady, pathname, router, selectedCourseId, selectedFolderId]);

  const handleContentCreated = () => {
    setRefreshKey((previous) => previous + 1);
  };

  const handleFolderSaved = async (folderId: string) => {
    const shouldPreserveSelection = !editingFolder || selectedFolderId === editingFolder.id;
    await loadFolders(selectedCourseId);
    if (shouldPreserveSelection) {
      setSelectedFolderId(folderId);
    }
    setRefreshKey((previous) => previous + 1);
  };

  const handleContentUpdated = () => {
    setRefreshKey((previous) => previous + 1);
  };

  const handleDeleteContent = async () => {
    if (!contentPendingDelete) {
      return;
    }

    setIsDeletingContent(true);

    try {
      const response = await fetch(`/api/course-content/${contentPendingDelete.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to delete content.");
      }

      toast.success("Content deleted.");
      setViewingContentId((current) => (current === contentPendingDelete.id ? null : current));
      setEditingContentId((current) => (current === contentPendingDelete.id ? null : current));
      setContentPendingDelete(null);
      setRefreshKey((previous) => previous + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete content.");
    } finally {
      setIsDeletingContent(false);
    }
  };

  const handleFolderSheetOpenChange = (open: boolean) => {
    setAddFolderSheetOpen(open);
    if (!open) {
      setEditingFolder(null);
    }
  };

  const clearExplorerFilters = () => {
    setSelectedFolderId("");
    setFolderSearch("");
    setViewingContentId(null);
    setOpenFolderInfoId(null);
  };

  const closeTooltipOnBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsWorkflowTooltipOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[26px] border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-4">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-1.5">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Workspace</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 lg:text-[1.7rem]">Content Manager</h1>
            <p className="max-w-2xl text-sm leading-5 text-slate-600">
              Run the source-of-truth workspace for course content and batch mappings. Keep upload operations structured, searchable, and ready for curriculum and batch delivery.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={clearExplorerFilters} disabled={!selectedFolderId && !folderSearch.trim()}>
              Clear filters
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href="/assessments">
                <ExternalLink className="h-4 w-4" />
                Assessments
              </Link>
            </Button>
            <div
              className="relative"
              onMouseEnter={() => setIsWorkflowTooltipOpen(true)}
              onMouseLeave={() => setIsWorkflowTooltipOpen(false)}
              onFocus={() => setIsWorkflowTooltipOpen(true)}
              onBlur={closeTooltipOnBlur}
            >
              <button
                type="button"
                aria-label="Recommended workflow"
                aria-expanded={isWorkflowTooltipOpen}
                aria-controls={tooltipId}
                aria-describedby={isWorkflowTooltipOpen ? tooltipId : undefined}
                title="Recommended workflow"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#dde1e6] bg-white text-slate-500 shadow-sm transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84] focus-visible:ring-offset-1"
                onClick={() => setIsWorkflowTooltipOpen((current) => !current)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setIsWorkflowTooltipOpen(false);
                  }
                }}
              >
                <Info className="h-4 w-4" />
              </button>
              <div
                id={tooltipId}
                role="tooltip"
                className={cn(
                  "absolute right-0 top-11 z-30 w-72 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-xl transition-all duration-150",
                  isWorkflowTooltipOpen
                    ? "translate-y-0 opacity-100"
                    : "pointer-events-none -translate-y-1 opacity-0",
                )}
              >
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Recommended Flow</p>
                <p className="mt-2">1. Curate folders and upload content in Content Library.</p>
                <p className="mt-1">2. Prepare reusable assessments from the Assessments workspace.</p>
                <p className="mt-1">3. Use Batch Mapping to assign ready materials to delivery cohorts.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 border-b border-slate-100 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-1.5">
            <p className="text-[8px] font-black uppercase tracking-[0.22em] text-slate-400">Tool Ribbon</p>
            <BuilderSectionRibbon sections={contentManagerSections} />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 lg:max-w-[320px]">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Current Route</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">
              {selectedCourse?.name ?? "No course selected"} / {selectedFolder?.name ?? "All folders"}
            </p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              {isLoadingFolders
                ? "Refreshing folder inventory..."
                : `${filteredFolders.length} visible folder${filteredFolders.length === 1 ? "" : "s"} and ${totalFolderContentCount} indexed item${totalFolderContentCount === 1 ? "" : "s"}.`}
            </p>
          </div>
        </div>

        <div className="grid gap-2 pt-3 lg:max-w-[280px]">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Course Scope</label>
            <select
              value={selectedCourseId}
              onChange={(event) => {
                setSelectedCourseId(event.target.value);
                setSelectedFolderId("");
                setViewingContentId(null);
              }}
              className={selectClassName}
              disabled={isLoadingCourses}
            >
              <option value="">Select a course...</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>{course.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div className="space-y-1.5">
                <CardTitle>File Explorer</CardTitle>
                <CardDescription>Route uploads, search folders, and manage folder naming without leaving the library.</CardDescription>
              </div>
              <CanAccess permission="course_content_folder.create">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setEditingFolder(null);
                    setAddFolderSheetOpen(true);
                  }}
                  disabled={!selectedCourseId}
                >
                  <FolderPlus className="h-4 w-4" />
                  New Folder
                </Button>
              </CanAccess>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Folder Search</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={folderSearch}
                    onChange={(event) => setFolderSearch(event.target.value)}
                    placeholder="Search folders"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-[#dde1e6] bg-white">
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left text-sm transition-colors",
                    selectedFolderId === ""
                      ? "bg-primary/5 text-primary"
                      : "text-slate-700 hover:bg-slate-50",
                  )}
                  onClick={() => {
                    setSelectedFolderId("");
                    setOpenFolderInfoId(null);
                  }}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <HardDrive className="h-4 w-4" />
                    {selectedCourse?.name ?? "Course Library"}
                  </span>
                  <span className="text-xs text-slate-500">{totalContentCount}</span>
                </button>

                <div className="max-h-[340px] overflow-y-auto">
                  {isLoadingFolders ? (
                    <div className="space-y-2 p-3">
                      <Skeleton className="h-9 w-full rounded-xl" />
                      <Skeleton className="h-9 w-full rounded-xl" />
                      <Skeleton className="h-9 w-full rounded-xl" />
                    </div>
                  ) : filteredFolders.length > 0 ? (
                    <div className="space-y-1 p-2">
                      {filteredFolders.map((folder) => {
                        const isActive = selectedFolderId === folder.id;
                        const infoMessage = folder.description?.trim() || "No folder description added yet.";
                        return (
                          <div
                            key={folder.id}
                            className={cn(
                              "rounded-xl",
                              isActive ? "bg-primary/5" : "hover:bg-slate-50",
                            )}
                          >
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className={cn(
                                  "flex min-w-0 flex-1 items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors",
                                  isActive
                                    ? "text-primary"
                                    : "text-slate-700",
                                )}
                                onClick={() => {
                                  setSelectedFolderId(folder.id);
                                  setOpenFolderInfoId(null);
                                }}
                              >
                                <span className="flex min-w-0 items-center gap-2 font-medium">
                                  {isActive ? <FolderOpen className="h-4 w-4 shrink-0" /> : <Folder className="h-4 w-4 shrink-0" />}
                                  <span className="truncate">{folder.name}</span>
                                </span>
                                <span className={cn("text-xs", isActive ? "text-primary/80" : "text-slate-500")}>{folder.contentCount}</span>
                              </button>

                              <div className="flex items-center gap-1 pr-1">
                                <button
                                  type="button"
                                  aria-label={`Folder notes for ${folder.name}`}
                                  title="Folder notes"
                                  className={cn(
                                    "inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition-colors",
                                    openFolderInfoId === folder.id || isActive
                                      ? "border-primary/20 bg-white text-primary"
                                      : "border-slate-200 bg-white text-slate-500 hover:border-primary/40 hover:text-primary",
                                  )}
                                  onClick={() => setOpenFolderInfoId((current) => (current === folder.id ? null : folder.id))}
                                >
                                  i
                                </button>

                                <CanAccess permission="course_content_folder.edit">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                        <MoreHorizontal className="h-4 w-4" />
                                        <span className="sr-only">Open folder actions</span>
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        onSelect={() => {
                                          setEditingFolder(folder);
                                          setAddFolderSheetOpen(true);
                                          setOpenFolderInfoId(null);
                                        }}
                                      >
                                        Rename
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </CanAccess>
                              </div>
                            </div>

                            {openFolderInfoId === folder.id ? (
                              <div className="px-3 pb-3 pt-1">
                                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs leading-5 text-slate-600 shadow-sm">
                                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Folder Notes</p>
                                  <p className="mt-2">{infoMessage}</p>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 text-xs text-slate-500">
                      {folders.length === 0
                        ? "No folders yet. Create one to organize content."
                        : "No folders match your search."}
                    </div>
                  )}
                </div>
              </div>

              {!isLoadingFolders && folders.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[#d9e0e7] bg-slate-50/70 px-4 py-3 text-sm text-slate-500">
                  No folders yet. Create one to guide uploads by topic, phase, or ownership.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-[#edf2f7] bg-white/90">
            <CardTitle>Content Inventory</CardTitle>
            <CardDescription>
              Review the current library for {selectedCourse?.name ?? "the selected course"} and open any item for detailed inspection.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {selectedCourseId ? (
              <CourseContentTab
                key={`${selectedCourseId}-${selectedFolderId}-${refreshKey}`}
                courseId={selectedCourseId}
                folderId={selectedFolderId || undefined}
                folderName={selectedFolder?.name ?? null}
                onAddContent={() => setAddSheetOpen(true)}
                onViewContent={(contentId) => setViewingContentId(contentId)}
                onEditContent={(contentId) => setEditingContentId(contentId)}
                onDeleteContent={(content) => setContentPendingDelete(content)}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-[#d9e0e7] bg-slate-50/70 p-10 text-center text-sm text-slate-500">
                Select an active course to open its content library.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedCourseId ? (
        <AddContentSheet
          open={addSheetOpen}
          onOpenChange={setAddSheetOpen}
          courseId={selectedCourseId}
          folders={folders}
          defaultFolderId={selectedFolderId || undefined}
          onCreated={handleContentCreated}
        />
      ) : null}

      {selectedCourseId ? (
        <AddContentFolderSheet
          open={addFolderSheetOpen}
          onOpenChange={handleFolderSheetOpenChange}
          courseId={selectedCourseId}
          folder={editingFolder}
          onSaved={handleFolderSaved}
        />
      ) : null}

      <EditContentSheet
        open={Boolean(editingContentId)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingContentId(null);
          }
        }}
        contentId={editingContentId}
        folders={folders}
        onUpdated={handleContentUpdated}
      />

      <CourseContentDetailSheet
        open={Boolean(viewingContentId)}
        onOpenChange={(open) => {
          if (!open) {
            setViewingContentId(null);
          }
        }}
        contentId={viewingContentId}
        refreshToken={refreshKey}
      />

      {contentPendingDelete ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <p className="text-sm font-semibold text-slate-900">Delete this content item?</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              <span className="font-semibold text-slate-900">{contentPendingDelete.title}</span> will be removed from the library.
              {contentPendingDelete.storagePath
                ? ` Its stored asset will also be deleted from ${contentPendingDelete.storageProvider === "S3" ? "S3" : "local storage"}.`
                : " This item does not have a stored upload behind it."}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Existing batch mappings are removed automatically and curriculum references are detached from this content.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setContentPendingDelete(null)}
                disabled={isDeletingContent}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-rose-600 text-white hover:bg-rose-700"
                onClick={() => void handleDeleteContent()}
                disabled={isDeletingContent}
              >
                {isDeletingContent ? "Deleting..." : "Delete Content"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
