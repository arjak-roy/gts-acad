"use client";

import { Download, Eye, FolderOpen, GripVertical, History, Loader2, MoreHorizontal, PencilLine, Share2, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  folderId: string | null;
  status: string;
  tagNames: string[];
  currentVersionNumber: number;
  assignmentCount: number;
};

export type CourseContentMoveTarget = {
  id: string;
  courseId?: string | null;
  name: string;
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
  availableMoveTargets,
  onAddContent,
  onViewContent,
  onEditContent,
  onDeleteContent,
  onMoveContent,
  onViewRepositoryResource,
  onEditRepositoryResource,
  onViewRepositoryHistory,
  onManageRepositoryAssignments,
  canCreateContent,
  canEditContent,
  canDeleteContent,
  showCourseName,
  movingContentId,
  dragToFolderEnabled,
  draggingContentId,
  onContentDragStart,
  onContentDragEnd,
}: {
  items: CourseContentItem[];
  folderName?: string | null;
  linkedResources?: Record<string, LinkedRepositoryResourceSummary>;
  availableMoveTargets?: CourseContentMoveTarget[];
  onAddContent: () => void;
  onViewContent: (contentId: string) => void;
  onEditContent: (contentId: string) => void;
  onDeleteContent: (content: CourseContentItem) => void;
  onMoveContent?: (content: CourseContentItem, targetFolderId: string | null) => void;
  onViewRepositoryResource?: (resourceId: string) => void;
  onEditRepositoryResource?: (resourceId: string) => void;
  onViewRepositoryHistory?: (resourceId: string, resourceTitle: string) => void;
  onManageRepositoryAssignments?: (resourceId: string, resourceTitle: string) => void;
  canCreateContent?: boolean;
  canEditContent?: boolean;
  canDeleteContent?: boolean;
  showCourseName?: boolean;
  movingContentId?: string | null;
  dragToFolderEnabled?: boolean;
  draggingContentId?: string | null;
  onContentDragStart?: (content: CourseContentItem) => void;
  onContentDragEnd?: () => void;
}) {
  const published = items.filter((content) => content.status === "PUBLISHED").length;
  const drafts = items.filter((content) => content.status === "DRAFT").length;
  const locationLabel = folderName ?? "Repository Root";
  const isMoving = Boolean(movingContentId);

  return (
    <div className="space-y-4">
      {/* ── Move progress bar ─────────────────────────────────── */}
      {isMoving ? (
        <div className="space-y-2 rounded-2xl border border-primary/20 bg-primary/[0.04] px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Loader2 className="h-4 w-4 animate-spin" />
            Moving item to folder…
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/10">
            <div className="h-full animate-pulse rounded-full bg-primary/60" style={{ width: "60%" }} />
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">{locationLabel}</p>
            <Badge variant="info">{items.length} item{items.length !== 1 ? "s" : ""}</Badge>
            <Badge variant="default">{published} published</Badge>
            <Badge variant="accent">{drafts} draft{drafts !== 1 ? "s" : ""}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Upload reusable files here, then manage repository assignments when the item should appear in other courses, batches, or delivery contexts.
          </p>
          {dragToFolderEnabled ? (
            <p className="text-xs text-slate-500">Drag a handle onto a folder in the explorer or use Actions &gt; Move to Folder.</p>
          ) : null}
        </div>
        {canCreateContent ? (
          <Button size="sm" onClick={onAddContent}>
            Upload Content
          </Button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-12 text-center text-muted-foreground">
          <p className="text-base font-semibold text-slate-900">{folderName ? "No repository items in this folder yet." : "No repository items in the root yet."}</p>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Upload PDFs, documents, links, or authored lessons here, then use Actions &gt; Manage Assignments when the item should appear in another course.
          </p>
          {canCreateContent ? (
            <Button type="button" className="mt-4" onClick={onAddContent}>
              {folderName ? `Upload Into ${folderName}` : "Upload First File"}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {items.map((content) => {
            const linkedResource = linkedResources[content.id] ?? null;
            const repositoryResourceId = linkedResource?.id ?? content.resourceId ?? null;
            const isSharedAssignment = content.isSharedAssignment === true;
            const isMoveBusy = movingContentId === content.id;
            const isDragging = draggingContentId === content.id;
            const moveOptions = !isSharedAssignment && onMoveContent
              ? [
                  ...(content.folderId ? [{ id: null, name: "Library root" }] : []),
                  ...(availableMoveTargets ?? [])
                    .filter((folder) => (!folder.courseId || folder.courseId === content.courseId) && folder.id !== content.folderId)
                    .sort((left, right) => left.name.localeCompare(right.name))
                    .map((folder) => ({ id: folder.id, name: folder.name })),
                ]
              : [];
            const handlePrimaryOpen = () => {
              if (repositoryResourceId && onViewRepositoryResource) {
                onViewRepositoryResource(repositoryResourceId);
                return;
              }

              onViewContent(content.id);
            };

            return (
              <div key={content.isSharedAssignment ? `${content.id}-shared` : content.id} className={[
                "flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/50",
                isDragging ? "bg-primary/[0.04] opacity-60" : "",
              ].filter(Boolean).join(" ")}>
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={handlePrimaryOpen}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">{content.title}</span>
                    {showCourseName ? (
                      <Badge variant="accent" className="px-1.5 py-0 text-[10px]">
                        {content.courseName}
                      </Badge>
                    ) : null}
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
                  {dragToFolderEnabled && !isSharedAssignment ? (
                    <div
                      role="button"
                      tabIndex={0}
                      draggable={!isMoveBusy}
                      aria-label={`Drag ${content.title} into a folder`}
                      title="Drag into a folder"
                      className="inline-flex h-9 w-9 cursor-grab items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-700 active:cursor-grabbing"
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", content.id);
                        onContentDragStart?.(content);
                      }}
                      onDragEnd={() => onContentDragEnd?.()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                        }
                      }}
                    >
                      <GripVertical className="h-4 w-4" />
                    </div>
                  ) : null}
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
                      {moveOptions.length > 0 && onMoveContent ? (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <FolderOpen className="mr-2 h-4 w-4" />
                            {isMoveBusy ? "Moving..." : "Move to Folder"}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            {moveOptions.map((option) => (
                              <DropdownMenuItem
                                key={option.id ?? "__root__"}
                                onSelect={() => onMoveContent(content, option.id)}
                                disabled={isMoveBusy}
                              >
                                <FolderOpen className="mr-2 h-4 w-4" />
                                {option.name}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
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
