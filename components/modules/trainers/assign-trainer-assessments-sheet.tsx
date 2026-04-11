"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SheetLoadingSkeleton } from "@/components/ui/sheet-skeleton-variants";
import type { TrainerDetail } from "@/services/trainers/types";
import type { TrainerAssessmentAssignmentItem } from "@/services/trainer-assessments/types";

type AssessmentPoolItem = {
  id: string;
  code: string;
  title: string;
  questionType: string;
  difficultyLevel: string;
  status: string;
};

type AssignmentState = {
  canReviewSubmissions: boolean;
  canManageAttempts: boolean;
  canManualGrade: boolean;
};

type AssignTrainerAssessmentsSheetProps = {
  trainerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
};

function buildAssignmentStateMap(assignments: TrainerAssessmentAssignmentItem[]) {
  return assignments.reduce<Record<string, AssignmentState>>((accumulator, assignment) => {
    accumulator[assignment.assessmentPoolId] = {
      canReviewSubmissions: assignment.canReviewSubmissions,
      canManageAttempts: assignment.canManageAttempts,
      canManualGrade: assignment.canManualGrade,
    };
    return accumulator;
  }, {});
}

function hasAssignmentEnabled(state: AssignmentState | undefined) {
  return Boolean(state?.canReviewSubmissions || state?.canManageAttempts || state?.canManualGrade);
}

export function AssignTrainerAssessmentsSheet({
  trainerId,
  open,
  onOpenChange,
  onUpdated,
}: AssignTrainerAssessmentsSheetProps) {
  const [trainer, setTrainer] = useState<TrainerDetail | null>(null);
  const [assessmentPools, setAssessmentPools] = useState<AssessmentPoolItem[]>([]);
  const [assignmentMap, setAssignmentMap] = useState<Record<string, AssignmentState>>({});
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !trainerId) {
      return;
    }

    let active = true;

    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [trainerResponse, poolsResponse, assignmentsResponse] = await Promise.all([
          fetch(`/api/trainers/${trainerId}`, { cache: "no-store" }),
          fetch("/api/assessment-pool", { cache: "no-store" }),
          fetch(`/api/trainers/${trainerId}/assessments`, { cache: "no-store" }),
        ]);

        if (!trainerResponse.ok || !poolsResponse.ok || !assignmentsResponse.ok) {
          throw new Error("Failed to load trainer assessment assignments.");
        }

        const trainerPayload = (await trainerResponse.json()) as { data?: TrainerDetail };
        const poolsPayload = (await poolsResponse.json()) as { data?: AssessmentPoolItem[] };
        const assignmentsPayload = (await assignmentsResponse.json()) as { data?: TrainerAssessmentAssignmentItem[] };

        if (!active || !trainerPayload.data) {
          return;
        }

        const assignments = assignmentsPayload.data ?? [];
        const assignedPoolIds = new Set(assignments.map((assignment) => assignment.assessmentPoolId));
        const visiblePools = (poolsPayload.data ?? []).filter((pool) => pool.status !== "ARCHIVED" || assignedPoolIds.has(pool.id));

        setTrainer(trainerPayload.data);
        setAssessmentPools(visiblePools);
        setAssignmentMap(buildAssignmentStateMap(assignments));
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Failed to load trainer assessment assignments.");
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      active = false;
    };
  }, [open, trainerId]);

  const visiblePools = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) {
      return assessmentPools;
    }

    return assessmentPools.filter((pool) =>
      pool.title.toLowerCase().includes(normalizedSearch)
      || pool.code.toLowerCase().includes(normalizedSearch)
      || pool.questionType.toLowerCase().includes(normalizedSearch)
      || pool.difficultyLevel.toLowerCase().includes(normalizedSearch),
    );
  }, [assessmentPools, search]);

  const setAssignmentValue = (assessmentPoolId: string, key: keyof AssignmentState, checked: boolean) => {
    setAssignmentMap((currentValue) => ({
      ...currentValue,
      [assessmentPoolId]: {
        canReviewSubmissions: currentValue[assessmentPoolId]?.canReviewSubmissions ?? false,
        canManageAttempts: currentValue[assessmentPoolId]?.canManageAttempts ?? false,
        canManualGrade: currentValue[assessmentPoolId]?.canManualGrade ?? false,
        [key]: checked,
      },
    }));
  };

  const handleSubmit = async () => {
    if (!trainerId) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const assignments = Object.entries(assignmentMap)
        .filter(([, state]) => hasAssignmentEnabled(state))
        .map(([assessmentPoolId, state]) => ({
          assessmentPoolId,
          canReviewSubmissions: state.canReviewSubmissions,
          canManageAttempts: state.canManageAttempts,
          canManualGrade: state.canManualGrade,
        }));

      const response = await fetch(`/api/trainers/${trainerId}/assessments`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ assignments }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to save trainer assessment assignments.");
      }

      toast.success("Trainer quiz assignments updated successfully.");
      onUpdated?.();
      onOpenChange(false);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to save trainer assessment assignments.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setTrainer(null);
      setAssessmentPools([]);
      setAssignmentMap({});
      setSearch("");
      setError(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>Assign Quiz Responsibilities</SheetTitle>
          <SheetDescription>
            {trainer
              ? `Choose the assessments ${trainer.fullName} can review, manage, and grade.`
              : "Choose the assessments this trainer can review, manage, and grade."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex h-full flex-col overflow-hidden p-6">
          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
            {isLoading ? (
              <SheetLoadingSkeleton isLoading={true} variant="form" />
            ) : (
              <>
                {trainer ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <p className="font-semibold text-slate-900">{trainer.fullName}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">{trainer.employeeCode}</p>
                  </div>
                ) : null}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Search assessments</label>
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Filter by title, code, type, or difficulty..."
                  />
                </div>

                <div className="grid gap-4">
                  {visiblePools.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                      No assessments matched the current filter.
                    </div>
                  ) : (
                    visiblePools.map((pool) => {
                      const state = assignmentMap[pool.id] ?? {
                        canReviewSubmissions: false,
                        canManageAttempts: false,
                        canManualGrade: false,
                      };

                      return (
                        <div key={pool.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{pool.title}</p>
                              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{pool.code}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="info">{pool.questionType.replaceAll("_", " ")}</Badge>
                              <Badge variant="default">{pool.difficultyLevel}</Badge>
                              <Badge variant={pool.status === "PUBLISHED" ? "success" : "warning"}>{pool.status}</Badge>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                              <Checkbox
                                checked={state.canReviewSubmissions}
                                onCheckedChange={(checked) => setAssignmentValue(pool.id, "canReviewSubmissions", checked === true)}
                              />
                              <span>
                                <span className="block font-semibold text-slate-900">Review submissions</span>
                                <span className="block text-xs text-slate-500">Inspect answers and grading history.</span>
                              </span>
                            </label>
                            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                              <Checkbox
                                checked={state.canManageAttempts}
                                onCheckedChange={(checked) => setAssignmentValue(pool.id, "canManageAttempts", checked === true)}
                              />
                              <span>
                                <span className="block font-semibold text-slate-900">Manage attempts</span>
                                <span className="block text-xs text-slate-500">Move work between queue and in-review.</span>
                              </span>
                            </label>
                            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                              <Checkbox
                                checked={state.canManualGrade}
                                onCheckedChange={(checked) => setAssignmentValue(pool.id, "canManualGrade", checked === true)}
                              />
                              <span>
                                <span className="block font-semibold text-slate-900">Manual grade</span>
                                <span className="block text-xs text-slate-500">Score essay and reasoning questions.</span>
                              </span>
                            </label>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p> : null}
              </>
            )}
          </div>

          {!isLoading ? (
            <SheetFooter className="p-0 pt-4 sm:justify-end sm:border-0">
              <Button variant="secondary" type="button" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Quiz Access"}
              </Button>
            </SheetFooter>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}