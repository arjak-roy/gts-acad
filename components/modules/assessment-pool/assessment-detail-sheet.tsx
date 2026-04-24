"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { CanAccess } from "@/components/ui/can-access";
import { QuestionBuilder } from "@/components/modules/assessment-pool/question-builder";
import { ImportQuestionBankDialog } from "@/components/modules/question-bank/import-question-bank-dialog";
import { QUESTION_TYPE_LABELS } from "@/lib/question-types";

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

type CourseOption = {
  id: string;
  name: string;
  isActive: boolean;
};

type AssessmentCourseLink = {
  id: string;
  courseId: string;
  assessmentPoolId: string;
  sortOrder: number;
  isRequired: boolean;
  createdAt: string;
  course: {
    name: string;
  };
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
  const router = useRouter();
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
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [isDuplicatingToBank, setIsDuplicatingToBank] = useState(false);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [courseLinks, setCourseLinks] = useState<AssessmentCourseLink[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [assignAsRequired, setAssignAsRequired] = useState(false);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);

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

  const fetchCourseAssignments = useCallback(async () => {
    if (!poolId) {
      return;
    }

    setIsLoadingAssignments(true);

    try {
      const [coursesResponse, linksResponse] = await Promise.all([
        fetch("/api/courses", { cache: "no-store" }),
        fetch(`/api/course-assessment-link?assessmentPoolId=${encodeURIComponent(poolId)}`, { cache: "no-store" }),
      ]);

      const [coursesResult, linksResult] = await Promise.all([
        coursesResponse.json() as Promise<{ data?: CourseOption[]; error?: string }>,
        linksResponse.json() as Promise<{ data?: AssessmentCourseLink[]; error?: string }>,
      ]);

      if (!coursesResponse.ok) {
        throw new Error(coursesResult.error || "Failed to load courses.");
      }

      if (!linksResponse.ok) {
        throw new Error(linksResult.error || "Failed to load assessment course assignments.");
      }

      setCourses((coursesResult.data ?? []).filter((course) => course.isActive));
      setCourseLinks(linksResult.data ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load assessment course assignments.");
    } finally {
      setIsLoadingAssignments(false);
    }
  }, [poolId]);

  useEffect(() => {
    if (!open || !poolId) {
      return;
    }

    void Promise.all([fetchDetail(), fetchCourseAssignments()]);
  }, [open, poolId, fetchCourseAssignments, fetchDetail]);

  useEffect(() => {
    if (detail) {
      setMetadataForm(buildMetadataForm(detail));
      setMetadataErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setImportDialogOpen(false);
      setSelectedQuestionIds([]);
      setCourses([]);
      setCourseLinks([]);
      setSelectedCourseId("");
      setAssignAsRequired(false);
      setIsLoadingAssignments(false);
      setIsSavingAssignment(false);
      setMetadataErrors({});
    }
  }, [open, poolId]);

  useEffect(() => {
    if (!detail || !editingQuestion) {
      return;
    }

    const nextEditingQuestion = detail.questions.find((question) => question.id === editingQuestion.id) ?? null;
    setEditingQuestion(nextEditingQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail, editingQuestion?.id]);

  useEffect(() => {
    if (!detail) {
      return;
    }

    setSelectedQuestionIds((current) => current.filter((questionId) => detail.questions.some((question) => question.id === questionId)));
  }, [detail]);

  const availableCourses = courses.filter((course) => !courseLinks.some((link) => link.courseId === course.id));

  useEffect(() => {
    setSelectedCourseId((current) => {
      if (current && availableCourses.some((course) => course.id === current)) {
        return current;
      }

      return availableCourses[0]?.id ?? "";
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseLinks, courses]);

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

  const toggleQuestionSelection = (questionId: string) => {
    setSelectedQuestionIds((current) => (
      current.includes(questionId)
        ? current.filter((item) => item !== questionId)
        : [...current, questionId]
    ));
  };

  const handleSelectAllQuestions = () => {
    if (!detail) {
      return;
    }

    setSelectedQuestionIds(detail.questions.map((question) => question.id));
  };

  const handleClearQuestionSelection = () => {
    setSelectedQuestionIds([]);
  };

  const handleDuplicateSelectedToBank = async () => {
    if (!detail || selectedQuestionIds.length === 0) {
      toast.info("Select at least one question to duplicate.");
      return;
    }

    setIsDuplicatingToBank(true);

    try {
      const response = await fetch("/api/question-bank/from-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentPoolId: detail.id,
          questionIds: selectedQuestionIds,
          tags: [],
        }),
      });

      const payload = (await response.json()) as { data?: { affectedCount: number }; error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Failed to duplicate questions to the bank.");
      }

      const affectedCount = payload.data?.affectedCount ?? selectedQuestionIds.length;
      toast.success(`${affectedCount} question${affectedCount === 1 ? "" : "s"} duplicated to the Question Bank.`);
      setSelectedQuestionIds([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to duplicate questions to the bank.");
    } finally {
      setIsDuplicatingToBank(false);
    }
  };

  const handleQuestionsImported = () => {
    setImportDialogOpen(false);
    void fetchDetail();
    onUpdated?.();
  };

  const handleAssignToCourse = async () => {
    if (!detail || !selectedCourseId) {
      toast.info("Select a course to link this assessment.");
      return;
    }

    setIsSavingAssignment(true);

    try {
      const response = await fetch("/api/course-assessment-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: selectedCourseId,
          assessmentPoolId: detail.id,
          sortOrder: courseLinks.length,
          isRequired: assignAsRequired,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to assign assessment to course.");
      }

      toast.success("Assessment linked to course.");
      setAssignAsRequired(false);
      await Promise.all([fetchCourseAssignments(), fetchDetail()]);
      onUpdated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign assessment to course.");
    } finally {
      setIsSavingAssignment(false);
    }
  };

  const handleRemoveCourseLink = async (courseId: string) => {
    if (!detail) {
      return;
    }

    setIsSavingAssignment(true);

    try {
      const response = await fetch("/api/course-assessment-link", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          assessmentPoolId: detail.id,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to remove assessment course link.");
      }

      toast.success("Assessment unlinked from course.");
      await Promise.all([fetchCourseAssignments(), fetchDetail()]);
      onUpdated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove assessment course link.");
    } finally {
      setIsSavingAssignment(false);
    }
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
                {detail.createdByName && <span> · Created by {detail.createdByName}</span>}
              </SheetDescription>
              <Button
                variant="secondary"
                size="sm"
                className="mt-2 gap-1.5 text-xs"
                onClick={() => {
                  onOpenChange(false);
                  router.push(`/assessments/${detail.id}`);
                }}
              >
                Open in Full Builder →
              </Button>
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
                      <Badge variant="info">{QUESTION_TYPE_LABELS[detail.questionType as keyof typeof QUESTION_TYPE_LABELS] ?? detail.questionType}</Badge>
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
                          {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
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

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Course Assignments</h4>
                    <p className="mt-1 text-sm text-slate-500">Assessments are created in the shared pool first, then linked to courses here.</p>
                  </div>
                  <Badge variant="info">{courseLinks.length} linked</Badge>
                </div>

                {isLoadingAssignments ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : courseLinks.length > 0 ? (
                  <div className="space-y-2">
                    {courseLinks.map((link) => (
                      <div key={link.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{link.course.name}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <Badge variant="info">Sort {link.sortOrder + 1}</Badge>
                            <Badge variant={link.isRequired ? "accent" : "default"}>
                              {link.isRequired ? "Required in course" : "Optional in course"}
                            </Badge>
                          </div>
                        </div>
                        <CanAccess permission="assessment_pool.edit">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="border-rose-300 text-rose-700 hover:bg-rose-50"
                            onClick={() => void handleRemoveCourseLink(link.courseId)}
                            disabled={isSavingAssignment}
                          >
                            Remove link
                          </Button>
                        </CanAccess>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-3 text-sm text-slate-600">
                    This assessment is not linked to any course yet.
                  </div>
                )}

                {detail.status !== "ARCHIVED" ? (
                  <CanAccess permission="assessment_pool.edit">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Assign to course</label>
                          <select
                            value={selectedCourseId}
                            onChange={(event) => setSelectedCourseId(event.target.value)}
                            disabled={isSavingAssignment || availableCourses.length === 0}
                            className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm text-slate-900"
                          >
                            <option value="">Select a course</option>
                            {availableCourses.map((course) => (
                              <option key={course.id} value={course.id}>{course.name}</option>
                            ))}
                          </select>
                        </div>

                        <Button
                          type="button"
                          onClick={() => void handleAssignToCourse()}
                          disabled={!selectedCourseId || isSavingAssignment}
                        >
                          {isSavingAssignment ? "Saving..." : "Assign to course"}
                        </Button>
                      </div>

                      <label className="flex items-center gap-2 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          checked={assignAsRequired}
                          onChange={(event) => setAssignAsRequired(event.target.checked)}
                          disabled={!selectedCourseId || isSavingAssignment}
                          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-[#0d3b84]"
                        />
                        Mark this assessment as required for the selected course.
                      </label>

                      {availableCourses.length === 0 ? (
                        <p className="text-xs text-slate-500">This assessment is already linked to every active course.</p>
                      ) : null}
                    </div>
                  </CanAccess>
                ) : null}
              </section>

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
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-medium">Questions ({detail.questions.length})</h4>
                    {selectedQuestionIds.length > 0 ? <p className="mt-1 text-xs text-slate-500">{selectedQuestionIds.length} selected for bulk actions.</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" size="sm" variant="ghost" onClick={handleSelectAllQuestions} disabled={detail.questions.length === 0}>
                      Select all
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={handleClearQuestionSelection} disabled={selectedQuestionIds.length === 0}>
                      Clear
                    </Button>
                    {detail.status !== "ARCHIVED" ? (
                      <CanAccess permission="assessment_pool.edit">
                        <>
                          <Button type="button" size="sm" variant="secondary" onClick={() => void handleDuplicateSelectedToBank()} disabled={selectedQuestionIds.length === 0 || isDuplicatingToBank}>
                            {isDuplicatingToBank ? "Duplicating..." : `Duplicate to Bank${selectedQuestionIds.length > 0 ? ` (${selectedQuestionIds.length})` : ""}`}
                          </Button>
                          <Button type="button" size="sm" variant="secondary" onClick={() => setImportDialogOpen(true)}>
                            <ArrowDownToLine className="h-4 w-4" />
                            Import from Question Bank
                          </Button>
                        </>
                      </CanAccess>
                    ) : null}
                  </div>
                </div>
                {detail.questions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No questions added yet. Use the builder below or import reusable questions from the Question Bank.</p>
                ) : (
                  <div className="divide-y rounded-lg border">
                    {detail.questions.map((q, i) => (
                      <div
                        key={q.id}
                        className={`flex items-start justify-between gap-3 px-3 py-2 ${editingQuestion?.id === q.id ? "bg-slate-50" : ""}`}
                      >
                        <div className="flex min-w-0 flex-1 gap-3">
                          <input
                            type="checkbox"
                            checked={selectedQuestionIds.includes(q.id)}
                            onChange={() => toggleQuestionSelection(q.id)}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-[#0d3b84]"
                          />
                          <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground">Q{i + 1}</span>
                            <Badge variant="info" className="text-[10px] px-1 py-0">
                              {QUESTION_TYPE_LABELS[q.questionType as keyof typeof QUESTION_TYPE_LABELS] ?? q.questionType}
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

              <ImportQuestionBankDialog
                open={importDialogOpen}
                onOpenChange={setImportDialogOpen}
                assessmentPoolId={detail.id}
                courseId={null}
                defaultQuestionType={detail.questionType}
                onImported={handleQuestionsImported}
              />
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
