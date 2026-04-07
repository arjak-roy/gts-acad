"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { CanAccess } from "@/components/ui/can-access";
import { QuestionBuilder } from "@/components/modules/assessment-pool/question-builder";

type QuestionItem = {
  id: string;
  questionText: string;
  questionType: string;
  marks: number;
  sortOrder: number;
};

type AssessmentDetail = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  courseName: string | null;
  questionType: string;
  difficultyLevel: string;
  totalMarks: number;
  passingMarks: number;
  timeLimitMinutes: number | null;
  status: string;
  isAiGenerated: boolean;
  questionCount: number;
  courseLinksCount: number;
  createdByName: string | null;
  questions: QuestionItem[];
};

const questionTypeLabels: Record<string, string> = {
  MCQ: "Multiple Choice",
  NUMERIC: "Numeric",
  ESSAY: "Essay",
  FILL_IN_THE_BLANK: "Fill in the Blank",
  MULTI_INPUT_REASONING: "Multi-Input Reasoning",
  TWO_PART_ANALYSIS: "Two-Part Analysis",
};

export function AssessmentDetailSheet({
  poolId,
  open,
  onOpenChange,
  onUpdated,
}: {
  poolId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}) {
  const [detail, setDetail] = useState<AssessmentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!poolId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/assessment-pool/${poolId}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load assessment.");
      const result = (await response.json()) as { data?: AssessmentDetail };
      setDetail(result.data ?? null);
    } catch {
      toast.error("Failed to load assessment details.");
    } finally {
      setIsLoading(false);
    }
  }, [poolId]);

  useEffect(() => {
    if (open && poolId) void fetchDetail();
  }, [open, poolId, fetchDetail]);

  const handlePublish = async () => {
    if (!poolId) return;
    setIsPublishing(true);
    try {
      const response = await fetch(`/api/assessment-pool/${poolId}/publish`, { method: "POST" });
      if (!response.ok) throw new Error("Failed to publish.");
      toast.success("Assessment published.");
      void fetchDetail();
      onUpdated?.();
    } catch {
      toast.error("Failed to publish assessment.");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!poolId) return;
    try {
      const response = await fetch(`/api/assessment-pool/${poolId}/questions/${questionId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete question.");
      toast.success("Question removed.");
      void fetchDetail();
    } catch {
      toast.error("Failed to delete question.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        {isLoading || !detail ? (
          <div className="space-y-4 py-6">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2">
                <SheetTitle>{detail.title}</SheetTitle>
                <Badge variant={detail.status === "PUBLISHED" ? "success" : "info"}>
                  {detail.status}
                </Badge>
              </div>
              <SheetDescription>
                <span className="font-mono text-xs">{detail.code}</span>
                {detail.courseName && <span> · {detail.courseName}</span>}
                {detail.createdByName && <span> · Created by {detail.createdByName}</span>}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 py-4">
              {/* Metadata */}
              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-lg font-semibold">{detail.questionCount}</p>
                  <p className="text-xs text-muted-foreground">Questions</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-lg font-semibold">{detail.totalMarks}</p>
                  <p className="text-xs text-muted-foreground">Total Marks</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-lg font-semibold">{detail.passingMarks}</p>
                  <p className="text-xs text-muted-foreground">Passing</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-lg font-semibold">{detail.timeLimitMinutes ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">Minutes</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="info">{questionTypeLabels[detail.questionType] ?? detail.questionType}</Badge>
                <Badge variant="info">{detail.difficultyLevel}</Badge>
                {detail.isAiGenerated && <Badge variant="accent">✦ AI Generated</Badge>}
                {detail.courseLinksCount > 0 && (
                  <Badge variant="info">Linked to {detail.courseLinksCount} course{detail.courseLinksCount !== 1 ? "s" : ""}</Badge>
                )}
              </div>

              {detail.description && (
                <p className="text-sm text-muted-foreground">{detail.description}</p>
              )}

              {/* Actions */}
              {detail.status === "DRAFT" && (
                <div className="flex gap-2">
                  <CanAccess permission="assessment_pool.publish">
                    <Button size="sm" onClick={handlePublish} disabled={isPublishing}>
                      {isPublishing ? "Publishing…" : "Publish Assessment"}
                    </Button>
                  </CanAccess>
                </div>
              )}

              {/* Question List */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Questions ({detail.questions.length})</h4>
                {detail.questions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No questions added yet. Use the builder below to add questions.</p>
                ) : (
                  <div className="divide-y rounded-lg border">
                    {detail.questions.map((q, i) => (
                      <div key={q.id} className="flex items-start justify-between gap-3 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground">Q{i + 1}</span>
                            <Badge variant="info" className="text-[10px] px-1 py-0">
                              {questionTypeLabels[q.questionType] ?? q.questionType}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{q.marks} mark{q.marks !== 1 ? "s" : ""}</span>
                          </div>
                          <p className="mt-0.5 text-sm line-clamp-2">{q.questionText}</p>
                        </div>
                        <CanAccess permission="assessment_pool.edit">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="shrink-0 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteQuestion(q.id)}
                          >
                            ×
                          </Button>
                        </CanAccess>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Question Builder */}
              {detail.status !== "ARCHIVED" && (
                <CanAccess permission="assessment_pool.edit">
                  <QuestionBuilder
                    poolId={detail.id}
                    defaultType={detail.questionType}
                    onQuestionAdded={fetchDetail}
                  />
                </CanAccess>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
