"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { QUESTION_TYPE_LABELS } from "@/lib/question-types";
import { ASSESSMENT_ATTEMPT_STATUS_LABELS, type AssessmentReviewDetail } from "@/services/assessment-reviews/types";

type ManualScoreState = {
  marksAwarded: string;
  feedback: string;
};

type AssessmentReviewDetailSheetProps = {
  attemptId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
};

function getStatusBadgeVariant(status: AssessmentReviewDetail["status"]) {
  if (status === "GRADED") {
    return "success" as const;
  }

  if (status === "IN_REVIEW") {
    return "warning" as const;
  }

  return "info" as const;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  return new Date(value).toLocaleString();
}

function formatAnswer(answer: unknown) {
  if (answer === null || answer === undefined || answer === "") {
    return "No answer submitted.";
  }

  if (typeof answer === "boolean") {
    return answer ? "True" : "False";
  }

  if (typeof answer === "string" || typeof answer === "number") {
    return String(answer);
  }

  try {
    return JSON.stringify(answer, null, 2);
  } catch {
    return "Unable to render answer.";
  }
}

function buildManualScoreState(detail: AssessmentReviewDetail | null) {
  return (detail?.questions ?? []).reduce<Record<string, ManualScoreState>>((accumulator, question) => {
    if (!question.requiresManualReview) {
      return accumulator;
    }

    accumulator[question.questionId] = {
      marksAwarded: String(question.marksAwarded ?? 0),
      feedback: question.feedback ?? "",
    };
    return accumulator;
  }, {});
}

export function AssessmentReviewDetailSheet({
  attemptId,
  open,
  onOpenChange,
  onUpdated,
}: AssessmentReviewDetailSheetProps) {
  const [detail, setDetail] = useState<AssessmentReviewDetail | null>(null);
  const [manualScores, setManualScores] = useState<Record<string, ManualScoreState>>({});
  const [reviewerFeedback, setReviewerFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const manualQuestions = useMemo(
    () => detail?.questions.filter((question) => question.requiresManualReview) ?? [],
    [detail],
  );

  useEffect(() => {
    if (!open || !attemptId) {
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    fetch(`/api/assessment-reviews/${attemptId}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as { data?: AssessmentReviewDetail; error?: string } | null;
        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load assessment review.");
        }

        if (!active || !payload?.data) {
          return;
        }

        setDetail(payload.data);
        setManualScores(buildManualScoreState(payload.data));
        setReviewerFeedback(payload.data.reviewerFeedback ?? "");
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load assessment review.");
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
  }, [attemptId, open]);

  useEffect(() => {
    if (!open) {
      setDetail(null);
      setManualScores({});
      setReviewerFeedback("");
      setError(null);
      setIsLoading(false);
      setIsSaving(false);
    }
  }, [open]);

  const handleStatusChange = async (status: "PENDING_REVIEW" | "IN_REVIEW") => {
    if (!attemptId || isSaving) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/assessment-reviews/${attemptId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      const payload = (await response.json().catch(() => null)) as { data?: AssessmentReviewDetail; error?: string } | null;
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error || "Failed to update review state.");
      }

      setDetail(payload.data);
      setManualScores(buildManualScoreState(payload.data));
      setReviewerFeedback(payload.data.reviewerFeedback ?? "");
      onUpdated?.();
      toast.success(status === "IN_REVIEW" ? "Attempt moved into review." : "Attempt returned to the queue.");
    } catch (statusError) {
      const message = statusError instanceof Error ? statusError.message : "Failed to update review state.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGrade = async () => {
    if (!attemptId || isSaving) {
      return;
    }

    const questionScores = manualQuestions.map((question) => {
      const nextScore = manualScores[question.questionId] ?? { marksAwarded: "0", feedback: "" };
      const marksAwarded = Number(nextScore.marksAwarded);

      if (!Number.isFinite(marksAwarded) || marksAwarded < 0 || marksAwarded > question.maxMarks) {
        throw new Error(`Enter a valid score between 0 and ${question.maxMarks} for ${question.questionText}.`);
      }

      return {
        questionId: question.questionId,
        marksAwarded,
        feedback: nextScore.feedback,
      };
    });

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/assessment-reviews/${attemptId}/grade`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reviewerFeedback,
          questionScores,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { data?: AssessmentReviewDetail; error?: string } | null;
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error || "Failed to submit the final grade.");
      }

      setDetail(payload.data);
      setManualScores(buildManualScoreState(payload.data));
      setReviewerFeedback(payload.data.reviewerFeedback ?? "");
      onUpdated?.();
      toast.success("Assessment graded successfully.");
    } catch (gradeError) {
      const message = gradeError instanceof Error ? gradeError.message : "Failed to submit the final grade.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-4xl">
        <SheetHeader>
          <SheetTitle>Assessment Review</SheetTitle>
          <SheetDescription>
            Review submitted answers, manage the attempt state, and apply manual grading where required.
          </SheetDescription>
        </SheetHeader>

        <div className="flex h-full flex-col overflow-hidden p-6">
          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-32 w-full rounded-2xl" />
                <Skeleton className="h-40 w-full rounded-2xl" />
              </div>
            ) : null}

            {!isLoading && error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">{error}</div>
            ) : null}

            {!isLoading && detail ? (
              <>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-slate-900">{detail.assessmentTitle}</p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{detail.assessmentCode}</p>
                      <p className="mt-3 text-sm text-slate-600">Learner: {detail.learnerName} ({detail.learnerCode})</p>
                      <p className="mt-1 text-sm text-slate-600">Batch: {detail.batchName}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={getStatusBadgeVariant(detail.status)}>{ASSESSMENT_ATTEMPT_STATUS_LABELS[detail.status]}</Badge>
                      <Badge variant="default">{QUESTION_TYPE_LABELS[detail.questionType as keyof typeof QUESTION_TYPE_LABELS] ?? detail.questionType}</Badge>
                      <Badge variant="info">{detail.difficultyLevel}</Badge>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Submitted</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(detail.submittedAt)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Review Started</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(detail.reviewStartedAt)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Score</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {detail.marksObtained === null ? "Pending" : `${detail.marksObtained}/${detail.totalMarks}`}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Reviewer</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{detail.reviewerName ?? "Unassigned"}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {detail.questions.map((question, index) => (
                    <div key={question.questionId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Question {index + 1}</p>
                          <p className="mt-2 text-sm font-semibold text-slate-900">{question.questionText}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="default">{QUESTION_TYPE_LABELS[question.questionType as keyof typeof QUESTION_TYPE_LABELS] ?? question.questionType}</Badge>
                          <Badge variant={question.requiresManualReview ? "warning" : "info"}>{question.maxMarks} Marks</Badge>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                        <div className="space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Submitted Answer</p>
                          <pre className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">{formatAnswer(question.submittedAnswer)}</pre>
                        </div>

                        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Auto Score</p>
                            <p className="mt-2 text-sm font-semibold text-slate-900">{question.autoMarksAwarded}/{question.maxMarks}</p>
                          </div>

                          {question.requiresManualReview ? (
                            detail.access.canManualGrade ? (
                              <>
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Manual Marks</label>
                                  <Input
                                    type="number"
                                    min={0}
                                    max={question.maxMarks}
                                    value={manualScores[question.questionId]?.marksAwarded ?? "0"}
                                    onChange={(event) => setManualScores((currentValue) => ({
                                      ...currentValue,
                                      [question.questionId]: {
                                        marksAwarded: event.target.value,
                                        feedback: currentValue[question.questionId]?.feedback ?? "",
                                      },
                                    }))}
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Question Feedback</label>
                                  <textarea
                                    className="min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d3b84]"
                                    value={manualScores[question.questionId]?.feedback ?? ""}
                                    onChange={(event) => setManualScores((currentValue) => ({
                                      ...currentValue,
                                      [question.questionId]: {
                                        marksAwarded: currentValue[question.questionId]?.marksAwarded ?? "0",
                                        feedback: event.target.value,
                                      },
                                    }))}
                                  />
                                </div>
                              </>
                            ) : (
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Manual Score</p>
                                <p className="mt-2 text-sm font-semibold text-slate-900">
                                  {question.marksAwarded === null ? "Pending" : `${question.marksAwarded}/${question.maxMarks}`}
                                </p>
                              </div>
                            )
                          ) : (
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Final Marks</p>
                              <p className="mt-2 text-sm font-semibold text-slate-900">{question.marksAwarded ?? 0}/{question.maxMarks}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Reviewer Summary</label>
                  <textarea
                    className="min-h-28 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d3b84]"
                    value={reviewerFeedback}
                    onChange={(event) => setReviewerFeedback(event.target.value)}
                    disabled={!detail.access.canManualGrade}
                  />
                </div>
              </>
            ) : null}
          </div>

          {!isLoading && detail ? (
            <SheetFooter className="flex-wrap gap-2 border-t border-slate-100 pt-4 sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {detail.status === "PENDING_REVIEW" && (detail.access.canManageAttempts || detail.access.canManualGrade) ? (
                  <Button variant="secondary" onClick={() => void handleStatusChange("IN_REVIEW")} disabled={isSaving}>
                    Start Review
                  </Button>
                ) : null}
                {detail.status === "IN_REVIEW" && detail.access.canManageAttempts ? (
                  <Button variant="secondary" onClick={() => void handleStatusChange("PENDING_REVIEW")} disabled={isSaving}>
                    Return To Queue
                  </Button>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSaving}>
                  Close
                </Button>
                {detail.access.canManualGrade && manualQuestions.length > 0 ? (
                  <Button onClick={() => void handleGrade()} disabled={isSaving}>
                    {isSaving ? "Saving..." : detail.status === "GRADED" ? "Update Grade" : "Submit Grade"}
                  </Button>
                ) : null}
              </div>
            </SheetFooter>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}