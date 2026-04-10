"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

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
  explanation: string | null;
  tags: string[];
  marks: number;
};

const questionTypeLabels: Record<string, string> = {
  MCQ: "Multiple Choice",
  NUMERIC: "Numeric",
  ESSAY: "Essay",
  FILL_IN_THE_BLANK: "Fill in the Blank",
  MULTI_INPUT_REASONING: "Multi-Input Reasoning",
  TWO_PART_ANALYSIS: "Two-Part Analysis",
};

export function ImportQuestionBankDialog({
  open,
  onOpenChange,
  assessmentPoolId,
  courseId,
  defaultQuestionType,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessmentPoolId: string;
  courseId: string | null;
  defaultQuestionType: string;
  onImported: () => void;
}) {
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState(courseId ?? "");
  const [filterType, setFilterType] = useState(defaultQuestionType);
  const [searchTerm, setSearchTerm] = useState("");
  const [questions, setQuestions] = useState<QuestionBankQuestionItem[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const loadCourses = useCallback(async () => {
    setIsLoadingCourses(true);

    try {
      const response = await fetch("/api/courses", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load courses.");
      }

      const result = (await response.json()) as { data?: CourseOption[] };
      const activeCourses = (result.data ?? []).filter((item) => item.isActive);
      setCourses(activeCourses);
      setSelectedCourseId((current) => {
        if (current && activeCourses.some((item) => item.id === current)) {
          return current;
        }

        if (courseId && activeCourses.some((item) => item.id === courseId)) {
          return courseId;
        }

        return "";
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load courses.");
    } finally {
      setIsLoadingCourses(false);
    }
  }, [courseId]);

  const loadQuestions = useCallback(async () => {
    if (!open) {
      return;
    }

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
    } finally {
      setIsLoadingQuestions(false);
    }
  }, [filterType, open, searchTerm, selectedCourseId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedQuestionIds([]);
    setSelectedTag(null);
    setSearchTerm("");
    setFilterType(defaultQuestionType);
    setSelectedCourseId(courseId ?? "");
    void loadCourses();
  }, [courseId, defaultQuestionType, loadCourses, open]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

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

  const toggleQuestionSelection = (questionId: string) => {
    setSelectedQuestionIds((current) => (
      current.includes(questionId)
        ? current.filter((item) => item !== questionId)
        : [...current, questionId]
    ));
  };

  const handleSelectAllVisible = () => {
    setSelectedQuestionIds((current) => [...new Set([...current, ...visibleQuestions.map((question) => question.id)])]);
  };

  const handleClearSelection = () => {
    setSelectedQuestionIds([]);
  };

  const handleImport = async () => {
    if (selectedQuestionIds.length === 0) {
      toast.info("Select at least one question to import.");
      return;
    }

    setIsImporting(true);

    try {
      const response = await fetch(`/api/assessment-pool/${assessmentPoolId}/import-question-bank`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionIds: selectedQuestionIds }),
      });
      const payload = (await response.json()) as { data?: { importedCount: number }; error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Failed to import questions.");
      }

      const importedCount = payload.data?.importedCount ?? selectedQuestionIds.length;
      toast.success(`${importedCount} question${importedCount === 1 ? "" : "s"} imported.`);
      onImported();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to import questions.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] w-[min(96vw,64rem)] max-w-4xl flex-col overflow-hidden p-0">
        <DialogHeader>
          <DialogTitle>Import from Question Bank</DialogTitle>
          <DialogDescription>
            Select reusable questions and clone them into this assessment. Imported questions stay editable inside the assessment builder.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-6 py-5">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(180px,0.8fr)_minmax(180px,0.8fr)]">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Search bank</label>
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
                {Object.entries(questionTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">{visibleQuestions.length} available</Badge>
              <Badge variant={selectedQuestionIds.length > 0 ? "success" : "default"}>
                {selectedQuestionIds.length} selected
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={handleSelectAllVisible} disabled={visibleQuestions.length === 0}>
                Select visible
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={handleClearSelection} disabled={selectedQuestionIds.length === 0}>
                Clear selection
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedTag(null);
                  setFilterType(defaultQuestionType);
                  setSelectedCourseId(courseId ?? "");
                }}
              >
                Reset filters
              </Button>
            </div>
          </div>

          {availableTags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
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

          <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white">
            {isLoadingQuestions ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : visibleQuestions.length === 0 ? (
              <div className="flex h-full min-h-[260px] flex-col items-center justify-center px-6 text-center">
                <p className="text-sm font-semibold text-slate-900">No bank questions match the current filters.</p>
                <p className="mt-2 text-sm text-slate-500">Adjust the course scope, question type, or search text and try again.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {visibleQuestions.map((question) => {
                  const isSelected = selectedQuestionIds.includes(question.id);

                  return (
                    <label key={question.id} className={`flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors ${isSelected ? "bg-blue-50/70" : "hover:bg-slate-50"}`}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleQuestionSelection(question.id)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-[#0d3b84]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="info">{questionTypeLabels[question.questionType] ?? question.questionType}</Badge>
                          <Badge variant="default">{question.marks} mark{question.marks === 1 ? "" : "s"}</Badge>
                          <span className="text-xs text-slate-500">{question.courseName ?? "All courses bank"}</span>
                        </div>
                        <p className="mt-2 text-sm font-medium text-slate-900">{question.questionText}</p>
                        {question.explanation ? <p className="mt-1 text-xs text-slate-500 line-clamp-2">{question.explanation}</p> : null}
                        {question.tags.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {question.tags.map((tag) => (
                              <Badge key={tag} variant="default" className="px-1.5 py-0 text-[10px]">#{tag}</Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={isImporting}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleImport()} disabled={isImporting || selectedQuestionIds.length === 0}>
            {isImporting ? "Importing..." : `Import ${selectedQuestionIds.length || ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}