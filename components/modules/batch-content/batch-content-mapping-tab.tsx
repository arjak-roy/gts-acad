"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/ui/can-access";
import { Skeleton } from "@/components/ui/skeleton";
import { QUESTION_TYPE_SHORT_LABELS } from "@/lib/question-types";

type BatchContentItem = {
  id: string;
  contentId: string;
  resourceId: string | null;
  resourceAssignmentId: string | null;
  contentTitle: string;
  contentType: string;
  contentStatus: string;
  fileName: string | null;
  assignedByName: string | null;
  assignedAt: string;
  assignmentSource: "COURSE" | "BATCH" | "COURSE_AND_BATCH";
  isInheritedFromCourse: boolean;
  isBatchMapped: boolean;
  canRemoveBatchMapping: boolean;
};

type BatchAssessmentItem = {
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

type AvailableContent = {
  id: string;
  sourceContentId: string | null;
  title: string;
  contentType: string;
  fileName: string | null;
  folderName: string | null;
  sourceCourseName: string | null;
  hasSourceContent: boolean;
};

type AvailableAssessment = {
  id: string;
  code: string;
  title: string;
  questionType: string;
  difficultyLevel: string;
  totalMarks: number;
  questionCount: number;
};

type BatchOption = {
  id: string;
  code: string;
  name: string;
};

const assignmentSourceLabels: Record<BatchContentItem["assignmentSource"], string> = {
  COURSE: "Inherited from course",
  BATCH: "Batch-specific mapping",
  COURSE_AND_BATCH: "Inherited + batch mapping",
};

export function BatchContentMappingTab() {
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [activeTab, setActiveTab] = useState<"content" | "assessment">("content");

  const [assignedContent, setAssignedContent] = useState<BatchContentItem[]>([]);
  const [assignedAssessments, setAssignedAssessments] = useState<BatchAssessmentItem[]>([]);
  const [availableContent, setAvailableContent] = useState<AvailableContent[]>([]);
  const [availableAssessments, setAvailableAssessments] = useState<AvailableAssessment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAvailable, setShowAvailable] = useState(false);

  useEffect(() => {
    const loadBatches = async () => {
      try {
        const response = await fetch("/api/batches", { cache: "no-store" });
        if (!response.ok) return;
        const result = (await response.json()) as { data?: BatchOption[] };
        setBatches(result.data ?? []);
      } catch {
        // Silently fail
      }
    };
    void loadBatches();
  }, []);

  const fetchAssigned = useCallback(async () => {
    if (!selectedBatchId) return;
    setIsLoading(true);
    try {
      const [contentRes, assessmentRes] = await Promise.all([
        fetch(`/api/batch-content?batchId=${selectedBatchId}&type=content`, { cache: "no-store" }),
        fetch(`/api/batch-content?batchId=${selectedBatchId}&type=assessment`, { cache: "no-store" }),
      ]);

      if (contentRes.ok) {
        const contentData = (await contentRes.json()) as { data?: BatchContentItem[] };
        setAssignedContent(contentData.data ?? []);
      }
      if (assessmentRes.ok) {
        const assessmentData = (await assessmentRes.json()) as { data?: BatchAssessmentItem[] };
        setAssignedAssessments(assessmentData.data ?? []);
      }
    } catch {
      toast.error("Failed to load batch mappings.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedBatchId]);

  const fetchAvailable = useCallback(async () => {
    if (!selectedBatchId) return;
    try {
      if (activeTab === "content") {
        const res = await fetch(`/api/batch-content?batchId=${selectedBatchId}&type=content&available=true`, { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { data?: AvailableContent[] };
          setAvailableContent(data.data ?? []);
        }
      } else {
        const res = await fetch(`/api/batch-content?batchId=${selectedBatchId}&type=assessment&available=true`, { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { data?: AvailableAssessment[] };
          setAvailableAssessments(data.data ?? []);
        }
      }
    } catch {
      // Silently fail
    }
  }, [selectedBatchId, activeTab]);

  useEffect(() => {
    if (selectedBatchId) {
      void fetchAssigned();
    }
  }, [selectedBatchId, fetchAssigned]);

  useEffect(() => {
    if (showAvailable && selectedBatchId) {
      void fetchAvailable();
    }
  }, [showAvailable, selectedBatchId, fetchAvailable]);

  const handleAssignContent = async (resourceIds: string[]) => {
    try {
      const response = await fetch("/api/batch-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "content", batchId: selectedBatchId, resourceIds }),
      });
      if (!response.ok) throw new Error("Failed to assign content.");
      toast.success("Repository resource assigned to batch.");
      setShowAvailable(false);
      void fetchAssigned();
    } catch {
      toast.error("Failed to assign content.");
    }
  };

  const handleAssignAssessment = async (assessmentPoolIds: string[]) => {
    try {
      const response = await fetch("/api/batch-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "assessment", batchId: selectedBatchId, assessmentPoolIds }),
      });
      if (!response.ok) throw new Error("Failed to assign assessment.");
      toast.success("Assessment assigned to batch.");
      setShowAvailable(false);
      void fetchAssigned();
    } catch {
      toast.error("Failed to assign assessment.");
    }
  };

  const handleRemoveContent = async (item: BatchContentItem) => {
    try {
      const response = await fetch("/api/batch-content", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "content",
          batchId: selectedBatchId,
          contentId: item.resourceAssignmentId ? null : item.contentId,
          resourceId: item.resourceId,
          assignmentId: item.resourceAssignmentId,
        }),
      });
      if (!response.ok) throw new Error("Failed to remove.");
      toast.success(item.resourceAssignmentId ? "Repository assignment removed from batch." : "Content removed from batch.");
      void fetchAssigned();
    } catch {
      toast.error("Failed to remove content.");
    }
  };

  const handleRemoveAssessment = async (assessmentPoolId: string) => {
    try {
      const response = await fetch("/api/batch-content", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "assessment", batchId: selectedBatchId, assessmentPoolId }),
      });
      if (!response.ok) throw new Error("Failed to remove.");
      toast.success("Assessment removed from batch.");
      void fetchAssigned();
    } catch {
      toast.error("Failed to remove assessment.");
    }
  };

  if (!selectedBatchId) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Batch</label>
          <select
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(e.target.value)}
            className="w-full max-w-sm rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Choose a batch…</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <p className="text-sm">Select a batch to manage its content and assessment mappings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Batch Selector */}
      <div className="flex items-center justify-between">
        <select
          value={selectedBatchId}
          onChange={(e) => { setSelectedBatchId(e.target.value); setShowAvailable(false); }}
          className="rounded-md border px-3 py-1.5 text-sm"
        >
          <option value="">Choose a batch…</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
          ))}
        </select>

        <div className="flex gap-1 rounded-lg border p-0.5">
          <button
            type="button"
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              activeTab === "content" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
            onClick={() => { setActiveTab("content"); setShowAvailable(false); }}
          >
            Content ({assignedContent.length})
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              activeTab === "assessment" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
            onClick={() => { setActiveTab("assessment"); setShowAvailable(false); }}
          >
            Assessments ({assignedAssessments.length})
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          {/* Assigned Items */}
          {activeTab === "content" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{assignedContent.length} content item{assignedContent.length !== 1 ? "s" : ""} available to this batch</p>
                  <p className="text-xs text-muted-foreground">Published course content is inherited automatically, and repository resources can be layered in as canonical batch assignments.</p>
                </div>
                <CanAccess permission="batch_content.assign">
                  <Button size="sm" variant="secondary" onClick={() => { setShowAvailable(true); void fetchAvailable(); }}>
                    + Add Repository Content
                  </Button>
                </CanAccess>
              </div>
              {assignedContent.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-muted-foreground">
                  <p className="text-sm">No published course or repository content is currently available to this batch.</p>
                </div>
              ) : (
                <div className="divide-y rounded-lg border">
                  {assignedContent.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium">{item.contentTitle}</p>
                          <Badge variant="info" className="text-[10px] px-1 py-0">
                            {assignmentSourceLabels[item.assignmentSource]}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {item.contentType} {item.fileName && `· ${item.fileName}`}
                          {item.assignedByName && ` · by ${item.assignedByName}`}
                        </p>
                      </div>
                      <CanAccess permission="batch_content.remove">
                        {item.canRemoveBatchMapping ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveContent(item)}
                        >
                          {item.resourceAssignmentId ? "Remove Repository Assignment" : "Remove Batch Mapping"}
                        </Button>
                        ) : null}
                      </CanAccess>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{assignedAssessments.length} assessment{assignedAssessments.length !== 1 ? "s" : ""} available to this batch</p>
                  <p className="text-xs text-muted-foreground">Course-linked assessments are inherited automatically. Use batch mappings for supplemental pools or schedules.</p>
                </div>
                <CanAccess permission="batch_content.assign">
                  <Button size="sm" variant="secondary" onClick={() => { setShowAvailable(true); void fetchAvailable(); }}>
                    + Add Supplemental Assessment
                  </Button>
                </CanAccess>
              </div>
              {assignedAssessments.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-muted-foreground">
                  <p className="text-sm">No assessments assigned to this batch yet.</p>
                </div>
              ) : (
                <div className="divide-y rounded-lg border">
                  {assignedAssessments.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">{item.assessmentTitle}</p>
                          <span className="text-xs font-mono text-muted-foreground">{item.assessmentCode}</span>
                          <Badge variant="info" className="text-[10px] px-1 py-0">
                            {assignmentSourceLabels[item.assignmentSource]}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="info" className="text-[10px] px-1 py-0">{QUESTION_TYPE_SHORT_LABELS[item.questionType as keyof typeof QUESTION_TYPE_SHORT_LABELS] ?? item.questionType}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {item.questionCount} Q · {item.totalMarks} marks
                            {item.assignedByName && ` · by ${item.assignedByName}`}
                          </span>
                        </div>
                      </div>
                      <CanAccess permission="batch_content.remove">
                        {item.canRemoveBatchMapping ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveAssessment(item.assessmentPoolId)}
                        >
                          Remove Batch Mapping
                        </Button>
                        ) : null}
                      </CanAccess>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Available Items Panel */}
          {showAvailable && (
            <div className="space-y-3 rounded-lg border border-dashed p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">
                  Available {activeTab === "content" ? "Repository Content" : "Assessments"}
                </h4>
                <Button size="sm" variant="ghost" onClick={() => setShowAvailable(false)}>
                  Close
                </Button>
              </div>

              {activeTab === "content" ? (
                availableContent.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No additional published repository resources are available for this batch right now.</p>
                ) : (
                  <div className="divide-y rounded-lg border bg-background">
                    {availableContent.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{item.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.contentType}
                            {item.folderName ? ` · Folder: ${item.folderName}` : " · Repository root"}
                            {item.sourceCourseName ? ` · Source: ${item.sourceCourseName}` : item.hasSourceContent ? "" : " · Source content will be created on first assignment"}
                          </p>
                        </div>
                        <Button size="sm" variant="secondary" onClick={() => handleAssignContent([item.id])}>
                          Assign Repository Item
                        </Button>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                availableAssessments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No supplemental published assessments are currently available for this batch.</p>
                ) : (
                  <div className="divide-y rounded-lg border bg-background">
                    {availableAssessments.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{item.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {QUESTION_TYPE_SHORT_LABELS[item.questionType as keyof typeof QUESTION_TYPE_SHORT_LABELS] ?? item.questionType} · {item.questionCount} Q · {item.totalMarks} marks
                          </p>
                        </div>
                        <Button size="sm" variant="secondary" onClick={() => handleAssignAssessment([item.id])}>
                          Add Batch Mapping
                        </Button>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
