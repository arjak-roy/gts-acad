"use client";

import { Download, Eye, History, MoreHorizontal, PencilLine, Share2, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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
  resourceId?: string;
  sourceCourseId?: string;
  sourceCourseName?: string;
  sourceFolderId?: string | null;
  sourceFolderName?: string | null;
  resourceStatus?: string;
  resourceVisibility?: string;
  assignedAt?: string;
  isSharedAssignment?: boolean;
  shareKind?: "COURSE_ASSIGNMENT";
};

export type LinkedRepositoryResourceSummary = {
  id: string;
  sourceContentId: string;
  status: string;
  tagNames: string[];
  currentVersionNumber: number;
  assignmentCount: number;
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
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CourseContentTab({
  items,
  folderName,
  linkedResources = {},
  onAddContent,
  onViewContent,
  onEditContent,
  onDeleteContent,
  onViewRepositoryResource,
  onEditRepositoryResource,
  onViewRepositoryHistory,
  onManageRepositoryAssignments,
  canCreateContent,
  canEditContent,
  canDeleteContent,
}: {
  items: CourseContentItem[];
  folderName?: string | null;
  linkedResources?: Record<string, LinkedRepositoryResourceSummary>;
  onAddContent: () => void;
  onViewContent: (contentId: string) => void;
  onEditContent: (contentId: string) => void;
  onDeleteContent: (content: CourseContentItem) => void;
  onViewRepositoryResource?: (resourceId: string) => void;
  onEditRepositoryResource?: (resourceId: string) => void;
  onViewRepositoryHistory?: (resourceId: string, resourceTitle: string) => void;
  onManageRepositoryAssignments?: (resourceId: string, resourceTitle: string) => void;
  canCreateContent?: boolean;
  canEditContent?: boolean;
  canDeleteContent?: boolean;
}) {
  const published = items.filter((content) => content.status === "PUBLISHED").length;
  const drafts = items.filter((content) => content.status === "DRAFT").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {items.length} item{items.length !== 1 ? "s" : ""} · {published} published · {drafts} draft{drafts !== 1 ? "s" : ""}
            {folderName ? ` · Folder: ${folderName}` : ""}
          </p>
        </div>
        {canCreateContent ? (
          <Button size="sm" onClick={onAddContent}>
            Upload Content
          </Button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-muted-foreground">
          <p className="text-sm">{folderName ? "No repository items in this folder yet." : "No repository items yet."}</p>
          <p className="mt-1 text-xs">
            Upload PDFs, documents, links, or authored lessons here, then use Actions &gt; Manage Assignments when the item should appear in another course.
          </p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {items.map((content) => {
            const linkedResource = linkedResources[content.id] ?? null;
            const repositoryResourceId = linkedResource?.id ?? content.resourceId ?? null;
            const isSharedAssignment = content.isSharedAssignment === true;
            const handlePrimaryOpen = () => {
              if (repositoryResourceId && onViewRepositoryResource) {
                onViewRepositoryResource(repositoryResourceId);
                return;
              }

              onViewContent(content.id);
            };

            return (
              <div key={content.id} className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/50">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={handlePrimaryOpen}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">{content.title}</span>
                    {!folderName && content.folderName ? (
                      <Badge variant="info" className="px-1.5 py-0 text-[10px]">
                        {content.folderName}
                      </Badge>
                    ) : null}
                    {content.isScorm ? (
                      <Badge variant="accent" className="px-1.5 py-0 text-[10px]">
                        SCORM - Coming Soon
                      </Badge>
                    ) : null}
                    {isSharedAssignment ? (
                      <Badge variant="info" className="px-1.5 py-0 text-[10px]">
                        Assigned
                      </Badge>
                    ) : null}
                    {linkedResource?.tagNames.slice(0, 3).map((tagName) => (
                      <Badge key={`${content.id}-${tagName}`} variant="default" className="px-1.5 py-0 text-[10px]">
                        {tagName}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{contentTypeLabels[content.contentType] ?? content.contentType}</span>
                    {content.estimatedReadingMinutes ? <span>· {content.estimatedReadingMinutes} min read</span> : null}
                    {content.fileName ? <span>· {content.fileName}</span> : null}
                    {content.fileSize ? <span>· {formatFileSize(content.fileSize)}</span> : null}
                    {linkedResource ? <span>· v{linkedResource.currentVersionNumber}</span> : null}
                    {linkedResource ? <span>· {linkedResource.assignmentCount} assignment{linkedResource.assignmentCount === 1 ? "" : "s"}</span> : null}
                    {isSharedAssignment && content.sourceCourseName ? <span>· Shared from: {content.sourceCourseName}</span> : null}
                    {isSharedAssignment && content.sourceFolderName ? <span>· Source Folder: {content.sourceFolderName}</span> : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                    {content.excerpt || content.description || "No description yet."}
                  </p>
                </button>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant[linkedResource?.status ?? content.resourceStatus ?? content.status] ?? "info"} className="shrink-0">
                    {linkedResource?.status ?? content.resourceStatus ?? content.status}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Open repository actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {repositoryResourceId && onViewRepositoryResource ? (
                        <DropdownMenuItem onSelect={() => onViewRepositoryResource(repositoryResourceId)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Repository Item
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem onSelect={() => onViewContent(content.id)}>
                        <Eye className="mr-2 h-4 w-4" />
                        {isSharedAssignment ? "View Source Upload" : "View Upload"}
                      </DropdownMenuItem>
                      {content.contentType === "ARTICLE" && (
                        <DropdownMenuItem onSelect={() => {
                          fetch(`/api/course-content/${content.id}/export?format=docx`, { cache: "no-store" })
                            .then((res) => {
                              if (!res.ok) throw new Error("Export failed.");
                              return res.blob().then((blob) => ({ blob, headers: res.headers }));
                            })
                            .then(({ blob, headers }) => {
                              const disposition = headers.get("Content-Disposition");
                              const match = disposition?.match(/filename="?([^";]+)"?/i);
                              const filename = match?.[1] ? decodeURIComponent(match[1]) : `${content.title}.docx`;
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = filename;
                              document.body.appendChild(a);
                              a.click();
                              a.remove();
                              URL.revokeObjectURL(url);
                            })
                            .catch(() => { /* silent */ });
                        }}>
                          <Download className="mr-2 h-4 w-4" />
                          Download as DOCX
                        </DropdownMenuItem>
                      )}
                      {canEditContent && !isSharedAssignment ? (
                        <DropdownMenuItem onSelect={() => onEditContent(content.id)}>
                          <PencilLine className="mr-2 h-4 w-4" />
                          Edit Upload
                        </DropdownMenuItem>
                      ) : null}
                      {linkedResource && onEditRepositoryResource && !isSharedAssignment ? (
                        <DropdownMenuItem onSelect={() => onEditRepositoryResource(linkedResource.id)}>
                          <PencilLine className="mr-2 h-4 w-4" />
                          Edit Repository Metadata
                        </DropdownMenuItem>
                      ) : null}
                      {linkedResource && onManageRepositoryAssignments && !isSharedAssignment ? (
                        <DropdownMenuItem onSelect={() => onManageRepositoryAssignments(linkedResource.id, content.title)}>
                          <Share2 className="mr-2 h-4 w-4" />
                          Manage Assignments
                        </DropdownMenuItem>
                      ) : null}
                      {linkedResource && onViewRepositoryHistory ? (
                        <DropdownMenuItem onSelect={() => onViewRepositoryHistory(linkedResource.id, content.title)}>
                          <History className="mr-2 h-4 w-4" />
                          View Version History
                        </DropdownMenuItem>
                      ) : null}
                      {canDeleteContent && !isSharedAssignment ? (
                        <DropdownMenuItem className="text-rose-700 focus:bg-rose-50 focus:text-rose-700" onSelect={() => onDeleteContent(content)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
