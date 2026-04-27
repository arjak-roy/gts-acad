"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { QUESTION_TYPE_LABELS } from "@/lib/question-types";
import {
  ASSESSMENT_ATTEMPT_STATUS_LABELS,
  type AssessmentReviewDetail,
  type AssessmentReviewHistoryItem,
} from "@/services/assessment-reviews/types";

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
  const [overrideMarks, setOverrideMarks] = useState("");
  const [overridePassed, setOverridePassed] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [historyItems, setHistoryItems] = useState<AssessmentReviewHistoryItem[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const manualQuestions = useMemo(
    () => detail?.questions.filter((question) => question.requiresManualReview) ?? [],
    [detail],
  );

  const hydrateLocalStateFromDetail = (nextDetail: AssessmentReviewDetail) => {
    setDetail(nextDetail);
    setManualScores(buildManualScoreState(nextDetail));
    setReviewerFeedback(nextDetail.reviewerFeedback ?? "");
    setOverrideMarks(String(nextDetail.overrideMarks ?? nextDetail.marksObtained ?? 0));
    setOverridePassed(nextDetail.overridePassed ?? nextDetail.passed ?? false);
    setOverrideReason(nextDetail.overrideReason ?? "");
  };

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

        hydrateLocalStateFromDetail(payload.data);
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
      setOverrideMarks("");
      setOverridePassed(false);
      setOverrideReason("");
      setReopenDialogOpen(false);
      setReopenReason("");
      setHistoryItems([]);
      setHistoryLoaded(false);
    }
  }, [open]);

  const loadHistory = async () => {
    if (!attemptId || historyLoaded) {
      return;
    }

    try {
      const response = await fetch(`/api/assessment-reviews/${attemptId}/history`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { data?: AssessmentReviewHistoryItem[]; error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load review history.");
      }

      setHistoryItems(payload?.data ?? []);
      setHistoryLoaded(true);
    } catch (historyError) {
      toast.error(historyError instanceof Error ? historyError.message : "Failed to load review history.");
    }
  };

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

      hydrateLocalStateFromDetail(payload.data);
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
          draft: false,
          reviewerFeedback,
          questionScores,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { data?: AssessmentReviewDetail; error?: string } | null;
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error || "Failed to submit the final grade.");
      }

      hydrateLocalStateFromDetail(payload.data);
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

  const handleSaveDraft = async () => {
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
          draft: true,
          reviewerFeedback,
          questionScores,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { data?: AssessmentReviewDetail; error?: string } | null;
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error || "Failed to save draft review.");
      }

      hydrateLocalStateFromDetail(payload.data);
      onUpdated?.();
      toast.success("Review draft saved.");
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Failed to save draft review.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (!attemptId || isSaving) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/assessment-reviews/${attemptId}/finalize`, {
        method: "POST",
      });

      const payload = (await response.json().catch(() => null)) as { data?: AssessmentReviewDetail; error?: string } | null;
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error || "Failed to finalize review.");
      }

      hydrateLocalStateFromDetail(payload.data);
      onUpdated?.();
      toast.success("Review finalized.");
    } catch (finalizeError) {
      const message = finalizeError instanceof Error ? finalizeError.message : "Failed to finalize review.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReopen = async () => {
    if (!attemptId || isSaving) {
      return;
    }

    const trimmedReason = reopenReason.trim();
    if (trimmedReason.length < 10) {
      toast.error("Reopen reason is required (minimum 10 characters).");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/assessment-reviews/${attemptId}/reopen`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: trimmedReason }),
      });

      const payload = (await response.json().catch(() => null)) as { data?: AssessmentReviewDetail; error?: string } | null;
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error || "Failed to reopen review.");
      }

      hydrateLocalStateFromDetail(payload.data);
      setReopenDialogOpen(false);
      setReopenReason("");
      onUpdated?.();
      toast.success("Review reopened.");
    } catch (reopenError) {
      const message = reopenError instanceof Error ? reopenError.message : "Failed to reopen review.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyOverride = async () => {
    if (!attemptId || isSaving) {
      return;
    }

    const parsedOverrideMarks = Number(overrideMarks);
    if (!Number.isFinite(parsedOverrideMarks) || parsedOverrideMarks < 0) {
      toast.error("Override marks must be a valid non-negative number.");
      return;
    }

    if (overrideReason.trim().length < 10) {
      toast.error("Override reason is required (minimum 10 characters).");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/assessment-reviews/${attemptId}/override`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          overrideMarks: parsedOverrideMarks,
          overridePassed,
          overrideReason,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { data?: AssessmentReviewDetail; error?: string } | null;
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error || "Failed to apply override.");
      }

      hydrateLocalStateFromDetail(payload.data);
      onUpdated?.();
      toast.success("Override applied.");
    } catch (overrideError) {
      const message = overrideError instanceof Error ? overrideError.message : "Failed to apply override.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
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
                        {detail.overrideMarks !== null
                          ? `${detail.overrideMarks}/${detail.totalMarks} (Override)`
                          : detail.marksObtained === null
                            ? "Pending"
                            : `${detail.marksObtained}/${detail.totalMarks}`}
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

                <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">Manual Override</p>
                    <Badge variant={detail.overrideMarks !== null || detail.overridePassed !== null ? "warning" : "info"}>
                      {detail.overrideMarks !== null || detail.overridePassed !== null ? "Override Applied" : "No Override"}
                    </Badge>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Override Marks</label>
                      <Input value={overrideMarks} onChange={(event) => setOverrideMarks(event.target.value)} type="number" min={0} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Final Status</label>
                      <select
                        className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700"
                        value={overridePassed ? "PASS" : "FAIL"}
                        onChange={(event) => setOverridePassed(event.target.value === "PASS")}
                      >
                        <option value="PASS">Pass</option>
                        <option value="FAIL">Fail</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Feedback Visibility</label>
                      <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        {detail.feedbackVisibleToLearner ? "Visible to learner" : "Hidden from learner"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Override Reason</label>
                    <textarea
                      className="min-h-20 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d3b84]"
                      value={overrideReason}
                      onChange={(event) => setOverrideReason(event.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">Review History</p>
                    <Button variant="secondary" size="sm" onClick={() => void loadHistory()} disabled={isSaving}>
                      {historyLoaded ? "Refresh History" : "Load History"}
                    </Button>
                  </div>

                  {historyLoaded ? (
                    historyItems.length > 0 ? (
                      <div className="space-y-2">
                        {historyItems.map((entry) => (
                          <div key={entry.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{entry.eventType}</p>
                            <p className="mt-1 text-sm text-slate-700">{entry.notes ?? "No notes"}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {new Date(entry.createdAt).toLocaleString()} • {entry.actorName ?? "System"}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No history recorded yet.</p>
                    )
                  ) : (
                    <p className="text-sm text-slate-500">History loads on demand.</p>
                  )}
                </div>

                {detail.isFinalized ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    Finalized at {formatDateTime(detail.finalizedAt)} by {detail.finalizedByName ?? "Unknown reviewer"}.
                  </div>
                ) : null}
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
                    <Button variant="secondary" onClick={() => void handleSaveDraft()} disabled={isSaving || detail.isFinalized}>
                      Save Draft Review
                    </Button>
                  ) : null}
                  {detail.access.canManualGrade && manualQuestions.length > 0 ? (
                    <Button onClick={() => void handleGrade()} disabled={isSaving || detail.isFinalized}>
                      {isSaving ? "Saving..." : detail.status === "GRADED" ? "Update Grade" : "Submit Grade"}
                    </Button>
                  ) : null}
                  {detail.access.canManualGrade ? (
                    <Button variant="secondary" onClick={() => void handleApplyOverride()} disabled={isSaving || detail.isFinalized}>
                      Apply Override
                    </Button>
                  ) : null}
                  {detail.access.canManualGrade || detail.access.canManageAttempts ? (
                    <Button onClick={() => void handleFinalize()} disabled={isSaving || detail.isFinalized || detail.status !== "GRADED"}>
                      Finalize Review
                    </Button>
                  ) : null}
                  {detail.access.canManageAttempts ? (
                    <Button variant="secondary" onClick={() => setReopenDialogOpen(true)} disabled={isSaving || !detail.isFinalized}>
                      Reopen Review
                    </Button>
                  ) : null}
                </div>
              </SheetFooter>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={reopenDialogOpen} onOpenChange={setReopenDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Reopen Finalized Review</DialogTitle>
            <DialogDescription>
              Add a clear audit note explaining why this finalized review is being returned to active review.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Reopening unlocks grading changes and records this action in review history.
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Reopen Reason</label>
              <textarea
                className="min-h-28 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d3b84]"
                value={reopenReason}
                onChange={(event) => setReopenReason(event.target.value)}
                placeholder="Explain what changed, what needs correction, or why the review must be reopened."
              />
              <p className="text-xs text-slate-500">Minimum 10 characters. Keep the reason specific enough for audit history.</p>
            </div>
          </DialogBody>
          <DialogFooter className="sm:justify-end">
            <Button
              variant="secondary"
              onClick={() => {
                setReopenDialogOpen(false);
                setReopenReason("");
              }}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleReopen()} disabled={isSaving || reopenReason.trim().length < 10}>
              {isSaving ? "Reopening..." : "Confirm Reopen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}