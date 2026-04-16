"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Calendar, ClipboardList, ExternalLink, Layers3, MapPin, Plus, Users } from "lucide-react";

import { CurriculumHierarchyView } from "@/components/modules/curriculum-builder/curriculum-hierarchy-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/ui/can-access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SheetLoadingSkeleton } from "@/components/ui/sheet-skeleton-variants";
import { Skeleton } from "@/components/ui/skeleton";
import { QUESTION_TYPE_LABELS } from "@/lib/question-types";
import { useRbac } from "@/lib/rbac-context";
import { cn } from "@/lib/utils";

type BatchStatus = "DRAFT" | "PLANNED" | "IN_SESSION" | "COMPLETED" | "ARCHIVED" | "CANCELLED";
type BatchMode = "ONLINE" | "OFFLINE";

type BatchDetail = {
  id: string;
  code: string;
  name: string;
  programName: string;
  centreId?: string | null;
  centreAddress?: string | null;
  campus: string | null;
  status: BatchStatus;
  mode: BatchMode;
  trainerIds: string[];
  trainerNames: string[];
  startDate?: string;
  endDate?: string | null;
  capacity?: number;
  schedule?: string[];
};

type CurriculumItemType = "CONTENT" | "ASSESSMENT";

type CurriculumItemReleaseType = "IMMEDIATE" | "ABSOLUTE_DATE" | "BATCH_RELATIVE" | "PREVIOUS_ITEM_COMPLETION" | "PREVIOUS_ITEM_SCORE" | "MANUAL";

type CurriculumStageItemReleaseDetail = {
  releaseType: CurriculumItemReleaseType;
  releaseAt: string | null;
  releaseOffsetDays: number | null;
  prerequisiteStageItemId: string | null;
  prerequisiteTitle: string | null;
  minimumScorePercent: number | null;
  estimatedDurationMinutes: number | null;
  dueAt: string | null;
  dueOffsetDays: number | null;
  resolvedUnlockAt: string | null;
  resolvedDueAt: string | null;
};

type CurriculumStageItemBatchManualRelease = {
  isReleased: boolean;
  releasedAt: string | null;
  releasedByName: string | null;
  note: string | null;
};

type CurriculumStageItemDetail = {
  id: string;
  itemType: CurriculumItemType;
  contentId: string | null;
  assessmentPoolId: string | null;
  sortOrder: number;
  isRequired: boolean;
  referenceCode: string | null;
  referenceTitle: string;
  referenceDescription: string | null;
  courseName: string | null;
  status: string | null;
  contentType: string | null;
  questionType: string | null;
  difficultyLevel: string | null;
  folderName: string | null;
  release: CurriculumStageItemReleaseDetail;
  batchManualRelease: CurriculumStageItemBatchManualRelease | null;
};

type CurriculumStageSummary = {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  itemCount: number;
  items: CurriculumStageItemDetail[];
};

type CurriculumModuleSummary = {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  stageCount: number;
  itemCount: number;
  stages: CurriculumStageSummary[];
};

type CurriculumDetailSnapshot = {
  id: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  title: string;
  description: string | null;
  status: string;
  moduleCount: number;
  stageCount: number;
  itemCount: number;
  batchCount: number;
  createdAt: string;
  createdByName: string | null;
  updatedAt: string;
  modules: CurriculumModuleSummary[];
};

type CurriculumSummarySnapshot = {
  id: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  title: string;
  description: string | null;
  status: string;
  moduleCount: number;
  stageCount: number;
  itemCount: number;
  batchCount: number;
  createdAt: string;
  updatedAt: string;
};

type BatchAssignedCurriculum = {
  mappingId: string;
  assignedAt: string;
  assignedByName: string | null;
  assignmentSource: "COURSE" | "BATCH" | "COURSE_AND_BATCH";
  isInheritedFromCourse: boolean;
  isBatchMapped: boolean;
  canRemoveBatchMapping: boolean;
  curriculum: CurriculumDetailSnapshot;
};

type BatchCurriculumWorkspace = {
  batchId: string;
  batchCode: string;
  batchName: string;
  programId: string | null;
  programName: string | null;
  courseId: string | null;
  courseCode: string | null;
  courseName: string | null;
  assignedCurricula: BatchAssignedCurriculum[];
  availableCurricula: CurriculumSummarySnapshot[];
};

type BatchAssignedAssessment = {
  id: string;
  assessmentPoolId: string;
  assessmentTitle: string;
  assessmentCode: string;
  questionType: string;
  difficultyLevel: string;
  status: string;
  questionCount: number;
  totalMarks: number;
  assignedByName: string | null;
  scheduledAt: string | null;
  assignedAt: string;
  assignmentSource: "COURSE" | "BATCH" | "COURSE_AND_BATCH";
  isInheritedFromCourse: boolean;
  isBatchMapped: boolean;
  canRemoveBatchMapping: boolean;
};

type AvailableBatchAssessment = {
  id: string;
  code: string;
  title: string;
  questionType: string;
  difficultyLevel: string;
  status: string;
  questionCount: number;
  totalMarks: number;
  courseName: string | null;
};

type ApiEnvelope<T> = {
  data?: T;
  error?: string;
};

type BatchDetailSheetProps = {
  batchId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (batchId: string) => void;
};

function statusVariant(status: BatchStatus) {
  if (status === "IN_SESSION") return "success" as const;
  if (status === "PLANNED") return "info" as const;
  if (status === "COMPLETED") return "default" as const;
  if (status === "ARCHIVED" || status === "CANCELLED") return "danger" as const;
  return "default" as const;
}

function curriculumStatusVariant(status: string) {
  if (status === "PUBLISHED") return "default" as const;
  if (status === "ARCHIVED") return "warning" as const;
  return "info" as const;
}

const assignmentSourceLabels: Record<BatchAssignedAssessment["assignmentSource"], string> = {
  COURSE: "Inherited from course",
  BATCH: "Batch-specific mapping",
  COURSE_AND_BATCH: "Inherited + batch mapping",
};

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(iso?: string | Date | null) {
  if (!iso) return "—";

  const date = iso instanceof Date ? iso : new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

async function readApiData<T>(response: Response, fallbackMessage: string) {
  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok) {
    throw new Error(payload.error || fallbackMessage);
  }

  return payload.data as T;
}

export function BatchDetailSheet({ batchId, open, onOpenChange, onEdit }: BatchDetailSheetProps) {
  const { can } = useRbac();
  const canEditCurriculumAssignments = can("batches.edit") || can("curriculum.edit");
  const canViewBatchAssessments = can("batch_content.view");
  const canAssignBatchAssessments = can("batch_content.assign");
  const canRemoveBatchAssessments = can("batch_content.remove");

  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"overview" | "curricula" | "assessments">("overview");
  const [curriculumWorkspace, setCurriculumWorkspace] = useState<BatchCurriculumWorkspace | null>(null);
  const [isLoadingCurricula, setIsLoadingCurricula] = useState(false);
  const [curriculumError, setCurriculumError] = useState<string | null>(null);
  const [selectedCurriculumId, setSelectedCurriculumId] = useState("");
  const [isUpdatingCurriculum, setIsUpdatingCurriculum] = useState(false);
  const [assignedAssessments, setAssignedAssessments] = useState<BatchAssignedAssessment[]>([]);
  const [availableAssessments, setAvailableAssessments] = useState<AvailableBatchAssessment[]>([]);
  const [isLoadingAssessments, setIsLoadingAssessments] = useState(false);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [selectedAssessmentPoolId, setSelectedAssessmentPoolId] = useState("");
  const [isUpdatingAssessments, setIsUpdatingAssessments] = useState(false);

  const assignedCount = curriculumWorkspace?.assignedCurricula.length ?? 0;
  const availableCount = curriculumWorkspace?.availableCurricula.length ?? 0;
  const assignedAssessmentCount = assignedAssessments.length;
  const availableAssessmentCount = availableAssessments.length;
  const manualReleaseSummary = useMemo(() => {
    const manualItems = curriculumWorkspace?.assignedCurricula.flatMap((assignment) => (
      assignment.curriculum.modules.flatMap((moduleRecord) => (
        moduleRecord.stages.flatMap((stage) => (
          stage.items.filter((item) => item.release.releaseType === "MANUAL")
        ))
      ))
    )) ?? [];

    return {
      total: manualItems.length,
      released: manualItems.filter((item) => item.batchManualRelease?.isReleased).length,
      pending: manualItems.filter((item) => !item.batchManualRelease?.isReleased).length,
    };
  }, [curriculumWorkspace]);

  const preferredAssignCurriculumId = useMemo(() => {
    if (selectedCurriculumId && curriculumWorkspace?.availableCurricula.some((curriculum) => curriculum.id === selectedCurriculumId)) {
      return selectedCurriculumId;
    }

    return curriculumWorkspace?.availableCurricula[0]?.id ?? "";
  }, [curriculumWorkspace?.availableCurricula, selectedCurriculumId]);

  useEffect(() => {
    setSelectedCurriculumId(preferredAssignCurriculumId);
  }, [preferredAssignCurriculumId]);

  const preferredAssignAssessmentPoolId = useMemo(() => {
    if (selectedAssessmentPoolId && availableAssessments.some((assessment) => assessment.id === selectedAssessmentPoolId)) {
      return selectedAssessmentPoolId;
    }

    return availableAssessments[0]?.id ?? "";
  }, [availableAssessments, selectedAssessmentPoolId]);

  useEffect(() => {
    setSelectedAssessmentPoolId(preferredAssignAssessmentPoolId);
  }, [preferredAssignAssessmentPoolId]);

  useEffect(() => {
    if (!open || !batchId) {
      return;
    }

    let active = true;

    setIsLoading(true);
    setError(null);
    setBatch(null);

    fetch(`/api/batches/${batchId}`, { cache: "no-store" })
      .then((response) => readApiData<BatchDetail>(response, "Failed to load batch details."))
      .then((payload) => {
        if (active) {
          setBatch(payload);
        }
      })
      .catch((fetchError) => {
        if (active) {
          setError(fetchError instanceof Error ? fetchError.message : "Failed to load batch details.");
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [batchId, open]);

  useEffect(() => {
    if (!open || !batchId || !canViewBatchAssessments) {
      setAssignedAssessments([]);
      setAvailableAssessments([]);
      setAssessmentError(null);
      setIsLoadingAssessments(false);
      return;
    }

    let active = true;

    setIsLoadingAssessments(true);
    setAssessmentError(null);

    Promise.all([
      fetch(`/api/batch-content?batchId=${batchId}&type=assessment`, { cache: "no-store" }).then((response) => readApiData<BatchAssignedAssessment[]>(response, "Failed to load batch assessments.")),
      fetch(`/api/batch-content?batchId=${batchId}&type=assessment&available=true`, { cache: "no-store" }).then((response) => readApiData<AvailableBatchAssessment[]>(response, "Failed to load available assessments.")),
    ])
      .then(([assignedPayload, availablePayload]) => {
        if (active) {
          setAssignedAssessments(assignedPayload ?? []);
          setAvailableAssessments(availablePayload ?? []);
        }
      })
      .catch((fetchError) => {
        if (active) {
          setAssessmentError(fetchError instanceof Error ? fetchError.message : "Failed to load batch assessments.");
          setAssignedAssessments([]);
          setAvailableAssessments([]);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingAssessments(false);
        }
      });

    return () => {
      active = false;
    };
  }, [batchId, canViewBatchAssessments, open]);

  useEffect(() => {
    if (!open || !batchId) {
      return;
    }

    let active = true;

    setIsLoadingCurricula(true);
    setCurriculumError(null);
    setCurriculumWorkspace(null);

    fetch(`/api/batches/${batchId}/curriculum`, { cache: "no-store" })
      .then((response) => readApiData<BatchCurriculumWorkspace>(response, "Failed to load batch curricula."))
      .then((payload) => {
        if (active) {
          setCurriculumWorkspace(payload);
        }
      })
      .catch((fetchError) => {
        if (active) {
          setCurriculumError(fetchError instanceof Error ? fetchError.message : "Failed to load batch curricula.");
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingCurricula(false);
        }
      });

    return () => {
      active = false;
    };
  }, [batchId, open]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);

    if (!nextOpen) {
      setBatch(null);
      setError(null);
      setActiveTab("overview");
      setCurriculumWorkspace(null);
      setCurriculumError(null);
      setSelectedCurriculumId("");
      setIsUpdatingCurriculum(false);
      setAssignedAssessments([]);
      setAvailableAssessments([]);
      setAssessmentError(null);
      setSelectedAssessmentPoolId("");
      setIsUpdatingAssessments(false);
    }
  };

  async function refreshBatchAssessments() {
    if (!batchId || !canViewBatchAssessments) {
      return;
    }

    const [assignedPayload, availablePayload] = await Promise.all([
      fetch(`/api/batch-content?batchId=${batchId}&type=assessment`, { cache: "no-store" }).then((response) => readApiData<BatchAssignedAssessment[]>(response, "Failed to load batch assessments.")),
      fetch(`/api/batch-content?batchId=${batchId}&type=assessment&available=true`, { cache: "no-store" }).then((response) => readApiData<AvailableBatchAssessment[]>(response, "Failed to load available assessments.")),
    ]);

    setAssignedAssessments(assignedPayload ?? []);
    setAvailableAssessments(availablePayload ?? []);
  }

  async function handleAssignCurriculum() {
    if (!batchId || !selectedCurriculumId) {
      return;
    }

    setIsUpdatingCurriculum(true);
    setCurriculumError(null);

    try {
      const response = await fetch(`/api/batches/${batchId}/curriculum`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ curriculumId: selectedCurriculumId }),
      });
      const payload = await readApiData<BatchCurriculumWorkspace>(response, "Failed to assign curriculum to batch.");
      setCurriculumWorkspace(payload);
    } catch (assignError) {
      setCurriculumError(assignError instanceof Error ? assignError.message : "Failed to assign curriculum to batch.");
    } finally {
      setIsUpdatingCurriculum(false);
    }
  }

  async function handleRemoveCurriculum(curriculumId: string) {
    if (!batchId) {
      return;
    }

    setIsUpdatingCurriculum(true);
    setCurriculumError(null);

    try {
      const response = await fetch(`/api/batches/${batchId}/curriculum`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ curriculumId }),
      });
      const payload = await readApiData<BatchCurriculumWorkspace>(response, "Failed to remove curriculum from batch.");
      setCurriculumWorkspace(payload);
    } catch (removeError) {
      setCurriculumError(removeError instanceof Error ? removeError.message : "Failed to remove curriculum from batch.");
    } finally {
      setIsUpdatingCurriculum(false);
    }
  }

  async function handleReleaseCurriculumItem(itemId: string) {
    if (!batchId) {
      return;
    }

    setIsUpdatingCurriculum(true);
    setCurriculumError(null);

    try {
      const response = await fetch(`/api/batches/${batchId}/curriculum/stage-items/${itemId}/release`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const payload = await readApiData<BatchCurriculumWorkspace>(response, "Failed to release curriculum item for batch.");
      setCurriculumWorkspace(payload);
    } catch (releaseError) {
      setCurriculumError(releaseError instanceof Error ? releaseError.message : "Failed to release curriculum item for batch.");
    } finally {
      setIsUpdatingCurriculum(false);
    }
  }

  async function handleRevokeCurriculumItemRelease(itemId: string) {
    if (!batchId) {
      return;
    }

    setIsUpdatingCurriculum(true);
    setCurriculumError(null);

    try {
      const response = await fetch(`/api/batches/${batchId}/curriculum/stage-items/${itemId}/release`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const payload = await readApiData<BatchCurriculumWorkspace>(response, "Failed to revoke manual release for curriculum item.");
      setCurriculumWorkspace(payload);
    } catch (releaseError) {
      setCurriculumError(releaseError instanceof Error ? releaseError.message : "Failed to revoke manual release for curriculum item.");
    } finally {
      setIsUpdatingCurriculum(false);
    }
  }

  async function handleAssignAssessment() {
    if (!batchId || !selectedAssessmentPoolId) {
      return;
    }

    setIsUpdatingAssessments(true);
    setAssessmentError(null);

    try {
      const response = await fetch(`/api/batch-content`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "assessment",
          batchId,
          assessmentPoolIds: [selectedAssessmentPoolId],
        }),
      });

      await readApiData(response, "Failed to assign assessment to batch.");
      await refreshBatchAssessments();
    } catch (assignError) {
      setAssessmentError(assignError instanceof Error ? assignError.message : "Failed to assign assessment to batch.");
    } finally {
      setIsUpdatingAssessments(false);
    }
  }

  async function handleRemoveAssessment(assessmentPoolId: string) {
    if (!batchId) {
      return;
    }

    setIsUpdatingAssessments(true);
    setAssessmentError(null);

    try {
      const response = await fetch(`/api/batch-content`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "assessment",
          batchId,
          assessmentPoolId,
        }),
      });

      await readApiData(response, "Failed to remove assessment from batch.");
      await refreshBatchAssessments();
    } catch (removeError) {
      setAssessmentError(removeError instanceof Error ? removeError.message : "Failed to remove assessment from batch.");
    } finally {
      setIsUpdatingAssessments(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex flex-col overflow-hidden sm:max-w-[1120px]">
        {isLoading ? (
          <SheetLoadingSkeleton isLoading={true} variant="detail" />
        ) : error ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-rose-600">{error}</p>
          </div>
        ) : batch ? (
          <>
            <SheetHeader className="border-b border-[#e2e8f0] pb-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-blue-50 text-primary shadow-sm">
                    <BookOpen className="h-6 w-6" />
                  </div>
                  <div>
                    <SheetTitle>{batch.name}</SheetTitle>
                    <SheetDescription className="mt-1 text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                      {batch.code}
                    </SheetDescription>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant={statusVariant(batch.status)}>{batch.status.replace("_", " ")}</Badge>
                      <Badge variant="default">{batch.mode}</Badge>
                      <Badge variant="info">{batch.programName}</Badge>
                    </div>
                  </div>
                </div>

                <div className={cn("grid gap-3 lg:min-w-[360px]", canViewBatchAssessments ? "sm:grid-cols-4 lg:min-w-[480px]" : "sm:grid-cols-3")}>
                  <div className="rounded-2xl border border-[#dde6f0] bg-slate-50/80 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Capacity</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">{batch.capacity ?? "—"}</p>
                  </div>
                  <div className="rounded-2xl border border-[#dde6f0] bg-slate-50/80 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Trainers</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">{batch.trainerNames.length}</p>
                  </div>
                  <div className="rounded-2xl border border-[#dde6f0] bg-slate-50/80 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Curricula</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">{isLoadingCurricula ? "…" : assignedCount}</p>
                  </div>
                  {canViewBatchAssessments ? (
                    <div className="rounded-2xl border border-[#dde6f0] bg-slate-50/80 px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Assessments</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{isLoadingAssessments ? "…" : assignedAssessmentCount}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
              <div className="space-y-5">
                <div className="flex w-full flex-wrap gap-2 rounded-2xl border border-[#dde1e6] bg-white p-2 shadow-sm">
                  <button
                    type="button"
                    className={cn(
                      "flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
                      activeTab === "overview"
                        ? "bg-primary text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100",
                    )}
                    onClick={() => setActiveTab("overview")}
                  >
                    Batch Overview
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
                      activeTab === "curricula"
                        ? "bg-primary text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100",
                    )}
                    onClick={() => setActiveTab("curricula")}
                  >
                    Curricula ({isLoadingCurricula ? "…" : assignedCount})
                  </button>
                  {canViewBatchAssessments ? (
                    <button
                      type="button"
                      className={cn(
                        "flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
                        activeTab === "assessments"
                          ? "bg-primary text-white shadow-sm"
                          : "text-slate-600 hover:bg-slate-100",
                      )}
                      onClick={() => setActiveTab("assessments")}
                    >
                      Assessments ({isLoadingAssessments ? "…" : assignedAssessmentCount})
                    </button>
                  ) : null}
                </div>

                {activeTab === "overview" ? (
                  <div className="space-y-4">
                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Program</p>
                      <div className="mt-3 flex items-start gap-3">
                        <BookOpen className="mt-0.5 h-4 w-4 text-primary" />
                        <p className="text-sm font-semibold text-slate-900">{batch.programName}</p>
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Schedule</p>
                        <div className="mt-3 space-y-2 text-sm text-slate-600">
                          <div className="flex items-start gap-3">
                            <Calendar className="mt-0.5 h-4 w-4 text-primary" />
                            <div>
                              <p className="font-semibold text-slate-900">Start</p>
                              <p>{formatDate(batch.startDate)}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <Calendar className="mt-0.5 h-4 w-4 text-primary" />
                            <div>
                              <p className="font-semibold text-slate-900">End</p>
                              <p>{formatDate(batch.endDate)}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Logistics</p>
                        <div className="mt-3 space-y-2 text-sm text-slate-600">
                          <div className="flex items-start gap-3">
                            <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                            <div>
                              <p className="font-semibold text-slate-900">Campus</p>
                              <p>{batch.campus ?? "Not specified"}</p>
                              {batch.centreAddress ? <p className="mt-1 text-xs text-slate-500">{batch.centreAddress}</p> : null}
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <Users className="mt-0.5 h-4 w-4 text-primary" />
                            <div>
                              <p className="font-semibold text-slate-900">Capacity</p>
                              <p>{batch.capacity ?? "—"}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={cn("grid gap-4", canViewBatchAssessments ? "xl:grid-cols-[minmax(0,1fr)_320px_320px]" : "xl:grid-cols-[minmax(0,1fr)_340px]")}>
                      <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Assigned Trainers</p>
                        {batch.trainerNames.length === 0 ? (
                          <p className="mt-3 text-sm text-slate-500">No trainers assigned.</p>
                        ) : (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {batch.trainerNames.map((name) => (
                              <span key={name} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                                {name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Curriculum Snapshot</p>
                        <div className="mt-3 space-y-3 text-sm text-slate-600">
                          <p>{assignedCount === 0 ? "No published curricula are currently available to this batch." : `${assignedCount} curriculum${assignedCount === 1 ? "" : "s"} currently available to this batch.`}</p>
                          <p>{availableCount > 0 ? `${availableCount} unpublished ${availableCount === 1 ? "curriculum is" : "curricula are"} still available for batch mapping from the Curricula tab.` : "No additional unpublished curricula are currently available for batch mapping."}</p>
                          <Button type="button" variant="secondary" size="sm" onClick={() => setActiveTab("curricula")}>Review Curricula</Button>
                        </div>
                      </div>

                      {canViewBatchAssessments ? (
                        <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Assessment Snapshot</p>
                          <div className="mt-3 space-y-3 text-sm text-slate-600">
                            <p>
                              {assignedAssessmentCount === 0
                                ? "No published assessments are currently available to this batch."
                                : `${assignedAssessmentCount} assessment${assignedAssessmentCount === 1 ? "" : "s"} currently available to this batch.`}
                            </p>
                            <p>
                              {availableAssessmentCount > 0
                                ? `${availableAssessmentCount} supplemental published assessments can still be batch-mapped from this course.`
                                : "No supplemental published assessments are currently available for batch mapping."}
                            </p>
                            <Button type="button" variant="secondary" size="sm" onClick={() => setActiveTab("assessments")}>Review Assessments</Button>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {batch.schedule && batch.schedule.length > 0 ? (
                      <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Days</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {batch.schedule.map((day) => (
                            <span key={day} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                              {day}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : activeTab === "curricula" ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-lg font-semibold text-slate-950">Curriculum Workspace</p>
                              <p className="mt-1 text-sm leading-6 text-slate-600">
                                Review every curriculum available to this batch. Published course curricula are inherited automatically, while unpublished curricula can still be batch-mapped for batch-level planning. Manual item releases can be actioned inline when a sequence uses controlled drip unlocks.
                              </p>
                            </div>
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-primary">
                              <Layers3 className="h-5 w-5" />
                            </div>
                          </div>

                          {curriculumWorkspace ? (
                            <div className="mt-5 grid gap-3 sm:grid-cols-3">
                              <div className="rounded-2xl border border-[#e2e8f0] bg-slate-50/80 px-4 py-3">
                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Program</p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">{curriculumWorkspace.programName ?? "—"}</p>
                              </div>
                              <div className="rounded-2xl border border-[#e2e8f0] bg-slate-50/80 px-4 py-3">
                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Course</p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">{curriculumWorkspace.courseName ?? "—"}</p>
                              </div>
                              <div className="rounded-2xl border border-[#e2e8f0] bg-slate-50/80 px-4 py-3">
                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Assigned</p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">{assignedCount} curriculum{assignedCount === 1 ? "" : "s"}</p>
                              </div>
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-4">
                          <CardTitle className="text-base">Inline Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {canEditCurriculumAssignments ? (
                            <>
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Add a batch-mapped curriculum</label>
                                <select
                                  value={selectedCurriculumId}
                                  onChange={(event) => setSelectedCurriculumId(event.target.value)}
                                  disabled={isUpdatingCurriculum || availableCount === 0}
                                  className="block w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84]"
                                >
                                  <option value="">Select a curriculum...</option>
                                  {curriculumWorkspace?.availableCurricula.map((curriculumOption) => (
                                    <option key={curriculumOption.id} value={curriculumOption.id}>{curriculumOption.title}</option>
                                  ))}
                                </select>
                                <p className="text-xs leading-5 text-slate-500">
                                  Published course curricula already appear automatically. Use this only for unpublished curricula that still need batch-specific planning.
                                </p>
                              </div>
                              <Button
                                type="button"
                                disabled={isUpdatingCurriculum || !selectedCurriculumId}
                                onClick={() => void handleAssignCurriculum()}
                              >
                                <Plus className="h-4 w-4" />
                                {isUpdatingCurriculum ? "Updating..." : "Add Batch Mapping"}
                              </Button>

                              <div className="rounded-2xl border border-[#e2e8f0] bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Manual Gates</p>
                                {manualReleaseSummary.total > 0 ? (
                                  <>
                                    <p className="mt-2 font-semibold text-slate-900">{manualReleaseSummary.released} released · {manualReleaseSummary.pending} pending</p>
                                    <p className="mt-1 text-xs leading-5 text-slate-500">Use the inline release controls below on any item configured for manual release.</p>
                                  </>
                                ) : (
                                  <p className="mt-2 text-xs leading-5 text-slate-500">No manually released curriculum items are configured in the currently assigned curricula.</p>
                                )}
                              </div>
                            </>
                          ) : (
                            <p className="text-sm leading-6 text-slate-500">You can review inherited and batch-mapped curricula here, but only batch or curriculum editors can change explicit mappings.</p>
                          )}

                          <Button asChild variant="secondary" size="sm">
                            <Link href="/curriculum-builder">
                              <ExternalLink className="h-4 w-4" />
                              Open Curriculum Builder
                            </Link>
                          </Button>
                        </CardContent>
                      </Card>
                    </div>

                    {curriculumError ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{curriculumError}</div>
                    ) : null}

                    {isLoadingCurricula ? (
                      <div className="space-y-4">
                        <Skeleton className="h-32 w-full rounded-3xl" />
                        <Skeleton className="h-48 w-full rounded-3xl" />
                        <Skeleton className="h-48 w-full rounded-3xl" />
                      </div>
                    ) : curriculumWorkspace?.assignedCurricula.length ? (
                      <div className="space-y-6">
                        {curriculumWorkspace.assignedCurricula.map((assignment) => (
                          <div key={assignment.mappingId} className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dde1e6] bg-white px-4 py-3 shadow-sm">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-slate-900">{assignment.curriculum.title}</p>
                                <Badge variant={curriculumStatusVariant(assignment.curriculum.status)}>{assignment.curriculum.status}</Badge>
                                <Badge variant="info">{assignmentSourceLabels[assignment.assignmentSource]}</Badge>
                                <Badge variant="info">{assignment.curriculum.moduleCount} modules</Badge>
                                <Badge variant="info">{assignment.curriculum.stageCount} stages</Badge>
                              </div>
                              {canEditCurriculumAssignments && assignment.canRemoveBatchMapping ? (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  disabled={isUpdatingCurriculum}
                                  onClick={() => void handleRemoveCurriculum(assignment.curriculum.id)}
                                >
                                  Remove Batch Mapping
                                </Button>
                              ) : null}
                            </div>

                            <CurriculumHierarchyView
                              curriculum={assignment.curriculum}
                              assignedAt={assignment.assignedAt}
                              assignedByName={assignment.assignedByName}
                              renderItemFooter={(item) => item.release?.releaseType === "MANUAL" ? (
                                <div className="mt-3 rounded-2xl border border-[#e2e8f0] bg-white/90 px-3 py-3">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="space-y-1 text-xs leading-5 text-slate-500">
                                      <p className="font-semibold text-slate-700">
                                        {item.batchManualRelease?.isReleased
                                          ? `Released ${formatDateTime(item.batchManualRelease.releasedAt)}${item.batchManualRelease.releasedByName ? ` by ${item.batchManualRelease.releasedByName}` : ""}`
                                          : "Pending manual release for this batch."}
                                      </p>
                                      {item.batchManualRelease?.note ? <p>Note: {item.batchManualRelease.note}</p> : null}
                                    </div>

                                    {canEditCurriculumAssignments ? (
                                      item.batchManualRelease?.isReleased ? (
                                        <Button
                                          type="button"
                                          variant="secondary"
                                          size="sm"
                                          disabled={isUpdatingCurriculum}
                                          onClick={() => {
                                            if (window.confirm(`Revoke manual release for \"${item.referenceTitle}\" in this batch?`)) {
                                              void handleRevokeCurriculumItemRelease(item.id);
                                            }
                                          }}
                                        >
                                          Revoke Release
                                        </Button>
                                      ) : (
                                        <Button
                                          type="button"
                                          size="sm"
                                          disabled={isUpdatingCurriculum}
                                          onClick={() => void handleReleaseCurriculumItem(item.id)}
                                        >
                                          Release For Batch
                                        </Button>
                                      )
                                    ) : null}
                                  </div>
                                </div>
                              ) : null}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-3xl border border-dashed bg-white p-8 text-center shadow-sm">
                        <p className="text-base font-semibold text-slate-900">No curricula available yet</p>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          Publish a course curriculum to inherit it automatically into this batch, or add an unpublished curriculum mapping here for planning.
                        </p>
                      </div>
                    )}
                  </div>
                ) : canViewBatchAssessments ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-lg font-semibold text-slate-950">Assessment Workspace</p>
                              <p className="mt-1 text-sm leading-6 text-slate-600">
                                Review every published assessment available to this batch. Course-linked pools are inherited automatically, while batch mappings stay available for supplemental delivery and scheduling.
                              </p>
                            </div>
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-primary">
                              <ClipboardList className="h-5 w-5" />
                            </div>
                          </div>

                          <div className="mt-5 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-2xl border border-[#e2e8f0] bg-slate-50/80 px-4 py-3">
                              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Assigned</p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">{assignedAssessmentCount} assessment{assignedAssessmentCount === 1 ? "" : "s"}</p>
                            </div>
                            <div className="rounded-2xl border border-[#e2e8f0] bg-slate-50/80 px-4 py-3">
                              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Available</p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">{availableAssessmentCount} published pool{availableAssessmentCount === 1 ? "" : "s"}</p>
                            </div>
                            <div className="rounded-2xl border border-[#e2e8f0] bg-slate-50/80 px-4 py-3">
                              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Status</p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">{isLoadingAssessments ? "Syncing" : "Ready"}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-4">
                          <CardTitle className="text-base">Inline Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {canAssignBatchAssessments ? (
                            <>
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Add a supplemental assessment</label>
                                <select
                                  value={selectedAssessmentPoolId}
                                  onChange={(event) => setSelectedAssessmentPoolId(event.target.value)}
                                  disabled={isUpdatingAssessments || availableAssessmentCount === 0}
                                  className="block w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84]"
                                >
                                  <option value="">Select an assessment...</option>
                                  {availableAssessments.map((assessmentOption) => (
                                    <option key={assessmentOption.id} value={assessmentOption.id}>
                                      {assessmentOption.code} - {assessmentOption.title}
                                    </option>
                                  ))}
                                </select>
                                <p className="text-xs leading-5 text-slate-500">
                                  Course-linked assessments already appear automatically. Use this only for additional batch-specific pools.
                                </p>
                              </div>
                              <Button
                                type="button"
                                disabled={isUpdatingAssessments || !selectedAssessmentPoolId}
                                onClick={() => void handleAssignAssessment()}
                              >
                                <Plus className="h-4 w-4" />
                                {isUpdatingAssessments ? "Updating..." : "Add Batch Mapping"}
                              </Button>
                            </>
                          ) : (
                            <p className="text-sm leading-6 text-slate-500">You can review assigned assessments here, but only users with batch-content assignment access can change them.</p>
                          )}

                          <Button asChild variant="secondary" size="sm">
                            <Link href="/assessments">
                              <ExternalLink className="h-4 w-4" />
                              Open Assessments
                            </Link>
                          </Button>
                        </CardContent>
                      </Card>
                    </div>

                    {assessmentError ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{assessmentError}</div>
                    ) : null}

                    {isLoadingAssessments ? (
                      <div className="space-y-4">
                        <Skeleton className="h-32 w-full rounded-3xl" />
                        <Skeleton className="h-40 w-full rounded-3xl" />
                        <Skeleton className="h-40 w-full rounded-3xl" />
                      </div>
                    ) : assignedAssessments.length ? (
                      <div className="space-y-4">
                        {assignedAssessments.map((assessment) => (
                          <Card key={assessment.id}>
                            <CardContent className="pt-6">
                              <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-base font-semibold text-slate-950">{assessment.assessmentTitle}</p>
                                    <Badge variant="info">{assessment.assessmentCode}</Badge>
                                    <Badge variant={curriculumStatusVariant(assessment.status)}>{assessment.status}</Badge>
                                    <Badge variant="info">{assignmentSourceLabels[assessment.assignmentSource]}</Badge>
                                  </div>
                                  <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-500">
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{QUESTION_TYPE_LABELS[assessment.questionType as keyof typeof QUESTION_TYPE_LABELS] ?? assessment.questionType}</span>
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{assessment.difficultyLevel}</span>
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{assessment.questionCount} questions</span>
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{assessment.totalMarks} marks</span>
                                  </div>
                                </div>

                                {canRemoveBatchAssessments && assessment.canRemoveBatchMapping ? (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    disabled={isUpdatingAssessments}
                                    onClick={() => void handleRemoveAssessment(assessment.assessmentPoolId)}
                                  >
                                    Remove Mapping
                                  </Button>
                                ) : null}
                              </div>

                              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                <div className="rounded-2xl border border-[#e2e8f0] bg-slate-50/80 px-4 py-3">
                                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Assigned By</p>
                                  <p className="mt-1 text-sm font-semibold text-slate-900">{assessment.assignedByName ?? (assessment.isInheritedFromCourse ? "Course inheritance" : "System")}</p>
                                </div>
                                <div className="rounded-2xl border border-[#e2e8f0] bg-slate-50/80 px-4 py-3">
                                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Assigned On</p>
                                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatDate(assessment.assignedAt)}</p>
                                </div>
                                <div className="rounded-2xl border border-[#e2e8f0] bg-slate-50/80 px-4 py-3">
                                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Scheduled Use</p>
                                  <p className="mt-1 text-sm font-semibold text-slate-900">{assessment.scheduledAt ? formatDate(assessment.scheduledAt) : "Not yet linked"}</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-3xl border border-dashed bg-white p-8 text-center shadow-sm">
                        <p className="text-base font-semibold text-slate-900">No assessments mapped yet</p>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          Assign published assessments here so schedule events can attach them without leaving the batch workflow.
                        </p>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <SheetFooter>
              <Button variant="secondary" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
              <CanAccess permission="batches.edit">
                <Button onClick={() => onEdit(batch.id)}>
                  Edit Batch
                </Button>
              </CanAccess>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
