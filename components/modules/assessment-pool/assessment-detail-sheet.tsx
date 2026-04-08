"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { CanAccess } from "@/components/ui/can-access";
import { QuestionBuilder } from "@/components/modules/assessment-pool/question-builder";

type QuestionItem = {
  id: string;
  questionText: string;
  questionType: string;
  options: unknown;
  correctAnswer: unknown;
  explanation: string | null;
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

type AssessmentMetadataForm = {
  title: string;
  description: string;
  questionType: string;
  difficultyLevel: string;
  totalMarks: string;
  passingMarks: string;
  timeLimitMinutes: string;
};

type AssessmentMetadataErrors = Partial<Record<keyof AssessmentMetadataForm, string>>;

const questionTypeLabels: Record<string, string> = {
  MCQ: "Multiple Choice",
  NUMERIC: "Numeric",
  ESSAY: "Essay",
  FILL_IN_THE_BLANK: "Fill in the Blank",
  MULTI_INPUT_REASONING: "Multi-Input Reasoning",
  TWO_PART_ANALYSIS: "Two-Part Analysis",
};

const DIFFICULTY_OPTIONS = ["EASY", "MEDIUM", "HARD"];

function buildMetadataForm(detail: AssessmentDetail): AssessmentMetadataForm {
  return {
    title: detail.title,
    description: detail.description ?? "",
    questionType: detail.questionType,
    difficultyLevel: detail.difficultyLevel,
    totalMarks: String(detail.totalMarks),
    passingMarks: String(detail.passingMarks),
    timeLimitMinutes: detail.timeLimitMinutes ? String(detail.timeLimitMinutes) : "",
  };
}

function validateMetadataForm(form: AssessmentMetadataForm): AssessmentMetadataErrors {
  const errors: AssessmentMetadataErrors = {};
  const totalMarks = Number(form.totalMarks);
  const passingMarks = Number(form.passingMarks);
  const parsedTimeLimit = form.timeLimitMinutes.trim() ? Number(form.timeLimitMinutes) : null;

  if (form.title.trim().length < 2) {
    errors.title = "Title must be at least 2 characters.";
  }

  if (form.description.trim().length > 2000) {
    errors.description = "Description cannot exceed 2000 characters.";
  }

  if (!Number.isFinite(totalMarks) || totalMarks < 1) {
    errors.totalMarks = "Total marks must be at least 1.";
  }

  if (!Number.isFinite(passingMarks) || passingMarks < 0) {
    errors.passingMarks = "Passing marks cannot be negative.";
  } else if (Number.isFinite(totalMarks) && passingMarks > totalMarks) {
    errors.passingMarks = "Passing marks cannot exceed total marks.";
  }

  if (parsedTimeLimit !== null && (!Number.isFinite(parsedTimeLimit) || parsedTimeLimit < 1)) {
    errors.timeLimitMinutes = "Time limit must be at least 1 minute.";
  }

  return errors;
}

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAssessment, setIsDeletingAssessment] = useState(false);
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [metadataForm, setMetadataForm] = useState<AssessmentMetadataForm | null>(null);
  const [metadataErrors, setMetadataErrors] = useState<AssessmentMetadataErrors>({});
  const [pendingDeleteQuestionId, setPendingDeleteQuestionId] = useState<string | null>(null);
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<QuestionItem | null>(null);

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

  useEffect(() => {
    if (detail) {
      setMetadataForm(buildMetadataForm(detail));
      setMetadataErrors({});
    }
  }, [detail?.id]);

  useEffect(() => {
    if (!open) {
      setShowDeleteConfirm(false);
      setIsDeletingAssessment(false);
      setIsEditingMetadata(false);
      setIsSavingMetadata(false);
      setPendingDeleteQuestionId(null);
      setDeletingQuestionId(null);
      setEditingQuestion(null);
      setMetadataErrors({});
    }
  }, [open, poolId]);

  useEffect(() => {
    if (!detail || !editingQuestion) {
      return;
    }

    const nextEditingQuestion = detail.questions.find((question) => question.id === editingQuestion.id) ?? null;
    setEditingQuestion(nextEditingQuestion);
  }, [detail, editingQuestion?.id]);

  const handleStartMetadataEdit = () => {
    if (!detail) {
      return;
    }

    setMetadataForm(buildMetadataForm(detail));
    setMetadataErrors({});
    setIsEditingMetadata(true);
  };

  const handleCancelMetadataEdit = () => {
    if (detail) {
      setMetadataForm(buildMetadataForm(detail));
    }
    setMetadataErrors({});
    setIsEditingMetadata(false);
  };

  const handleSaveMetadata = async () => {
    if (!poolId || !detail || !metadataForm) {
      return;
    }

    const nextErrors = validateMetadataForm(metadataForm);
    if (Object.keys(nextErrors).length > 0) {
      setMetadataErrors(nextErrors);
      return;
    }

    setIsSavingMetadata(true);

    try {
      const response = await fetch(`/api/assessment-pool/${poolId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: metadataForm.title.trim(),
          description: metadataForm.description.trim(),
          questionType: metadataForm.questionType,
          difficultyLevel: metadataForm.difficultyLevel,
          totalMarks: Number(metadataForm.totalMarks),
          passingMarks: Number(metadataForm.passingMarks),
          timeLimitMinutes: metadataForm.timeLimitMinutes.trim() ? Number(metadataForm.timeLimitMinutes) : null,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to update assessment details.");
      }

      toast.success("Assessment details updated.");
      setIsEditingMetadata(false);
      setMetadataErrors({});
      void fetchDetail();
      onUpdated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update assessment details.");
    } finally {
      setIsSavingMetadata(false);
    }
  };

  const handlePublish = async () => {
    if (!poolId || !detail) return;

    if (detail.questionCount < 1) {
      toast.info("Add at least one question before publishing.");
      return;
    }

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

    setDeletingQuestionId(questionId);
    try {
      const response = await fetch(`/api/assessment-pool/${poolId}/questions/${questionId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete question.");
      toast.success("Question removed.");
      setPendingDeleteQuestionId(null);
      setEditingQuestion((current) => (current?.id === questionId ? null : current));
      void fetchDetail();
      onUpdated?.();
    } catch {
      toast.error("Failed to delete question.");
    } finally {
      setDeletingQuestionId(null);
    }
  };

  const handleStartQuestionEdit = (question: QuestionItem) => {
    setPendingDeleteQuestionId(null);
    setEditingQuestion((current) => (current?.id === question.id ? null : question));
  };

  const handleQuestionSaved = () => {
    setEditingQuestion(null);
    void fetchDetail();
    onUpdated?.();
  };

  const handleDeleteAssessment = async () => {
    if (!poolId || !detail) {
      return;
    }

    setIsDeletingAssessment(true);
    try {
      const response = await fetch(`/api/assessment-pool/${poolId}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to delete assessment.");
      }

      toast.success("Assessment deleted.");
      setShowDeleteConfirm(false);
      onUpdated?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete assessment.");
    } finally {
      setIsDeletingAssessment(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-3xl overflow-y-auto">
        {isLoading || !detail ? (
          <div className="space-y-4 px-6 py-6">
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

            <div className="space-y-6 px-6 py-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-slate-900">Assessment Details</h4>
                  {isEditingMetadata ? null : (
                    <CanAccess permission="assessment_pool.edit">
                      <Button type="button" size="sm" variant="secondary" onClick={handleStartMetadataEdit}>
                        Edit details
                      </Button>
                    </CanAccess>
                  )}
                </div>

                {!isEditingMetadata ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="info">{questionTypeLabels[detail.questionType] ?? detail.questionType}</Badge>
                      <Badge variant="info">{detail.difficultyLevel}</Badge>
                      {detail.isAiGenerated && <Badge variant="accent">✦ AI Generated</Badge>}
                      {detail.courseLinksCount > 0 && (
                        <Badge variant="info">Linked to {detail.courseLinksCount} course{detail.courseLinksCount !== 1 ? "s" : ""}</Badge>
                      )}
                    </div>

                    {detail.description ? (
                      <p className="text-sm text-muted-foreground">{detail.description}</p>
                    ) : (
                      <p className="text-sm text-slate-500">No description added yet.</p>
                    )}
                  </>
                ) : metadataForm ? (
                  <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Title</label>
                        <Input
                          value={metadataForm.title}
                          onChange={(event) => setMetadataForm((prev) => prev ? { ...prev, title: event.target.value } : prev)}
                        />
                        {metadataErrors.title ? <p className="text-xs text-rose-600">{metadataErrors.title}</p> : null}
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Question Type</label>
                        <select
                          value={metadataForm.questionType}
                          onChange={(event) => setMetadataForm((prev) => prev ? { ...prev, questionType: event.target.value } : prev)}
                          className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm text-slate-900"
                        >
                          {Object.entries(questionTypeLabels).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Description</label>
                        <textarea
                          value={metadataForm.description}
                          onChange={(event) => setMetadataForm((prev) => prev ? { ...prev, description: event.target.value } : prev)}
                          className="w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm text-slate-900 min-h-[96px] resize-y"
                        />
                        {metadataErrors.description ? <p className="text-xs text-rose-600">{metadataErrors.description}</p> : null}
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Difficulty</label>
                        <select
                          value={metadataForm.difficultyLevel}
                          onChange={(event) => setMetadataForm((prev) => prev ? { ...prev, difficultyLevel: event.target.value } : prev)}
                          className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm text-slate-900"
                        >
                          {DIFFICULTY_OPTIONS.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Time Limit (min)</label>
                        <Input
                          type="number"
                          min={1}
                          placeholder="Optional"
                          value={metadataForm.timeLimitMinutes}
                          onChange={(event) => setMetadataForm((prev) => prev ? { ...prev, timeLimitMinutes: event.target.value } : prev)}
                        />
                        {metadataErrors.timeLimitMinutes ? <p className="text-xs text-rose-600">{metadataErrors.timeLimitMinutes}</p> : null}
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Total Marks</label>
                        <Input
                          type="number"
                          min={1}
                          value={metadataForm.totalMarks}
                          onChange={(event) => setMetadataForm((prev) => prev ? { ...prev, totalMarks: event.target.value } : prev)}
                        />
                        {metadataErrors.totalMarks ? <p className="text-xs text-rose-600">{metadataErrors.totalMarks}</p> : null}
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Passing Marks</label>
                        <Input
                          type="number"
                          min={0}
                          value={metadataForm.passingMarks}
                          onChange={(event) => setMetadataForm((prev) => prev ? { ...prev, passingMarks: event.target.value } : prev)}
                        />
                        {metadataErrors.passingMarks ? <p className="text-xs text-rose-600">{metadataErrors.passingMarks}</p> : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button type="button" variant="secondary" onClick={handleCancelMetadataEdit} disabled={isSavingMetadata}>
                        Cancel
                      </Button>
                      <Button type="button" onClick={() => void handleSaveMetadata()} disabled={isSavingMetadata}>
                        {isSavingMetadata ? "Saving..." : "Save changes"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </section>

              <div className="rounded-lg border border-[#dbe6f6] bg-[#f5f9ff] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Question Progress</p>
                    <p className="mt-1 text-sm text-slate-700">
                      {detail.questionCount > 0
                        ? `${detail.questionCount} question${detail.questionCount === 1 ? "" : "s"} added. Publish is ready when content is final.`
                        : "No questions added yet. Add at least one question to publish."}
                    </p>
                  </div>
                  <Badge variant={detail.questionCount > 0 ? "success" : "warning"}>
                    {detail.questionCount > 0 ? "Publish Ready" : "Needs Questions"}
                  </Badge>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                {detail.status === "DRAFT" ? (
                  <>
                    <CanAccess permission="assessment_pool.publish">
                      <Button size="sm" onClick={handlePublish} disabled={isPublishing || detail.questionCount < 1 || isDeletingAssessment}>
                        {isPublishing ? "Publishing..." : "Publish Assessment"}
                      </Button>
                    </CanAccess>
                    {detail.questionCount < 1 ? (
                      <p className="text-xs text-slate-500">Publish is enabled after at least one question is added.</p>
                    ) : null}
                  </>
                ) : null}

                {detail.status !== "ARCHIVED" ? (
                  <CanAccess permission="assessment_pool.delete">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="border-rose-300 text-rose-700 hover:bg-rose-50"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={isDeletingAssessment || isPublishing}
                    >
                      Delete Assessment
                    </Button>
                  </CanAccess>
                ) : null}
              </div>

              {/* Question List */}
              <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h4 className="text-sm font-medium">Questions ({detail.questions.length})</h4>
                {detail.questions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No questions added yet. Use the builder below to add questions.</p>
                ) : (
                  <div className="divide-y rounded-lg border">
                    {detail.questions.map((q, i) => (
                      <div
                        key={q.id}
                        className={`flex items-start justify-between gap-3 px-3 py-2 ${editingQuestion?.id === q.id ? "bg-slate-50" : ""}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground">Q{i + 1}</span>
                            <Badge variant="info" className="text-[10px] px-1 py-0">
                              {questionTypeLabels[q.questionType] ?? q.questionType}
                            </Badge>
                            {editingQuestion?.id === q.id ? (
                              <Badge variant="info" className="text-[10px] px-1 py-0">
                                Editing
                              </Badge>
                            ) : null}
                            <span className="text-xs text-muted-foreground">{q.marks} mark{q.marks !== 1 ? "s" : ""}</span>
                          </div>
                          <p className="mt-0.5 text-sm line-clamp-2">{q.questionText}</p>

                          {pendingDeleteQuestionId === q.id ? (
                            <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                              <p className="text-xs text-rose-700">Remove this question from the assessment?</p>
                              <div className="mt-2 flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => setPendingDeleteQuestionId(null)}
                                  disabled={deletingQuestionId === q.id}
                                >
                                  Keep
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="bg-rose-600 text-white hover:bg-rose-700"
                                  onClick={() => void handleDeleteQuestion(q.id)}
                                  disabled={deletingQuestionId === q.id}
                                >
                                  {deletingQuestionId === q.id ? "Removing..." : "Delete question"}
                                </Button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                        <CanAccess permission="assessment_pool.edit">
                          <div className="flex shrink-0 items-center gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => handleStartQuestionEdit(q)}
                              disabled={deletingQuestionId === q.id}
                            >
                              {editingQuestion?.id === q.id ? "Close" : "Edit"}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                setEditingQuestion((current) => (current?.id === q.id ? null : current));
                                setPendingDeleteQuestionId((current) => (current === q.id ? null : q.id));
                              }}
                            >
                              Delete
                            </Button>
                          </div>
                        </CanAccess>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Question Builder */}
              {detail.status !== "ARCHIVED" && (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <CanAccess permission="assessment_pool.edit">
                    <QuestionBuilder
                      poolId={detail.id}
                      defaultType={detail.questionType}
                      questionCount={detail.questionCount}
                      mode={editingQuestion ? "edit" : "create"}
                      initialQuestion={editingQuestion}
                      onSaved={handleQuestionSaved}
                      onCancel={() => setEditingQuestion(null)}
                    />
                  </CanAccess>
                </section>
              )}
            </div>

            {showDeleteConfirm ? (
              <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-[1px]">
                <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
                  <p className="text-sm font-semibold text-slate-900">Delete this assessment?</p>
                  <p className="mt-2 text-sm text-slate-600">
                    This will archive <span className="font-semibold text-slate-900">{detail.title}</span> and remove it from active assessment workflows.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={isDeletingAssessment}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      className="bg-rose-600 text-white hover:bg-rose-700"
                      onClick={() => void handleDeleteAssessment()}
                      disabled={isDeletingAssessment}
                    >
                      {isDeletingAssessment ? "Deleting..." : "Yes, delete"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
