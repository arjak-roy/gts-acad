"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUpDown, FileText, Film, Globe, File, Link2, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type AssignmentItem = {
  id: string;
  resourceId: string;
  resourceTitle: string;
  contentType: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  notes: string | null;
  assignedByName: string | null;
  assignedAt: string;
};

type AssignmentPage = {
  items: AssignmentItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const TARGET_TYPE_LABELS: Record<string, string> = {
  COURSE: "Course",
  BATCH: "Batch",
  ASSESSMENT_POOL: "Assessment",
  SCHEDULE_EVENT: "Event",
};

const TARGET_TYPE_FILTERS = [
  { value: "", label: "All Types" },
  { value: "COURSE", label: "Course" },
  { value: "BATCH", label: "Batch" },
  { value: "ASSESSMENT_POOL", label: "Assessment" },
  { value: "SCHEDULE_EVENT", label: "Event" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function ManageAssignmentsPage() {
  const [page, setPage] = useState<AssignmentPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [targetTypeFilter, setTargetTypeFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchAssignments = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (targetTypeFilter) params.set("targetType", targetTypeFilter);
      params.set("page", String(currentPage));
      params.set("pageSize", "25");

      const res = await fetch(`/api/learning-resources/assignments?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load assignments");
      const json = await res.json();
      setPage(json.data ?? json);
    } catch {
      setPage(null);
    } finally {
      setIsLoading(false);
    }
  }, [search, targetTypeFilter, currentPage]);

  useEffect(() => {
    void fetchAssignments();
  }, [fetchAssignments]);

  async function handleRemove(assignment: AssignmentItem) {
    if (!confirm(`Remove assignment of "${assignment.resourceTitle}" from ${assignment.targetLabel}?`)) return;
    try {
      const res = await fetch(`/api/learning-resources/${assignment.resourceId}/assignments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId: assignment.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || "Failed to remove assignment");
        return;
      }
      toast.success("Assignment removed");
      void fetchAssignments();
    } catch {
      toast.error("Failed to remove assignment");
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Manage Assignments</h1>
        <p className="mt-1 text-sm text-slate-500">
          View and manage all resource-to-course/batch assignments in one place.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by resource title…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="pl-9"
          />
          {search && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              onClick={() => setSearch("")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-1">
          {TARGET_TYPE_FILTERS.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={targetTypeFilter === f.value ? "default" : "ghost"}
              className="h-8 text-xs"
              onClick={() => { setTargetTypeFilter(f.value); setCurrentPage(1); }}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {page && (
          <span className="ml-auto text-xs text-slate-500">
            {page.total} assignment{page.total !== 1 ? "s" : ""} total
          </span>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-lg border border-slate-200">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded" />
            ))}
          </div>
        ) : !page || page.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ArrowUpDown className="h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-700">No assignments found</p>
            <p className="mt-1 text-xs text-slate-500">
              Assign resources from the Repository using the 3-dot menu → Assign to Course
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-medium">Resource</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Assigned To</th>
                <th className="px-4 py-3 font-medium">Target Type</th>
                <th className="px-4 py-3 font-medium">Assigned By</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {page.items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ContentTypeIcon contentType={item.contentType} />
                      <span className="font-medium text-slate-800">{item.resourceTitle}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="default" className="text-[10px] uppercase">{item.contentType}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{item.targetLabel}</td>
                  <td className="px-4 py-3">
                    <Badge variant="info" className="text-[10px]">
                      {TARGET_TYPE_LABELS[item.targetType] ?? item.targetType}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{item.assignedByName ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(item.assignedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Remove assignment"
                      onClick={() => void handleRemove(item)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {page && page.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-xs text-slate-500">
            Page {page.page} of {page.totalPages}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="ghost" disabled={currentPage >= page.totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function ContentTypeIcon({ contentType }: { contentType: string }) {
  const cls = "h-4 w-4";
  switch (contentType) {
    case "ARTICLE": return <FileText className={cn(cls, "text-blue-500")} />;
    case "VIDEO": return <Film className={cn(cls, "text-purple-500")} />;
    case "LINK": return <Globe className={cn(cls, "text-green-500")} />;
    case "PDF": return <File className={cn(cls, "text-red-500")} />;
    default: return <File className={cn(cls, "text-slate-400")} />;
  }
}
