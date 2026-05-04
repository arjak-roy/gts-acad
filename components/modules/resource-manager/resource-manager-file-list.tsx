"use client";

import { useCallback, useRef, useState } from "react";
import {
  FileText,
  Film,
  Globe,
  File,
  FileSpreadsheet,
  Upload,
  FolderPlus,
  ChevronRight,
  HardDrive,
  MoreHorizontal,
  Eye,
  Pencil,
  FolderInput,
  Download,
  Trash2,
  Copy,
  Loader2,
} from "lucide-react";
import { useDraggable } from "@dnd-kit/core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  formatDateTime,
  formatFileSize,
  getLearningResourceStatusBadgeVariant,
  type LearningResourceListItem,
} from "@/components/modules/course-builder/learning-resource-client";
import { useResourceManager } from "./resource-manager-types";

// ─── File List ───────────────────────────────────────────────────────────────

export function ResourceManagerFileList() {
  const {
    mode,
    selectedFolderId,
    resourcePage,
    isLoadingResources,
    isMovingResource,
    viewMode,
    startUpload,
    lookups,
    selectedResourceIds,
    toggleResourceSelection,
    disabledResourceIds,
    setSelectedFolderId,
  } = useResourceManager();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Find the selected folder's path for breadcrumb
  const breadcrumbPath = buildBreadcrumb(selectedFolderId, lookups.folders);

  // Handle OS file drop
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) startUpload(files);
    },
    [startUpload],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0) startUpload(files);
      e.target.value = "";
    },
    [startUpload],
  );

  return (
    <div className="flex h-full flex-col bg-white" onDrop={handleDrop} onDragOver={handleDragOver}>
      {/* Hidden file input for toolbar upload button */}
      <input
        ref={fileInputRef}
        id="rm-file-upload-input"
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Breadcrumb bar */}
      <div className="flex items-center gap-1 border-b border-slate-100 px-3 py-1.5">
        <button
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          onClick={() => setSelectedFolderId(null)}
        >
          <HardDrive className="h-3 w-3" />
          <span>Root</span>
        </button>
        {breadcrumbPath.map((segment) => (
          <span key={segment.id} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-slate-300" />
            <button
              className="rounded px-1.5 py-0.5 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              onClick={() => setSelectedFolderId(segment.id)}
            >
              {segment.name}
            </button>
          </span>
        ))}
      </div>

      {/* Move-in-progress bar */}
      {isMovingResource ? (
        <div className="border-b border-primary/20 bg-primary/[0.04] px-3 py-2">
          <div className="flex items-center gap-2 text-xs font-medium text-primary">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Moving file to folder…
          </div>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-primary/10">
            <div className="h-full animate-pulse rounded-full bg-primary/60" style={{ width: "60%" }} />
          </div>
        </div>
      ) : null}

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingResources ? (
          <LoadingState />
        ) : !resourcePage || resourcePage.items.length === 0 ? (
          <EmptyState onUpload={() => fileInputRef.current?.click()} />
        ) : viewMode === "list" ? (
          <ListView
            items={resourcePage.items}
            isPick={mode === "pick"}
            selectedIds={selectedResourceIds}
            disabledIds={disabledResourceIds}
            onToggle={toggleResourceSelection}
          />
        ) : (
          <GridView
            items={resourcePage.items}
            isPick={mode === "pick"}
            selectedIds={selectedResourceIds}
            disabledIds={disabledResourceIds}
            onToggle={toggleResourceSelection}
          />
        )}
      </div>

      {/* Status bar */}
      <StatusBar />
    </div>
  );
}

// ─── List View ───────────────────────────────────────────────────────────────

function ListView({
  items,
  isPick,
  selectedIds,
  disabledIds,
  onToggle,
}: {
  items: LearningResourceListItem[];
  isPick: boolean;
  selectedIds: Set<string>;
  disabledIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="divide-y divide-slate-50">
      {/* Header row */}
      <div className={cn(
        "grid items-center gap-3 bg-slate-50/60 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-500",
        isPick
          ? "grid-cols-[auto_1fr_100px_80px_80px_120px]"
          : "grid-cols-[1fr_100px_80px_80px_120px_36px]",
      )}>
        {isPick && <span className="w-5" />}
        <span>Name</span>
        <span>Type</span>
        <span>Status</span>
        <span>Size</span>
        <span>Modified</span>
        {!isPick && <span />}
      </div>

      {items.map((item) => (
        <ResourceListRow
          key={item.id}
          item={item}
          isPick={isPick}
          isSelected={selectedIds.has(item.id)}
          isDisabled={disabledIds.has(item.id)}
          onToggle={() => onToggle(item.id)}
        />
      ))}
    </div>
  );
}

function ResourceListRow({
  item,
  isPick,
  isSelected,
  isDisabled,
  onToggle,
}: {
  item: LearningResourceListItem;
  isPick: boolean;
  isSelected: boolean;
  isDisabled: boolean;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `resource-${item.id}`,
    data: { type: "resource", resourceId: item.id, title: item.title },
    disabled: isPick,
  });

  return (
    <div
      ref={setNodeRef}
      {...(isPick ? {} : { ...attributes, ...listeners })}
      className={cn(
        "grid items-center gap-3 px-3 py-2 text-sm transition-colors",
        isPick
          ? "grid-cols-[auto_1fr_100px_80px_80px_120px]"
          : "grid-cols-[1fr_100px_80px_80px_120px_36px] cursor-grab active:cursor-grabbing",
        isSelected && "bg-primary/5",
        isDisabled && "opacity-50",
        isDragging && "opacity-40",
        !isDisabled && !isSelected && "hover:bg-slate-50",
      )}
      onClick={() => {
        if (isPick && !isDisabled) onToggle();
      }}
    >
      {isPick && (
        <Checkbox checked={isSelected} disabled={isDisabled} onCheckedChange={() => onToggle()} className="h-4 w-4" />
      )}

      {/* Name */}
      <div className="flex items-center gap-2 overflow-hidden">
        <ContentTypeIcon contentType={item.contentType} className="h-4 w-4 shrink-0" />
        <span className="truncate font-medium text-slate-800">{item.title}</span>
      </div>

      {/* Type */}
      <Badge variant="default" className="w-fit text-[10px] uppercase">
        {item.contentType}
      </Badge>

      {/* Status */}
      <Badge variant={getLearningResourceStatusBadgeVariant(item.status as "DRAFT" | "PUBLISHED" | "ARCHIVED")}>
        {item.status}
      </Badge>

      {/* Size */}
      <span className="text-xs text-slate-500">{item.fileSize ? formatFileSize(item.fileSize) : "—"}</span>

      {/* Modified */}
      <span className="text-xs text-slate-500">{formatDateTime(item.updatedAt as unknown as string)}</span>

      {/* Actions */}
      {!isPick && <ResourceActionMenu resourceId={item.id} title={item.title} />}
    </div>
  );
}

// ─── Grid View ───────────────────────────────────────────────────────────────

function GridView({
  items,
  isPick,
  selectedIds,
  disabledIds,
  onToggle,
}: {
  items: LearningResourceListItem[];
  isPick: boolean;
  selectedIds: Set<string>;
  disabledIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((item) => (
        <ResourceGridCard
          key={item.id}
          item={item}
          isPick={isPick}
          isSelected={selectedIds.has(item.id)}
          isDisabled={disabledIds.has(item.id)}
          onToggle={() => onToggle(item.id)}
        />
      ))}
    </div>
  );
}

function ResourceGridCard({
  item,
  isPick,
  isSelected,
  isDisabled,
  onToggle,
}: {
  item: LearningResourceListItem;
  isPick: boolean;
  isSelected: boolean;
  isDisabled: boolean;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `resource-${item.id}`,
    data: { type: "resource", resourceId: item.id, title: item.title },
    disabled: isPick,
  });

  return (
    <div
      ref={setNodeRef}
      {...(isPick ? {} : { ...attributes, ...listeners })}
      className={cn(
        "group relative flex flex-col items-center gap-2 rounded-lg border border-slate-200 p-4 text-center transition-all",
        isSelected && "border-primary bg-primary/5 ring-1 ring-primary/30",
        isDisabled && "opacity-50",
        isDragging && "opacity-40",
        !isDisabled && !isSelected && "hover:border-slate-300 hover:shadow-sm",
        !isPick && "cursor-grab active:cursor-grabbing",
      )}
      onClick={() => {
        if (isPick && !isDisabled) onToggle();
      }}
    >
      {isPick && (
        <Checkbox
          checked={isSelected}
          disabled={isDisabled}
          onCheckedChange={() => onToggle()}
          className="absolute left-2 top-2 h-4 w-4"
        />
      )}

      {/* Action menu (top-right, visible on hover) */}
      {!isPick && (
        <div className="absolute right-1.5 top-1.5 opacity-0 transition-opacity group-hover:opacity-100">
          <ResourceActionMenu resourceId={item.id} title={item.title} />
        </div>
      )}

      <ContentTypeIcon contentType={item.contentType} className="h-10 w-10 text-slate-400" />
      <span className="line-clamp-2 text-xs font-medium text-slate-800">{item.title}</span>
      <Badge variant="default" className="text-[9px] uppercase">
        {item.contentType}
      </Badge>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ onUpload }: { onUpload: () => void }) {
  const { setInlineCreateParentId, selectedFolderId } = useResourceManager();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="rounded-full bg-slate-100 p-4">
        <File className="h-8 w-8 text-slate-400" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-700">This folder is empty</p>
        <p className="mt-1 text-xs text-slate-500">Upload files or create a subfolder to get started</p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={onUpload}>
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          Upload Files
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setInlineCreateParentId(selectedFolderId)}>
          <FolderPlus className="mr-1.5 h-3.5 w-3.5" />
          New Folder
        </Button>
      </div>
    </div>
  );
}

// ─── Loading State ───────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-md" />
      ))}
    </div>
  );
}

// ─── Status Bar ──────────────────────────────────────────────────────────────

function StatusBar() {
  const { resourcePage, uploadState, selectedResourceIds, mode } = useResourceManager();
  const itemCount = resourcePage?.total ?? 0;

  return (
    <div className="flex items-center gap-3 border-t border-slate-200 bg-slate-50/80 px-3 py-1 text-[11px] text-slate-500">
      <span>{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
      {mode === "pick" && selectedResourceIds.size > 0 && (
        <span className="font-medium text-primary">{selectedResourceIds.size} selected</span>
      )}
      {uploadState.isUploading && (
        <span className="ml-auto text-blue-600">
          Uploading {uploadState.completedCount + 1}/{uploadState.totalCount}…
        </span>
      )}
      {!uploadState.isUploading && uploadState.completedCount > 0 && (
        <span className="ml-auto text-green-600">{uploadState.completedCount} uploaded</span>
      )}
      {uploadState.failedCount > 0 && (
        <span className="text-red-600">{uploadState.failedCount} failed</span>
      )}
    </div>
  );
}

// ─── Resource Action Menu ────────────────────────────────────────────────────

function ResourceActionMenu({ resourceId, title }: { resourceId: string; title: string }) {
  const { refreshResources } = useResourceManager();
  const [deleting, setDeleting] = useState(false);

  function handleView() {
    window.dispatchEvent(new CustomEvent("rm:view-resource", { detail: { resourceId } }));
  }

  function handleEdit() {
    window.dispatchEvent(new CustomEvent("rm:edit-resource", { detail: { resourceId } }));
  }

  function handleCopyId() {
    void navigator.clipboard.writeText(resourceId);
  }

  function handleAssign() {
    window.dispatchEvent(new CustomEvent("rm:assign-resource", { detail: { resourceId, title } }));
  }

  async function handleDelete() {
    if (!confirm(`Delete "${title}"? This action cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/learning-resources/${resourceId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error || "Failed to delete resource");
        return;
      }
      refreshResources();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={handleView}>
          <Eye className="mr-2 h-4 w-4" />
          View Details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyId}>
          <Copy className="mr-2 h-4 w-4" />
          Copy ID
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleAssign}>
          <FolderInput className="mr-2 h-4 w-4" />
          Assign to Course
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleDelete} disabled={deleting} className="text-red-600 focus:text-red-600">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ContentTypeIcon({ contentType, className }: { contentType: string; className?: string }) {
  switch (contentType) {
    case "ARTICLE":
      return <FileText className={cn("text-blue-500", className)} />;
    case "PDF":
      return <FileSpreadsheet className={cn("text-red-500", className)} />;
    case "VIDEO":
      return <Film className={cn("text-purple-500", className)} />;
    case "LINK":
      return <Globe className={cn("text-green-500", className)} />;
    case "DOCUMENT":
      return <FileText className={cn("text-orange-500", className)} />;
    default:
      return <File className={cn("text-slate-400", className)} />;
  }
}

function buildBreadcrumb(
  folderId: string | null,
  folders: { id: string; parentId: string | null; name: string }[],
): { id: string; name: string }[] {
  if (!folderId) return [];
  const path: { id: string; name: string }[] = [];
  let current = folders.find((f) => f.id === folderId);
  while (current) {
    path.unshift({ id: current.id, name: current.name });
    current = current.parentId ? folders.find((f) => f.id === current!.parentId) : undefined;
  }
  return path;
}
