"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Eye, History, MoreHorizontal, PencilLine, Plus, Search, Trash2, Waypoints } from "lucide-react";
import { toast } from "sonner";

import {
  formatDateTime,
  formatFileSize,
  getLearningResourceCategoryLabel,
  getLearningResourceStatusBadgeVariant,
  getLearningResourceVisibilityBadgeVariant,
  LEARNING_RESOURCE_CONTENT_TYPE_LABELS,
  LEARNING_RESOURCE_STATUS_OPTIONS,
  LEARNING_RESOURCE_VISIBILITY_LABELS,
  LEARNING_RESOURCE_VISIBILITY_OPTIONS,
  parseApiResponse,
  type LearningResourceListItem,
  type LearningResourceListPage,
  type LearningResourceLookups,
} from "@/components/modules/course-builder/learning-resource-client";
import { LearningResourceAssignmentsSheet } from "@/components/modules/course-builder/learning-resource-assignments-sheet";
import { LearningResourceDetailSheet } from "@/components/modules/course-builder/learning-resource-detail-sheet";
import { LearningResourceFormSheet, type LearningResourceFormSeed } from "@/components/modules/course-builder/learning-resource-form-sheet";
import { LearningResourceHistorySheet } from "@/components/modules/course-builder/learning-resource-history-sheet";
import { LearningResourceRecycleBin } from "@/components/modules/course-builder/learning-resource-recycle-bin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/ui/can-access";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";

type LearningResourceLibraryProps = {
  lookups: LearningResourceLookups;
  headingTitle?: string;
  headingDescription?: string;
  libraryTitle?: string;
  libraryDescription?: string;
  createButtonLabel?: string;
  createPreset?: LearningResourceFormSeed;
  categoryLocked?: boolean;
  createTitle?: string;
  createDescription?: string;
  secondaryAction?: ReactNode;
  externalRefreshToken?: number;
  onResourcesChanged?: () => void;
};

type ResourceFilters = {
  search: string;
  status: string;
  visibility: string;
  categoryId: string;
};

function buildQuery(filters: ResourceFilters, page: number, pageSize: number) {
  const params = new URLSearchParams();

  if (filters.search.trim()) {
    params.set("search", filters.search.trim());
  }

  if (filters.status) {
    params.set("status", filters.status);
  }

  if (filters.visibility) {
    params.set("visibility", filters.visibility);
  }

  if (filters.categoryId) {
    params.set("categoryId", filters.categoryId);
  }

  params.set("page", String(page));
  params.set("pageSize", String(pageSize));

  return params.toString();
}

export function LearningResourceLibrary({
  lookups,
  headingTitle = "Learning Resources",
  headingDescription = "Run the central library for reusable PDFs, authored articles, videos, links, and trainer attachments before they are assigned into delivery contexts.",
  libraryTitle = "Resource Library",
  libraryDescription = "Search across the centralized repository, review usage, and open workflows for editing, assignment, or version restoration.",
  createButtonLabel = "Create Resource",
  createPreset,
  categoryLocked = false,
  createTitle,
  createDescription,
  secondaryAction,
  externalRefreshToken = 0,
  onResourcesChanged,
}: LearningResourceLibraryProps) {
  const [filters, setFilters] = useState<ResourceFilters>({
    search: "",
    status: "",
    visibility: "",
    categoryId: "",
  });
  const [resources, setResources] = useState<LearningResourceListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [refreshToken, setRefreshToken] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [viewingResourceId, setViewingResourceId] = useState<string | null>(null);
  const [historyResource, setHistoryResource] = useState<{ id: string; title: string } | null>(null);
  const [assignmentResource, setAssignmentResource] = useState<{ id: string; title: string } | null>(null);
  const [resourcePendingDelete, setResourcePendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [recycleBinOpen, setRecycleBinOpen] = useState(false);
  const debouncedSearch = useDebounce(filters.search, 250);

  useEffect(() => {
    let active = true;

    const loadResources = async () => {
      setIsLoading(true);

      try {
        const query = buildQuery({ ...filters, search: debouncedSearch }, page, pageSize);
        const response = await fetch(`/api/learning-resources${query ? `?${query}` : ""}`, { cache: "no-store" });
        const payload = await parseApiResponse<LearningResourceListPage>(response, "Failed to load learning resources.");

        if (!active) {
          return;
        }

        setResources(payload.items);
        setTotal(payload.total);
        setTotalPages(payload.totalPages);
        if (payload.totalPages > 0 && page > payload.totalPages) {
          setPage(payload.totalPages);
        }
      } catch (loadError) {
        if (!active) {
          return;
        }

        const message = loadError instanceof Error ? loadError.message : "Failed to load learning resources.";
        toast.error(message);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadResources();

    return () => {
      active = false;
    };
  }, [debouncedSearch, externalRefreshToken, filters.categoryId, filters.status, filters.visibility, page, pageSize, refreshToken]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters.categoryId, filters.status, filters.visibility]);

  const summary = useMemo(() => {
    const rollup = resources.reduce(
      (accumulator, resource) => {
        accumulator.assignments += resource.assignmentCount;
        accumulator.previews += resource.previewCount;
        accumulator.downloads += resource.downloadCount;

        if (resource.status === "PUBLISHED") {
          accumulator.published += 1;
        }

        return accumulator;
      },
      { assignments: 0, previews: 0, downloads: 0, published: 0 },
    );

    return {
      total,
      published: rollup.published,
      assignments: rollup.assignments,
      previews: rollup.previews,
      downloads: rollup.downloads,
    };
  }, [resources, total]);

  const handleDeleteResource = async () => {
    if (!resourcePendingDelete) {
      return;
    }

    try {
      const response = await fetch(`/api/learning-resources/${resourcePendingDelete.id}`, {
        method: "DELETE",
      });

      await parseApiResponse(response, "Failed to move learning resource to recycle bin.");
      toast.success("Learning resource moved to recycle bin.");
      setResourcePendingDelete(null);
      setRefreshToken((current) => current + 1);
      onResourcesChanged?.();
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Failed to move learning resource to recycle bin.";
      toast.error(message);
    }
  };

  const categoryOptions = useMemo(
    () => lookups.categories.map((category) => ({ id: category.id, label: getLearningResourceCategoryLabel(category) })),
    [lookups.categories],
  );

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-slate-200 bg-white/95">
        <CardContent className="py-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-end">
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Content Manager</p>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{headingTitle}</h1>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                  {headingDescription}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Library Health</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-slate-500">Resources</p>
                  <p className="text-lg font-semibold text-slate-900">{summary.total}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Published</p>
                  <p className="text-lg font-semibold text-slate-900">{summary.published}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Assignments</p>
                  <p className="text-lg font-semibold text-slate-900">{summary.assignments}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Usage</p>
                  <p className="text-lg font-semibold text-slate-900">{summary.previews + summary.downloads}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[#edf2f7] bg-white/90">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle>{libraryTitle}</CardTitle>
              <CardDescription>{libraryDescription}</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {secondaryAction}
              <CanAccess permission="learning_resources.delete">
                <Button type="button" variant="secondary" onClick={() => setRecycleBinOpen(true)}>
                  <Trash2 className="h-4 w-4" />
                  Recycle Bin
                </Button>
              </CanAccess>
              <CanAccess permission="learning_resources.create">
                <Button type="button" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  {createButtonLabel}
                </Button>
              </CanAccess>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-6">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_180px_180px_220px]">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Search</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={filters.search}
                  onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                  className="pl-9"
                  placeholder="Search title, file name, or description"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Status</label>
              <select
                value={filters.status}
                onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
                className="block h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm text-slate-900"
              >
                <option value="">All statuses</option>
                {LEARNING_RESOURCE_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Visibility</label>
              <select
                value={filters.visibility}
                onChange={(event) => setFilters((current) => ({ ...current, visibility: event.target.value }))}
                className="block h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm text-slate-900"
              >
                <option value="">All visibility</option>
                {LEARNING_RESOURCE_VISIBILITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Category</label>
              <select
                value={filters.categoryId}
                onChange={(event) => setFilters((current) => ({ ...current, categoryId: event.target.value }))}
                className="block h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm text-slate-900"
              >
                <option value="">All categories</option>
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>{category.label}</option>
                ))}
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </div>
          ) : resources.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#d9e0e7] bg-slate-50/70 p-10 text-center text-sm text-slate-500">
              No learning resources match the current filters.
            </div>
          ) : (
            <>
              <div className="divide-y rounded-3xl border border-slate-200 bg-white">
                {resources.map((resource) => (
                  <div key={resource.id} className="flex items-start justify-between gap-4 px-4 py-4 transition-colors hover:bg-slate-50/70">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setViewingResourceId(resource.id)}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-slate-950">{resource.title}</span>
                      <Badge variant={getLearningResourceStatusBadgeVariant(resource.status)}>{resource.status}</Badge>
                      <Badge variant={getLearningResourceVisibilityBadgeVariant(resource.visibility)}>{LEARNING_RESOURCE_VISIBILITY_LABELS[resource.visibility]}</Badge>
                      <Badge variant="info">{LEARNING_RESOURCE_CONTENT_TYPE_LABELS[resource.contentType]}</Badge>
                      {resource.categoryName ? <Badge variant="default">{resource.categoryName}</Badge> : null}
                      {resource.subcategoryName ? <Badge variant="accent">{resource.subcategoryName}</Badge> : null}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      {resource.fileName ? <span>{resource.fileName}</span> : null}
                      {resource.fileSize ? <span>· {formatFileSize(resource.fileSize)}</span> : null}
                      {resource.estimatedReadingMinutes ? <span>· {resource.estimatedReadingMinutes} min</span> : null}
                      <span>· Updated {formatDateTime(resource.updatedAt)}</span>
                    </div>

                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                      {resource.excerpt || resource.description || "No description added yet."}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>{resource.assignmentCount} assignment{resource.assignmentCount === 1 ? "" : "s"}</span>
                      <span>{resource.previewCount} preview{resource.previewCount === 1 ? "" : "s"}</span>
                      <span>{resource.downloadCount} download{resource.downloadCount === 1 ? "" : "s"}</span>
                      <span>Version {resource.currentVersionNumber}</span>
                    </div>
                  </button>

                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open resource actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setViewingResourceId(resource.id)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </DropdownMenuItem>
                        <CanAccess permission="learning_resources.edit">
                          <DropdownMenuItem onSelect={() => setEditingResourceId(resource.id)}>
                            <PencilLine className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                        </CanAccess>
                        <CanAccess permission="learning_resources.assign">
                          <DropdownMenuItem onSelect={() => setAssignmentResource({ id: resource.id, title: resource.title })}>
                            <Waypoints className="mr-2 h-4 w-4" />
                            Assign
                          </DropdownMenuItem>
                        </CanAccess>
                        <DropdownMenuItem onSelect={() => setHistoryResource({ id: resource.id, title: resource.title })}>
                          <History className="mr-2 h-4 w-4" />
                          History
                        </DropdownMenuItem>
                        <CanAccess permission="learning_resources.delete">
                          <DropdownMenuItem className="text-rose-700 focus:bg-rose-50 focus:text-rose-700" onSelect={() => setResourcePendingDelete({ id: resource.id, title: resource.title })}>
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

              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                <span>
                  Showing {resources.length === 0 ? 0 : ((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total}
                </span>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                    Previous
                  </Button>
                  <span className="min-w-[86px] text-center text-xs font-medium text-slate-500">Page {page} of {Math.max(1, totalPages)}</span>
                  <Button type="button" variant="secondary" size="sm" disabled={page >= Math.max(1, totalPages)} onClick={() => setPage((current) => Math.min(Math.max(1, totalPages), current + 1))}>
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <LearningResourceFormSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        lookups={lookups}
        createPreset={createPreset}
        categoryLocked={categoryLocked}
        createTitle={createTitle}
        createDescription={createDescription}
        onSaved={() => {
          setRefreshToken((current) => current + 1);
          onResourcesChanged?.();
        }}
      />

      <LearningResourceFormSheet
        open={Boolean(editingResourceId)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingResourceId(null);
          }
        }}
        resourceId={editingResourceId}
        lookups={lookups}
        onSaved={() => {
          setRefreshToken((current) => current + 1);
          setEditingResourceId(null);
          onResourcesChanged?.();
        }}
      />

      <LearningResourceDetailSheet
        open={Boolean(viewingResourceId)}
        onOpenChange={(open) => {
          if (!open) {
            setViewingResourceId(null);
          }
        }}
        resourceId={viewingResourceId}
        refreshToken={refreshToken}
      />

      <LearningResourceAssignmentsSheet
        open={Boolean(assignmentResource)}
        onOpenChange={(open) => {
          if (!open) {
            setAssignmentResource(null);
          }
        }}
        resourceId={assignmentResource?.id ?? null}
        resourceTitle={assignmentResource?.title ?? null}
        lookups={lookups}
        refreshToken={refreshToken}
        onAssignmentsUpdated={() => {
          setRefreshToken((current) => current + 1);
        }}
      />

      <LearningResourceHistorySheet
        open={Boolean(historyResource)}
        onOpenChange={(open) => {
          if (!open) {
            setHistoryResource(null);
          }
        }}
        resourceId={historyResource?.id ?? null}
        resourceTitle={historyResource?.title ?? null}
        refreshToken={refreshToken}
        onRestored={() => {
          setRefreshToken((current) => current + 1);
          setHistoryResource(null);
          onResourcesChanged?.();
        }}
      />

      {resourcePendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <p className="text-lg font-semibold text-slate-950">Move Resource To Recycle Bin</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Move {resourcePendingDelete.title} to the recycle bin? Assignments and history are retained and you can restore this item later.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setResourcePendingDelete(null)}>Cancel</Button>
              <Button type="button" className="bg-rose-600 text-white hover:bg-rose-700" onClick={() => void handleDeleteResource()}>Move To Recycle Bin</Button>
            </div>
          </div>
        </div>
      ) : null}

      <LearningResourceRecycleBin
        lookups={lookups}
        open={recycleBinOpen}
        onOpenChange={setRecycleBinOpen}
        refreshToken={refreshToken}
        onResourceRestored={() => {
          setRefreshToken((current) => current + 1);
          onResourcesChanged?.();
        }}
      />
    </div>
  );
}