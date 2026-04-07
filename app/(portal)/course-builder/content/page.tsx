"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, ExternalLink, FolderKanban, LibraryBig } from "lucide-react";
import { toast } from "sonner";

import { AddContentFolderSheet } from "@/components/modules/course-builder/add-content-folder-sheet";
import { AddContentSheet } from "@/components/modules/course-builder/add-content-sheet";
import { CourseContentDetailSheet } from "@/components/modules/course-builder/course-content-detail-sheet";
import { CourseContentTab } from "@/components/modules/course-builder/course-content-tab";
import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/ui/can-access";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function ContentLibraryPage() {
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [addFolderSheetOpen, setAddFolderSheetOpen] = useState(false);
  const [viewingContentId, setViewingContentId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const selectedCourse = courses.find((course) => course.id === selectedCourseId) ?? null;
  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId) ?? null;
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

      if (active.length > 0 && !selectedCourseId) {
        setSelectedCourseId(active[0].id);
      }
    } catch {
      toast.error("Failed to load courses.");
    } finally {
      setIsLoadingCourses(false);
    }
  }, [selectedCourseId]);

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

  const handleContentCreated = () => {
    setRefreshKey((previous) => previous + 1);
  };

  const handleFolderCreated = async (folderId: string) => {
    await loadFolders(selectedCourseId);
    setSelectedFolderId(folderId);
    setRefreshKey((previous) => previous + 1);
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-slate-200 bg-[linear-gradient(135deg,_#ffffff_0%,_#f6fbff_52%,_#eef4ff_100%)]">
        <CardContent className="pt-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5">
              <div className="space-y-3">
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Course Builder</p>
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-white text-primary shadow-sm">
                    <LibraryBig className="h-6 w-6" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Content Library</h1>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                      Organize reusable course content by destination folder, keep upload decisions visible, and review the active library without mixing it with assessment management.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Course</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{selectedCourse?.name ?? "Select a course"}</p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Folders</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{isLoadingFolders ? "..." : folders.length}</p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Indexed Items</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{isLoadingFolders ? "..." : totalContentCount}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">Workspace Context</p>
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Course</label>
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

                <div className="rounded-2xl border border-[#e2e8f0] bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
                  <p className="font-semibold text-slate-900">Active destination</p>
                  <p className="mt-1">{selectedFolder ? selectedFolder.name : "All content in the selected course"}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Use folders to keep uploads predictable and make stage mapping easier later in the curriculum builder.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <CanAccess permission="course_content_folder.create">
                    <Button type="button" variant="secondary" onClick={() => setAddFolderSheetOpen(true)} disabled={!selectedCourseId}>
                      New Folder
                    </Button>
                  </CanAccess>
                  <Button asChild variant="ghost">
                    <Link href="/course-builder/assessments">
                      <ExternalLink className="h-4 w-4" />
                      Assessment Pool
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Folder Routing</CardTitle>
              <CardDescription>Choose where new uploads land and how the library inventory is filtered.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingFolders ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full rounded-full" />
                  <Skeleton className="h-10 w-full rounded-full" />
                  <Skeleton className="h-10 w-full rounded-full" />
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                      selectedFolderId === ""
                        ? "border-primary bg-primary text-white"
                        : "border-[#dde1e6] text-slate-600 hover:border-primary/50",
                    )}
                    onClick={() => setSelectedFolderId("")}
                  >
                    All Content
                  </button>
                  {folders.map((folder) => (
                    <button
                      key={folder.id}
                      type="button"
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                        selectedFolderId === folder.id
                          ? "border-primary bg-primary text-white"
                          : "border-[#dde1e6] text-slate-600 hover:border-primary/50",
                      )}
                      onClick={() => setSelectedFolderId(folder.id)}
                    >
                      {folder.name} · {folder.contentCount}
                    </button>
                  ))}
                </div>
              )}

              {!isLoadingFolders && folders.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[#d9e0e7] bg-slate-50/70 px-4 py-3 text-sm text-slate-500">
                  No folders yet. Create one to guide uploads by topic, phase, or ownership.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Selection Summary</CardTitle>
              <CardDescription>Keep the current upload destination and folder notes visible while browsing the library.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-[#e2e8f0] bg-slate-50/80 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <FolderKanban className="h-4 w-4 text-primary" />
                  {selectedFolder ? selectedFolder.name : "All course content"}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {selectedFolder?.description || "No folder-specific notes available. Content will be shown across the full course library."}
                </p>
              </div>

              <div className="rounded-2xl border border-[#e2e8f0] bg-slate-50/80 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Operational flow
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Curate folders first, upload content into the right destination, then move to the curriculum builder once the reusable inventory is stable.
                </p>
              </div>
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
                onSelectContent={(contentId) => setViewingContentId(contentId)}
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
          onOpenChange={setAddFolderSheetOpen}
          courseId={selectedCourseId}
          onCreated={handleFolderCreated}
        />
      ) : null}

      <CourseContentDetailSheet
        open={Boolean(viewingContentId)}
        onOpenChange={(open) => {
          if (!open) {
            setViewingContentId(null);
          }
        }}
        contentId={viewingContentId}
      />
    </div>
  );
}
