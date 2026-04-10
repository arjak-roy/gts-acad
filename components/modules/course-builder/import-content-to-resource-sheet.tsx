"use client";

import { useMemo, useState } from "react";
import { FileText, FolderOpen, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import type { CourseContentItem } from "@/components/modules/course-builder/course-content-tab";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type CourseOption = {
  id: string;
  name: string;
};

type FolderOption = {
  id: string;
  courseId: string;
  name: string;
};

type ImportContentToResourceSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: CourseOption[];
  folders: FolderOption[];
  contents: CourseContentItem[];
  onImported: () => void;
};

function matchesSearch(content: CourseContentItem, search: string) {
  if (!search) {
    return true;
  }

  const haystack = `${content.title} ${content.fileName ?? ""} ${content.description ?? ""} ${content.excerpt ?? ""}`.toLowerCase();
  return haystack.includes(search);
}

export function ImportContentToResourceSheet({
  open,
  onOpenChange,
  courses,
  folders,
  contents,
  onImported,
}: ImportContentToResourceSheetProps) {
  const [search, setSearch] = useState("");
  const [importingContentId, setImportingContentId] = useState<string | null>(null);

  const normalizedSearch = search.trim().toLowerCase();
  const groupedContent = useMemo(() => {
    return courses.map((course) => {
      const courseMatches = course.name.toLowerCase().includes(normalizedSearch);
      const rootContents = contents.filter((content) => content.courseId === course.id && !content.folderId && (courseMatches || matchesSearch(content, normalizedSearch)));
      const groupedFolders = folders
        .filter((folder) => folder.courseId === course.id)
        .map((folder) => ({
          folder,
          contents: contents.filter((content) => content.courseId === course.id && content.folderId === folder.id && (courseMatches || folder.name.toLowerCase().includes(normalizedSearch) || matchesSearch(content, normalizedSearch))),
        }))
        .filter((entry) => entry.contents.length > 0);

      return {
        course,
        rootContents,
        folders: groupedFolders,
      };
    }).filter((entry) => entry.rootContents.length > 0 || entry.folders.length > 0);
  }, [contents, courses, folders, normalizedSearch]);

  const handleImport = async (contentId: string) => {
    setImportingContentId(contentId);

    try {
      const response = await fetch("/api/learning-resources/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ contentId }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to import content into the repository.");
      }

      toast.success("Content imported into the repository.");
      onImported();
      onOpenChange(false);
      setSearch("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to import content into the repository.");
    } finally {
      setImportingContentId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[860px]">
        <SheetHeader>
          <SheetTitle>Import From Content Library</SheetTitle>
          <SheetDescription>
            Browse the course explorer and copy any content item into the reusable repository.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-1 py-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Search library content</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
                placeholder="Search by course, folder, title, or file name"
              />
            </div>
          </div>

          <div className="max-h-[68vh] space-y-4 overflow-y-auto pr-1">
            {groupedContent.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center text-sm text-slate-500">
                No content items match the current search.
              </div>
            ) : (
              groupedContent.map((entry) => (
                <div key={entry.course.id} className="rounded-2xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-950">{entry.course.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{entry.rootContents.length + entry.folders.reduce((sum, folder) => sum + folder.contents.length, 0)} content item(s) available for import.</p>
                  </div>

                  <div className="space-y-4 p-4">
                    {entry.rootContents.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Course root</p>
                        <div className="space-y-2">
                          {entry.rootContents.map((content) => (
                            <div key={content.id} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 px-3 py-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <FileText className="h-4 w-4 text-primary" />
                                  <p className="truncate text-sm font-semibold text-slate-900">{content.title}</p>
                                  <Badge variant="info">{content.contentType}</Badge>
                                  <Badge variant={content.status === "PUBLISHED" ? "default" : "info"}>{content.status}</Badge>
                                </div>
                                <p className="mt-1 text-xs text-slate-500">{content.fileName ?? content.excerpt ?? content.description ?? "Authored content item"}</p>
                              </div>
                              <Button type="button" size="sm" onClick={() => void handleImport(content.id)} disabled={importingContentId === content.id}>
                                {importingContentId === content.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                Import
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {entry.folders.map((folderEntry) => (
                      <div key={folderEntry.folder.id} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <FolderOpen className="h-4 w-4 text-slate-500" />
                          <p className="text-sm font-semibold text-slate-800">{folderEntry.folder.name}</p>
                          <Badge variant="accent">{folderEntry.contents.length}</Badge>
                        </div>
                        <div className="space-y-2 pl-6">
                          {folderEntry.contents.map((content) => (
                            <div key={content.id} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 px-3 py-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <FileText className="h-4 w-4 text-primary" />
                                  <p className="truncate text-sm font-semibold text-slate-900">{content.title}</p>
                                  <Badge variant="info">{content.contentType}</Badge>
                                  <Badge variant={content.status === "PUBLISHED" ? "default" : "info"}>{content.status}</Badge>
                                </div>
                                <p className="mt-1 text-xs text-slate-500">{content.fileName ?? content.excerpt ?? content.description ?? "Authored content item"}</p>
                              </div>
                              <Button type="button" size="sm" onClick={() => void handleImport(content.id)} disabled={importingContentId === content.id}>
                                {importingContentId === content.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                Import
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}