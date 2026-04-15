"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { QuestionBuilder } from "@/components/modules/assessment-pool/question-builder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/ui/can-access";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { QUESTION_TYPE_LABELS } from "@/lib/question-types";

type CourseOption = {
  id: string;
  name: string;
  isActive: boolean;
};

type QuestionBankQuestionItem = {
  id: string;
  courseId: string | null;
  courseName: string | null;
  questionText: string;
  questionType: string;
  options: unknown;
  correctAnswer: unknown;
  explanation: string | null;
  tags: string[];
  marks: number;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString();
}

function parseQuestionBankTags(value: string) {
  const normalized = value
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);

  return [...new Set(normalized)];
}

export function QuestionBankWorkspace() {
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [filterType, setFilterType] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [questions, setQuestions] = useState<QuestionBankQuestionItem[]>([]);
  const [editingQuestion, setEditingQuestion] = useState<QuestionBankQuestionItem | null>(null);
  const [draftCourseId, setDraftCourseId] = useState("");
  const [tagInputValue, setTagInputValue] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [pendingDeleteQuestionId, setPendingDeleteQuestionId] = useState<string | null>(null);
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);

  const loadCourses = useCallback(async () => {
    setIsLoadingCourses(true);

    try {
      const response = await fetch("/api/courses", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load courses.");
      }

      const result = (await response.json()) as { data?: CourseOption[] };
      const activeCourses = (result.data ?? []).filter((course) => course.isActive);
      const requestedCourseId = typeof window === "undefined"
        ? ""
        : new URLSearchParams(window.location.search).get("courseId")?.trim() ?? "";
      const preferredCourseId = activeCourses.some((course) => course.id === requestedCourseId) ? requestedCourseId : "";

      setCourses(activeCourses);
      setSelectedCourseId((current) => {
        if (current && activeCourses.some((course) => course.id === current)) {
          return current;
        }

        return preferredCourseId;
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load courses.");
    } finally {
      setIsLoadingCourses(false);
    }
  }, []);

  const loadQuestions = useCallback(async () => {
    setIsLoadingQuestions(true);

    try {
      const params = new URLSearchParams();
      if (selectedCourseId) {
        params.set("courseId", selectedCourseId);
      }
      if (filterType) {
        params.set("questionType", filterType);
      }
      if (searchTerm.trim()) {
        params.set("q", searchTerm.trim());
      }

      const response = await fetch(`/api/question-bank?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load question bank.");
      }

      const result = (await response.json()) as { data?: QuestionBankQuestionItem[] };
      setQuestions(result.data ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load question bank.");
      setQuestions([]);
    } finally {
      setIsLoadingQuestions(false);
    }
  }, [filterType, searchTerm, selectedCourseId]);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  useEffect(() => {
    if (!editingQuestion) {
      return;
    }

    const nextEditingQuestion = questions.find((question) => question.id === editingQuestion.id) ?? null;
    setEditingQuestion(nextEditingQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only re-sync when editingQuestion.id changes, not on every editingQuestion reference change
  }, [editingQuestion?.id, questions]);

  useEffect(() => {
    if (editingQuestion) {
      setDraftCourseId(editingQuestion.courseId ?? "");
      setTagInputValue(editingQuestion.tags.join(", "));
      return;
    }

    setDraftCourseId(selectedCourseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only reset drafts when specific editingQuestion properties change
  }, [editingQuestion?.id, editingQuestion?.courseId, editingQuestion?.tags, selectedCourseId]);

  useEffect(() => {
    setSelectedQuestionIds((current) => current.filter((questionId) => questions.some((question) => question.id === questionId)));
  }, [questions]);

  const availableTags = useMemo(
    () => [...new Set(questions.flatMap((question) => question.tags))].sort((left, right) => left.localeCompare(right)),
    [questions],
  );

  useEffect(() => {
    if (selectedTag && !availableTags.includes(selectedTag)) {
      setSelectedTag(null);
    }
  }, [availableTags, selectedTag]);

  const visibleQuestions = useMemo(
    () => (selectedTag ? questions.filter((question) => question.tags.includes(selectedTag)) : questions),
    [questions, selectedTag],
  );

  const selectedTagPreview = useMemo(() => parseQuestionBankTags(tagInputValue), [tagInputValue]);

  const handleQuestionSaved = () => {
    setEditingQuestion(null);
    void loadQuestions();
  };

  const toggleQuestionSelection = (questionId: string) => {
    setSelectedQuestionIds((current) => (
      current.includes(questionId)
        ? current.filter((item) => item !== questionId)
        : [...current, questionId]
    ));
  };

  const handleSelectAllVisibleQuestions = () => {
    setSelectedQuestionIds((current) => [...new Set([...current, ...visibleQuestions.map((question) => question.id)])]);
  };

  const handleClearQuestionSelection = () => {
    setSelectedQuestionIds([]);
  };

  const handleDeleteQuestion = async (questionId: string) => {
    setDeletingQuestionId(questionId);

    try {
      const response = await fetch(`/api/question-bank/${questionId}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to delete question.");
      }

      toast.success("Question removed from the bank.");
      setPendingDeleteQuestionId(null);
      setEditingQuestion((current) => (current?.id === questionId ? null : current));
      setSelectedQuestionIds((current) => current.filter((item) => item !== questionId));
      void loadQuestions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete question.");
    } finally {
      setDeletingQuestionId(null);
    }
  };

  const handleBulkDeleteQuestions = async () => {
    if (selectedQuestionIds.length === 0) {
      toast.info("Select at least one question.");
      return;
    }

    setIsBulkDeleting(true);

    try {
      const response = await fetch("/api/question-bank/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionIds: selectedQuestionIds }),
      });
      const payload = (await response.json()) as { data?: { affectedCount: number }; error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Failed to delete selected questions.");
      }

      const affectedCount = payload.data?.affectedCount ?? selectedQuestionIds.length;
      toast.success(`${affectedCount} question${affectedCount === 1 ? "" : "s"} removed from the bank.`);
      setSelectedQuestionIds([]);
      setEditingQuestion(null);
      setPendingDeleteQuestionId(null);
      void loadQuestions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete selected questions.");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const selectedCourse = courses.find((course) => course.id === selectedCourseId) ?? null;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-slate-200 bg-white/95">
        <CardContent className="py-4">
          <div className="space-y-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-primary shadow-sm">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <h1 className="text-xl font-semibold tracking-tight text-slate-950">Question Bank</h1>
                  <Badge variant={selectedCourseId ? "info" : "default"} className="px-2 py-0.5 text-[9px] tracking-[0.16em]">
                    {selectedCourseId ? "Course Scope" : "Global Bank"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Build reusable questions once, then import them into assessment authoring without rebuilding the question structure.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button asChild variant="secondary">
                  <Link href="/assessments">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Assessments
                  </Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(180px,0.8fr)_minmax(180px,0.8fr)]">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Search questions</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search question text or explanation"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Course scope</label>
                <select
                  value={selectedCourseId}
                  onChange={(event) => setSelectedCourseId(event.target.value)}
                  className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm text-slate-900"
                  disabled={isLoadingCourses}
                >
                  <option value="">All courses bank</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>{course.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Question type</label>
                <select
                  value={filterType}
                  onChange={(event) => setFilterType(event.target.value)}
                  className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm text-slate-900"
                >
                  <option value="">All types</option>
                  {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default" className="px-2 py-0.5 text-[9px] tracking-[0.16em]">Scope: {selectedCourse ? selectedCourse.name : "All active courses"}</Badge>
              <Badge variant="default" className="px-2 py-0.5 text-[9px] tracking-[0.16em]">Questions: {visibleQuestions.length}</Badge>
              <Badge variant={selectedQuestionIds.length > 0 ? "success" : "default"} className="px-2 py-0.5 text-[9px] tracking-[0.16em]">
                Selected: {selectedQuestionIds.length}
              </Badge>
              <Badge variant="default" className="px-2 py-0.5 text-[9px] tracking-[0.16em]">Status: {isLoadingQuestions ? "Loading" : "Ready"}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[#edf2f7] bg-white/90">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle>Reusable Question Inventory</CardTitle>
              <CardDescription>
                Review saved questions, bulk-select them for cleanup, or open one for editing.
              </CardDescription>
            </div>
            <Badge variant="info" className="self-start px-2.5 py-1 text-[9px] tracking-[0.16em]">
              {selectedCourse ? `Scoped: ${selectedCourse.name}` : "Scoped: All Courses"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={handleSelectAllVisibleQuestions} disabled={visibleQuestions.length === 0}>
                Select visible
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={handleClearQuestionSelection} disabled={selectedQuestionIds.length === 0}>
                Clear selection
              </Button>
            </div>
            <CanAccess permission="assessment_pool.edit">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="border-rose-300 text-rose-700 hover:bg-rose-50"
                onClick={() => void handleBulkDeleteQuestions()}
                disabled={selectedQuestionIds.length === 0 || isBulkDeleting}
              >
                <Trash2 className="h-4 w-4" />
                {isBulkDeleting ? "Deleting..." : `Delete Selected${selectedQuestionIds.length > 0 ? ` (${selectedQuestionIds.length})` : ""}`}
              </Button>
            </CanAccess>
          </div>

          {availableTags.length > 0 ? (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Button type="button" variant={selectedTag ? "ghost" : "secondary"} size="sm" onClick={() => setSelectedTag(null)}>
                All tags
              </Button>
              {availableTags.map((tag) => (
                <Button
                  key={tag}
                  type="button"
                  variant={selectedTag === tag ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setSelectedTag((current) => current === tag ? null : tag)}
                >
                  #{tag}
                </Button>
              ))}
            </div>
          ) : null}

          {isLoadingQuestions ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          ) : visibleQuestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-muted-foreground">
              <p className="text-sm">No reusable questions found.</p>
              <p className="mt-1 text-xs">Adjust the active tag or add your first question below to start the bank.</p>
            </div>
          ) : (
            <div className="divide-y rounded-lg border">
              {visibleQuestions.map((question, index) => (
                <div key={question.id} className={`px-4 py-3 ${editingQuestion?.id === question.id ? "bg-slate-50" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 gap-3">
                      <input
                        type="checkbox"
                        checked={selectedQuestionIds.includes(question.id)}
                        onChange={() => toggleQuestionSelection(question.id)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-[#0d3b84]"
                      />
                      <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">QB{index + 1}</span>
                        <Badge variant="info" className="px-1.5 py-0 text-[10px]">
                          {QUESTION_TYPE_LABELS[question.questionType as keyof typeof QUESTION_TYPE_LABELS] ?? question.questionType}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{question.courseName ?? "All courses bank"}</span>
                        <span className="text-xs text-muted-foreground">{question.marks} mark{question.marks === 1 ? "" : "s"}</span>
                        {editingQuestion?.id === question.id ? <Badge variant="info" className="px-1.5 py-0 text-[10px]">Editing</Badge> : null}
                      </div>
                      <p className="mt-1 text-sm font-medium text-slate-900">{question.questionText}</p>
                      {question.explanation ? <p className="mt-1 text-xs text-slate-500 line-clamp-2">{question.explanation}</p> : null}
                      {question.tags.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {question.tags.map((tag) => (
                            <Badge key={tag} variant="default" className="px-1.5 py-0 text-[10px]">#{tag}</Badge>
                          ))}
                        </div>
                      ) : null}
                      <p className="mt-2 text-xs text-slate-400">Updated {formatDate(question.updatedAt)}{question.createdByName ? ` · ${question.createdByName}` : ""}</p>

                      {pendingDeleteQuestionId === question.id ? (
                        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                          <p className="text-xs text-rose-700">Remove this question from the bank?</p>
                          <div className="mt-2 flex items-center gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => setPendingDeleteQuestionId(null)}
                              disabled={deletingQuestionId === question.id}
                            >
                              Keep
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="bg-rose-600 text-white hover:bg-rose-700"
                              onClick={() => void handleDeleteQuestion(question.id)}
                              disabled={deletingQuestionId === question.id}
                            >
                              {deletingQuestionId === question.id ? "Removing..." : "Delete question"}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                      </div>
                    </div>

                    <CanAccess permission="assessment_pool.edit">
                      <div className="flex shrink-0 items-center gap-2">
                        <Button type="button" variant="secondary" size="sm" onClick={() => setEditingQuestion((current) => current?.id === question.id ? null : question)}>
                          {editingQuestion?.id === question.id ? "Close" : "Edit"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-rose-600 hover:text-rose-700"
                          onClick={() => {
                            setEditingQuestion((current) => (current?.id === question.id ? null : current));
                            setPendingDeleteQuestionId((current) => current === question.id ? null : question.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </CanAccess>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[#edf2f7] bg-white/90">
          <CardTitle>{editingQuestion ? "Edit Reusable Question" : "Add Reusable Question"}</CardTitle>
          <CardDescription>
            The authoring workflow matches the assessment question builder so imported questions behave exactly the same after they are cloned into an assessment.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="mb-5 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-[minmax(180px,0.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Store Under</label>
              <select
                value={draftCourseId}
                onChange={(event) => setDraftCourseId(event.target.value)}
                className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm text-slate-900"
                disabled={isLoadingCourses}
              >
                <option value="">All courses bank</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.name}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500">Use a course scope when the question should mainly be reused inside one course family.</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Bank Tags</label>
              <Input
                value={tagInputValue}
                onChange={(event) => setTagInputValue(event.target.value)}
                placeholder="grammar, listening, emergency-care"
              />
              <p className="text-xs text-slate-500">Comma-separated tags help bank search, filtering, and reuse.</p>
              {selectedTagPreview.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {selectedTagPreview.map((tag) => (
                    <Badge key={tag} variant="default" className="px-1.5 py-0 text-[10px]">#{tag}</Badge>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <CanAccess permission="assessment_pool.edit">
            <QuestionBuilder
              context="question-bank"
              defaultType={(editingQuestion?.questionType ?? filterType) || "MCQ"}
              questionCount={questions.length}
              mode={editingQuestion ? "edit" : "create"}
              initialQuestion={editingQuestion}
              createEndpoint="/api/question-bank"
              getUpdateEndpoint={(questionId) => `/api/question-bank/${questionId}`}
              requestTransform={(payload) => ({
                ...payload,
                courseId: draftCourseId || undefined,
                tags: parseQuestionBankTags(tagInputValue),
              })}
              onSaved={handleQuestionSaved}
              onCancel={() => setEditingQuestion(null)}
            />
          </CanAccess>
        </CardContent>
      </Card>
    </div>
  );
}