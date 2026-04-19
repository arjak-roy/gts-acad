"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  formatDateTime,
  parseApiResponse,
  type LearningResourceListItem,
  type LearningResourceListPage,
  type LearningResourceLookups,
} from "@/components/modules/course-builder/learning-resource-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/ui/can-access";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";

type ResourceFilters = {
  search: string;
};

function buildQuery(filters: ResourceFilters, page: number, pageSize: number) {
  const params = new URLSearchParams();

  if (filters.search.trim()) {
    params.set("search", filters.search.trim());
  }

  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  params.set("showDeleted", "true");

  return params.toString();
}

type LearningResourceRecycleBinProps = {
  lookups: LearningResourceLookups;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  refreshToken?: number;
  onResourceRestored?: () => void;
};

export function LearningResourceRecycleBin({
  open,
  onOpenChange,
  refreshToken = 0,
  onResourceRestored,
}: LearningResourceRecycleBinProps) {
  const [filters, setFilters] = useState<ResourceFilters>({
    search: "",
  });
  const [resources, setResources] = useState<LearningResourceListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [restorePendingId, setRestorePendingId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const debouncedSearch = useDebounce(filters.search, 250);

  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;

    const loadResources = async () => {
      setIsLoading(true);

      try {
        const query = buildQuery({ ...filters, search: debouncedSearch }, page, pageSize);
        const response = await fetch(`/api/learning-resources?${query}`, { cache: "no-store" });
        const payload = await parseApiResponse<LearningResourceListPage>(response, "Failed to load deleted resources.");

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

        const message = loadError instanceof Error ? loadError.message : "Failed to load deleted resources.";
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
  }, [debouncedSearch, open, filters, page, pageSize, refreshToken]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters]);

  const handleRestoreResource = async (resourceId: string) => {
    setIsRestoring(true);

    try {
      const response = await fetch(`/api/learning-resources/${resourceId}/restore-deleted`, {
        method: "POST",
      });

      await parseApiResponse(response, "Failed to restore resource.");
      toast.success("Resource restored from recycle bin.");
      setRestorePendingId(null);
      setResources((current) => current.filter((r) => r.id !== resourceId));
      if (resources.length === 1) {
        setPage(Math.max(1, page - 1));
      }
      onResourceRestored?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to restore resource.";
      toast.error(message);
    } finally {
      setIsRestoring(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 py-6 overflow-y-auto">
      <Card className="w-full max-w-4xl">
        <CardHeader className="border-b border-[#edf2f7] bg-white/90">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-slate-600" />
                Recycle Bin
              </CardTitle>
              <CardDescription>Restore or permanently remove deleted resources</CardDescription>
            </div>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              ✕
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={filters.search}
                onChange={(event) => setFilters({ search: event.target.value })}
                className="pl-9"
                placeholder="Search title or description"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : resources.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-8 text-center">
              <Trash2 className="h-8 w-8 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">No deleted resources</p>
              <p className="text-xs text-slate-400">The recycle bin is empty</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {resources.map((resource) => (
                  <div
                    key={resource.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate font-medium text-slate-900">{resource.title}</h4>
                        {resource.description && (
                          <p className="line-clamp-1 text-xs text-slate-500 mt-1">{resource.description}</p>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          <Badge variant="default" className="text-[10px]">
                            {resource.contentType}
                          </Badge>
                          {resource.categoryName && (
                            <Badge variant="default" className="text-[10px]">
                              {resource.categoryName}
                            </Badge>
                          )}
                          <span className="text-[10px] text-slate-400">
                            Deleted {formatDateTime(new Date().toISOString())}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              ⋯
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <CanAccess permission="learning_resources.delete">
                              <DropdownMenuItem
                                className="text-emerald-700 focus:bg-emerald-50 focus:text-emerald-700"
                                onSelect={() => setRestorePendingId(resource.id)}
                              >
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Restore
                              </DropdownMenuItem>
                            </CanAccess>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
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

      {restorePendingId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <p className="text-lg font-semibold text-slate-950">Restore Resource</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Restore this resource from the recycle bin? It will be returned to the active resources list.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setRestorePendingId(null)} disabled={isRestoring}>
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => {
                  if (restorePendingId) {
                    void handleRestoreResource(restorePendingId);
                  }
                }}
                disabled={isRestoring}
              >
                {isRestoring ? "Restoring…" : "Restore"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
