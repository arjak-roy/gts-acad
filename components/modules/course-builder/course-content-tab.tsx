"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, MoreHorizontal, PencilLine, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/ui/can-access";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

export type CourseContentItem = {
  id: string;
  courseId: string;
  courseName: string;
  folderId: string | null;
  folderName: string | null;
  title: string;
  description: string | null;
  excerpt: string | null;
  contentType: string;
  estimatedReadingMinutes: number | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  storagePath: string | null;
  storageProvider: string | null;
  sortOrder: number;
  status: string;
  isScorm: boolean;
  createdAt: string;
};

const contentTypeLabels: Record<string, string> = {
  ARTICLE: "Authored Lesson",
  PDF: "PDF",
  DOCUMENT: "Document",
  VIDEO: "Video",
  SCORM: "SCORM",
  LINK: "Link",
  OTHER: "Other",
};

const statusVariant: Record<string, "default" | "info" | "warning"> = {
  DRAFT: "info",
  PUBLISHED: "default",
  ARCHIVED: "warning",
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CourseContentTab({
  courseId,
  folderId,
  folderName,
  onAddContent,
  onViewContent,
  onEditContent,
  onDeleteContent,
}: {
  courseId: string;
  folderId?: string;
  folderName?: string | null;
  onAddContent: () => void;
  onViewContent: (contentId: string) => void;
  onEditContent: (contentId: string) => void;
  onDeleteContent: (content: CourseContentItem) => void;
}) {
  const [contents, setContents] = useState<CourseContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchContents = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (courseId) {
        params.set("courseId", courseId);
      }
      if (folderId) {
        params.set("folderId", folderId);
      }

      const url = params.size > 0 ? `/api/course-content?${params.toString()}` : "/api/course-content";
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load content.");
      const result = (await response.json()) as { data?: CourseContentItem[] };
      setContents(result.data ?? []);
    } catch {
      toast.error("Failed to load course content.");
    } finally {
      setIsLoading(false);
    }
  }, [courseId, folderId]);

  useEffect(() => {
    if (courseId) void fetchContents();
  }, [courseId, fetchContents]);

  if (!courseId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-sm">Select a course to view its content library.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const published = contents.filter((c) => c.status === "PUBLISHED").length;
  const drafts = contents.filter((c) => c.status === "DRAFT").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {contents.length} item{contents.length !== 1 ? "s" : ""} · {published} published · {drafts} draft{drafts !== 1 ? "s" : ""}
            {folderName ? ` · Folder: ${folderName}` : ""}
          </p>
        </div>
        <CanAccess permission="course_content.create">
          <Button size="sm" onClick={onAddContent}>
            Upload Content
          </Button>
        </CanAccess>
      </div>

      {contents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-muted-foreground">
          <p className="text-sm">No content items yet.</p>
          <p className="text-xs mt-1">Upload PDFs, documents, or other materials for this course.</p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {contents.map((content) => (
            <div key={content.id} className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/50">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => onViewContent(content.id)}
              >
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{content.title}</span>
                  {!folderId && content.folderName ? (
                    <Badge variant="info" className="text-[10px] px-1.5 py-0">
                      {content.folderName}
                    </Badge>
                  ) : null}
                  {content.isScorm && (
                    <Badge variant="accent" className="text-[10px] px-1.5 py-0">
                      SCORM — Coming Soon
                    </Badge>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{contentTypeLabels[content.contentType] ?? content.contentType}</span>
                  {content.estimatedReadingMinutes ? <span>· {content.estimatedReadingMinutes} min read</span> : null}
                  {content.fileName && <span>· {content.fileName}</span>}
                  {content.fileSize && <span>· {formatFileSize(content.fileSize)}</span>}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                  {content.excerpt || content.description || "No description yet."}
                </p>
              </button>
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant[content.status] ?? "info"} className="shrink-0">
                  {content.status}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Open content actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <CanAccess permission="course_content.edit">
                      <DropdownMenuItem onSelect={() => onEditContent(content.id)}>
                        <PencilLine className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                    </CanAccess>
                    <DropdownMenuItem onSelect={() => onViewContent(content.id)}>
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </DropdownMenuItem>
                    <CanAccess permission="course_content.delete">
                      <DropdownMenuItem className="text-rose-700 focus:bg-rose-50 focus:text-rose-700" onSelect={() => onDeleteContent(content)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </CanAccess>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
