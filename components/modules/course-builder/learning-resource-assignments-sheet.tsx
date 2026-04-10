"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";

import {
  EMPTY_LEARNING_RESOURCE_LOOKUPS,
  formatDateTime,
  LEARNING_RESOURCE_TARGET_TYPE_LABELS,
  LEARNING_RESOURCE_TARGET_TYPE_OPTIONS,
  parseApiResponse,
  type LearningResourceAssignmentItem,
  type LearningResourceLookups,
  type LearningResourceTargetType,
} from "@/components/modules/course-builder/learning-resource-client";
import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/ui/can-access";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

type LearningResourceAssignmentsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceId: string | null;
  resourceTitle: string | null;
  lookups?: LearningResourceLookups;
  refreshToken?: number;
  onAssignmentsUpdated: () => void;
};

function getLookupOptions(lookups: LearningResourceLookups, targetType: LearningResourceTargetType) {
  switch (targetType) {
    case "COURSE":
      return lookups.courses;
    case "BATCH":
      return lookups.batches;
    case "ASSESSMENT_POOL":
      return lookups.assessments;
    case "SCHEDULE_EVENT":
      return lookups.scheduleEvents;
    default:
      return [];
  }
}

export function LearningResourceAssignmentsSheet({
  open,
  onOpenChange,
  resourceId,
  resourceTitle,
  lookups = EMPTY_LEARNING_RESOURCE_LOOKUPS,
  refreshToken = 0,
  onAssignmentsUpdated,
}: LearningResourceAssignmentsSheetProps) {
  const [assignments, setAssignments] = useState<LearningResourceAssignmentItem[]>([]);
  const [selectedTargetType, setSelectedTargetType] = useState<LearningResourceTargetType>("COURSE");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !resourceId) {
      return;
    }

    let active = true;

    const loadAssignments = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/learning-resources/${resourceId}/assignments`, { cache: "no-store" });
        const payload = await parseApiResponse<LearningResourceAssignmentItem[]>(response, "Failed to load assignments.");

        if (!active) {
          return;
        }

        setAssignments(payload);
      } catch (loadError) {
        if (!active) {
          return;
        }

        const message = loadError instanceof Error ? loadError.message : "Failed to load assignments.";
        setError(message);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadAssignments();

    return () => {
      active = false;
    };
  }, [open, refreshToken, resourceId]);

  const availableOptions = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const alreadyAssignedIds = new Set(
      assignments
        .filter((assignment) => assignment.targetType === selectedTargetType)
        .map((assignment) => assignment.targetId),
    );

    return getLookupOptions(lookups, selectedTargetType).filter((option) => {
      if (alreadyAssignedIds.has(option.id)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return `${option.label} ${option.meta ?? ""}`.toLowerCase().includes(normalizedQuery);
    });
  }, [assignments, lookups, searchQuery, selectedTargetType]);

  const toggleSelection = (id: string) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const handleAssign = async () => {
    if (!resourceId || selectedIds.length === 0) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/learning-resources/${resourceId}/assignments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assignments: selectedIds.map((targetId) => ({
            targetType: selectedTargetType,
            targetId,
            notes: notes.trim(),
          })),
        }),
      });

      await parseApiResponse(response, "Failed to assign learning resource.");
      toast.success("Assignments updated.");
      setSelectedIds([]);
      setNotes("");
      onAssignmentsUpdated();

      const reloadResponse = await fetch(`/api/learning-resources/${resourceId}/assignments`, { cache: "no-store" });
      const payload = await parseApiResponse<LearningResourceAssignmentItem[]>(reloadResponse, "Failed to load assignments.");
      setAssignments(payload);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to assign learning resource.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!resourceId) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/learning-resources/${resourceId}/assignments`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ assignmentId }),
      });

      await parseApiResponse(response, "Failed to remove assignment.");
      toast.success("Assignment removed.");
      setAssignments((current) => current.filter((assignment) => assignment.id !== assignmentId));
      onAssignmentsUpdated();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to remove assignment.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[860px]">
        <SheetHeader>
          <SheetTitle>Resource Assignments</SheetTitle>
          <SheetDescription>
            Attach {resourceTitle ?? "this learning resource"} to courses, batches, quiz pools, or trainer sessions. Repository folders only organize the source upload, and course assignments always place the file in the destination course root.
          </SheetDescription>
        </SheetHeader>

        <div className="grid min-h-0 flex-1 gap-5 overflow-hidden px-6 py-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-h-0 overflow-y-auto space-y-4">
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Current Assignments</p>

              {isLoading ? (
                <div className="mt-4 space-y-2">
                  <Skeleton className="h-16 w-full rounded-2xl" />
                  <Skeleton className="h-16 w-full rounded-2xl" />
                </div>
              ) : assignments.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {assignments.map((assignment) => (
                    <div key={assignment.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{assignment.targetLabel}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {LEARNING_RESOURCE_TARGET_TYPE_LABELS[assignment.targetType]} · {formatDateTime(assignment.assignedAt)}
                          </p>
                          {assignment.notes ? <p className="mt-2 text-sm text-slate-600">{assignment.notes}</p> : null}
                        </div>
                        <CanAccess permission="learning_resources.assign">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={isSubmitting}
                            onClick={() => void handleRemoveAssignment(assignment.id)}
                          >
                            Remove
                          </Button>
                        </CanAccess>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">No assignments exist yet.</p>
              )}
            </div>

            <CanAccess permission="learning_resources.assign">
              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Add Assignments</p>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Target Type</label>
                    <select
                      value={selectedTargetType}
                      onChange={(event) => {
                        setSelectedTargetType(event.target.value as LearningResourceTargetType);
                        setSelectedIds([]);
                        setSearchQuery("");
                      }}
                      className="block h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm text-slate-900"
                    >
                      {LEARNING_RESOURCE_TARGET_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Search Targets</label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="pl-9" placeholder="Filter available targets" />
                    </div>
                  </div>
                </div>

                <div className="mt-4 max-h-[280px] space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                  {availableOptions.length > 0 ? availableOptions.map((option) => {
                    const isSelected = selectedIds.includes(option.id);
                    return (
                      <label key={option.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 text-sm transition-colors ${isSelected ? "border-primary/30 bg-white" : "border-slate-200 bg-white/80 hover:bg-white"}`}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelection(option.id)}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{option.label}</p>
                          {option.meta ? <p className="mt-1 text-xs text-slate-500">{option.meta}</p> : null}
                        </div>
                      </label>
                    );
                  }) : (
                    <p className="px-2 py-4 text-sm text-slate-500">No available targets match the selected type and search.</p>
                  )}
                </div>

                <div className="mt-4 space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Notes</label>
                  <textarea
                    rows={4}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Optional context for why this resource is being assigned."
                    className="flex w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84]"
                  />
                </div>

                {error ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
              </div>
            </CanAccess>
          </div>

          <div className="space-y-4 rounded-3xl border border-slate-100 bg-slate-50/70 p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Assignment Summary</p>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Selected Type</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{LEARNING_RESOURCE_TARGET_TYPE_LABELS[selectedTargetType]}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Pending Targets</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{selectedIds.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Existing Coverage</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{assignments.length} assignment{assignments.length === 1 ? "" : "s"}</p>
            </div>
            <p className="text-sm leading-6 text-slate-600">
              Use this sheet to attach the same library item across course plans, batch delivery, reusable quiz pools, or trainer sessions without duplicating the file.
            </p>
          </div>
        </div>

        <SheetFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
          <CanAccess permission="learning_resources.assign">
            <Button type="button" onClick={() => void handleAssign()} disabled={selectedIds.length === 0 || isSubmitting}>
              Assign Selected Targets
            </Button>
          </CanAccess>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}