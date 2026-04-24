"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QUESTION_TYPE_OPTIONS } from "@/lib/question-types";

import { QuestionPreview } from "@/components/modules/question-editor/question-preview";
import { McqEditor, DEFAULT_MCQ_OPTIONS } from "@/components/modules/question-editor/type-editors/mcq-editor";
import { TrueFalseEditor } from "@/components/modules/question-editor/type-editors/true-false-editor";
import { NumericEditor } from "@/components/modules/question-editor/type-editors/numeric-editor";
import { FillBlankEditor } from "@/components/modules/question-editor/type-editors/fill-blank-editor";
import { TwoPartEditor, DEFAULT_TWO_PART_OPTIONS } from "@/components/modules/question-editor/type-editors/two-part-editor";
import { MultiInputEditor, DEFAULT_MULTI_FIELDS } from "@/components/modules/question-editor/type-editors/multi-input-editor";
import type { MultiInputField } from "@/components/modules/question-editor/type-editors/multi-input-editor";
import { EssayEditor } from "@/components/modules/question-editor/type-editors/essay-editor";

type QuestionEditorContext = "assessment" | "question-bank";

type QuestionEditorPageProps = {
  questionId?: string;
  poolId?: string;
  context: QuestionEditorContext;
  backHref: string;
  backLabel?: string;
};

type QuestionForm = {
  questionText: string;
  questionType: string;
  explanation: string;
  marks: number;
  difficultyLevel: string;
};

type LoadedQuestion = {
  id: string;
  questionText: string;
  questionType: string;
  options: unknown;
  correctAnswer: unknown;
  explanation: string | null;
  marks: number;
  difficultyLevel?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getInitialMcqOptions(options: unknown) {
  if (!Array.isArray(options)) return DEFAULT_MCQ_OPTIONS.map((o) => ({ ...o }));
  const normalized = options
    .map((opt, i) => {
      if (!isRecord(opt)) return null;
      return {
        label: typeof opt.label === "string" && opt.label.trim() ? opt.label : String.fromCharCode(65 + i),
        text: typeof opt.text === "string" ? opt.text : "",
      };
    })
    .filter(Boolean) as { label: string; text: string }[];
  return normalized.length > 0 ? normalized : DEFAULT_MCQ_OPTIONS.map((o) => ({ ...o }));
}

function getInitialMcqCorrect(answer: unknown, options: { label: string }[]) {
  if (typeof answer !== "string") return "";
  return options.some((o) => o.label === answer) ? answer : "";
}

function getInitialNumeric(answer: unknown) {
  if (!isRecord(answer)) return { value: "" as string | number, tolerance: 0 as string | number };
  return {
    value: typeof answer.value === "number" || typeof answer.value === "string" ? answer.value : "",
    tolerance: typeof answer.tolerance === "number" || typeof answer.tolerance === "string" ? answer.tolerance : 0,
  };
}

function getInitialTrueFalse(answer: unknown): boolean | null {
  if (typeof answer === "boolean") return answer;
  if (typeof answer === "string") {
    if (answer.toLowerCase() === "true") return true;
    if (answer.toLowerCase() === "false") return false;
  }
  return null;
}

function getInitialFillAnswers(answer: unknown): string[] {
  if (!Array.isArray(answer)) return [""];
  const filtered = answer.filter((a): a is string => typeof a === "string");
  return filtered.length > 0 ? filtered : [""];
}

function getInitialTwoPartOptions(options: unknown): string[] {
  if (!Array.isArray(options)) return [...DEFAULT_TWO_PART_OPTIONS];
  const filtered = options.filter((o): o is string => typeof o === "string");
  return filtered.length > 0 ? filtered : [...DEFAULT_TWO_PART_OPTIONS];
}

function getInitialTwoPartAnswer(answer: unknown) {
  if (!isRecord(answer)) return { partA: "", partB: "" };
  return {
    partA: typeof answer.partA === "string" ? answer.partA : "",
    partB: typeof answer.partB === "string" ? answer.partB : "",
  };
}

function getInitialMultiFields(options: unknown, answer: unknown): MultiInputField[] {
  if (isRecord(options) && Array.isArray(options.fields)) {
    const normalized = options.fields
      .map((f) => {
        if (!isRecord(f)) return null;
        return { label: typeof f.label === "string" ? f.label : "", expectedAnswer: typeof f.expectedAnswer === "string" ? f.expectedAnswer : "" };
      })
      .filter(Boolean) as MultiInputField[];
    if (normalized.length > 0) return normalized;
  }
  if (isRecord(answer)) {
    const entries = Object.entries(answer).filter(([, v]) => typeof v === "string").map(([k, v]) => ({ label: k, expectedAnswer: v as string }));
    if (entries.length > 0) return entries;
  }
  return [...DEFAULT_MULTI_FIELDS];
}

function getInitialEssay(options: unknown) {
  if (isRecord(options)) {
    return {
      rubric: typeof options.rubric === "string" ? options.rubric : "",
      maxWordCount: typeof options.maxWordCount === "number" ? options.maxWordCount : 500,
    };
  }
  return { rubric: "", maxWordCount: 500 };
}

export function QuestionEditorPage({ questionId, poolId, context, backHref, backLabel }: QuestionEditorPageProps) {
  const router = useRouter();
  const isEditMode = Boolean(questionId);

  const [loading, setLoading] = useState(isEditMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<QuestionForm>({
    questionText: "",
    questionType: "MCQ",
    explanation: "",
    marks: 1,
    difficultyLevel: "",
  });

  // Type-specific state
  const [mcqOptions, setMcqOptions] = useState(DEFAULT_MCQ_OPTIONS.map((o) => ({ ...o })));
  const [mcqCorrect, setMcqCorrect] = useState("");
  const [trueFalseAnswer, setTrueFalseAnswer] = useState<boolean | null>(null);
  const [numericValue, setNumericValue] = useState<number | string>("");
  const [numericTolerance, setNumericTolerance] = useState<number | string>(0);
  const [fillAnswers, setFillAnswers] = useState<string[]>([""]);
  const [twoPartOptions, setTwoPartOptions] = useState<string[]>([...DEFAULT_TWO_PART_OPTIONS]);
  const [twoPartA, setTwoPartA] = useState("");
  const [twoPartB, setTwoPartB] = useState("");
  const [multiFields, setMultiFields] = useState<MultiInputField[]>([...DEFAULT_MULTI_FIELDS]);
  const [essayRubric, setEssayRubric] = useState("");
  const [essayMaxWords, setEssayMaxWords] = useState(500);

  // Load existing question for edit
  useEffect(() => {
    if (!questionId) return;

    const url = context === "question-bank"
      ? `/api/question-bank/${questionId}`
      : poolId
        ? `/api/assessment-pool/${poolId}/questions/${questionId}`
        : null;

    if (!url) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to load question");
        const json = (await res.json()) as { data: LoadedQuestion };
        const data = json.data;

        setForm({
          questionText: data.questionText ?? "",
          questionType: data.questionType ?? "MCQ",
          explanation: data.explanation ?? "",
          marks: data.marks ?? 1,
          difficultyLevel: data.difficultyLevel ?? "",
        });

        const opts = getInitialMcqOptions(data.options);
        setMcqOptions(opts);
        setMcqCorrect(getInitialMcqCorrect(data.correctAnswer, opts));
        setTrueFalseAnswer(getInitialTrueFalse(data.correctAnswer));
        const numeric = getInitialNumeric(data.correctAnswer);
        setNumericValue(numeric.value);
        setNumericTolerance(numeric.tolerance);
        setFillAnswers(getInitialFillAnswers(data.correctAnswer));
        setTwoPartOptions(getInitialTwoPartOptions(data.options));
        const twoPart = getInitialTwoPartAnswer(data.correctAnswer);
        setTwoPartA(twoPart.partA);
        setTwoPartB(twoPart.partB);
        setMultiFields(getInitialMultiFields(data.options, data.correctAnswer));
        const essay = getInitialEssay(data.options);
        setEssayRubric(essay.rubric);
        setEssayMaxWords(essay.maxWordCount);
      } catch {
        toast.error("Failed to load question.");
      } finally {
        setLoading(false);
      }
    })();
  }, [questionId, poolId, context]);

  // Build payload
  const buildPayload = () => {
    let options: unknown = null;
    let correctAnswer: unknown = null;

    switch (form.questionType) {
      case "MCQ": {
        options = mcqOptions.map((o) => ({ label: o.label, text: o.text.trim() })).filter((o) => o.text.length > 0);
        correctAnswer = mcqCorrect;
        break;
      }
      case "TRUE_FALSE":
        correctAnswer = trueFalseAnswer;
        break;
      case "NUMERIC":
        correctAnswer = { value: Number(numericValue), tolerance: Number(numericTolerance) };
        break;
      case "FILL_IN_THE_BLANK":
        correctAnswer = fillAnswers.map((a) => a.trim()).filter(Boolean);
        break;
      case "TWO_PART_ANALYSIS":
        options = twoPartOptions.map((o) => o.trim()).filter(Boolean);
        correctAnswer = { partA: twoPartA.trim(), partB: twoPartB.trim() };
        break;
      case "MULTI_INPUT_REASONING": {
        const normalized = multiFields.map((f) => ({ label: f.label.trim(), expectedAnswer: f.expectedAnswer.trim() })).filter((f) => f.label && f.expectedAnswer);
        options = { fields: normalized };
        correctAnswer = normalized.reduce<Record<string, string>>((acc, f) => ({ ...acc, [f.label]: f.expectedAnswer }), {});
        break;
      }
      case "ESSAY":
        options = { rubric: essayRubric, maxWordCount: essayMaxWords };
        break;
    }

    return {
      questionText: form.questionText,
      questionType: form.questionType,
      options,
      correctAnswer,
      explanation: form.explanation,
      marks: form.marks,
      ...(form.difficultyLevel ? { difficultyLevel: form.difficultyLevel } : {}),
    };
  };

  // Build preview data
  const previewPayload = buildPayload();

  const validate = (): string | null => {
    if (form.questionText.trim().length < 5) return "Question text must be at least 5 characters.";
    if (!Number.isFinite(form.marks) || form.marks < 1) return "Marks must be at least 1.";
    if (form.questionType === "MCQ") {
      const usable = mcqOptions.filter((o) => o.text.trim().length > 0);
      if (usable.length < 2) return "MCQ requires at least two non-empty options.";
      const selected = mcqOptions.find((o) => o.label === mcqCorrect);
      if (!selected || !selected.text.trim()) return "Select a valid correct option.";
    }
    if (form.questionType === "TRUE_FALSE" && trueFalseAnswer === null) return "Select true or false.";
    if (form.questionType === "NUMERIC") {
      if (String(numericValue).trim() === "" || !Number.isFinite(Number(numericValue))) return "Enter a valid numeric answer.";
      if (!Number.isFinite(Number(numericTolerance)) || Number(numericTolerance) < 0) return "Tolerance cannot be negative.";
    }
    if (form.questionType === "FILL_IN_THE_BLANK" && fillAnswers.filter((a) => a.trim()).length < 1) return "Add at least one accepted answer.";
    if (form.questionType === "TWO_PART_ANALYSIS") {
      if (twoPartOptions.filter((o) => o.trim()).length < 2) return "Need at least two shared options.";
      if (!twoPartA || !twoPartB) return "Select both Part A and Part B correct answers.";
    }
    if (form.questionType === "MULTI_INPUT_REASONING" && multiFields.filter((f) => f.label.trim() && f.expectedAnswer.trim()).length < 1) return "Add at least one complete input field.";
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setValidationError(err); return; }
    setValidationError(null);

    const payload = buildPayload();

    let url: string;
    let method: string;

    if (isEditMode && questionId) {
      url = context === "question-bank"
        ? `/api/question-bank/${questionId}`
        : `/api/assessment-pool/${poolId}/questions/${questionId}`;
      method = "PATCH";
    } else {
      url = context === "question-bank"
        ? "/api/question-bank"
        : `/api/assessment-pool/${poolId}/questions`;
      method = "POST";
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(context === "question-bank" ? payload : { ...payload, assessmentPoolId: poolId }),
      });
      if (!res.ok) {
        const errData = (await res.json()) as { error?: string };
        throw new Error(errData.error || "Failed to save question.");
      }
      toast.success(isEditMode ? "Question updated." : "Question created.");
      router.push(backHref);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save question.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading question…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-var(--dashboard-header-height,64px))] flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(backHref)}
            className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            ← {backLabel ?? "Back"}
          </button>
          <div className="h-4 w-px bg-border" />
          <h2 className="text-sm font-bold">{isEditMode ? "Edit Question" : "New Question"}</h2>
          <Badge variant="info" className="text-[10px]">
            {context === "question-bank" ? "Question Bank" : "Assessment Pool"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => router.push(backHref)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" size="sm" form="question-editor-form" disabled={isSubmitting || !form.questionText.trim()}>
            {isSubmitting ? "Saving…" : isEditMode ? "Save Changes" : "Create Question"}
          </Button>
        </div>
      </div>

      {/* Split layout: editor + preview */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Editor form */}
        <div className="flex-1 overflow-y-auto border-r">
          <form id="question-editor-form" onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6 p-6">

            {validationError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {validationError}
              </div>
            )}

            {/* Question type selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Question Type</label>
              <div className="flex flex-wrap gap-1.5">
                {QUESTION_TYPE_OPTIONS.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    className={`rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                      form.questionType === type.value
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    }`}
                    onClick={() => {
                      setValidationError(null);
                      setForm((prev) => ({ ...prev, questionType: type.value }));
                    }}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Question text */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">Question Text</label>
              <textarea
                className="w-full rounded-lg border bg-background px-4 py-3 text-sm min-h-[140px] resize-y placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder={
                  form.questionType === "FILL_IN_THE_BLANK"
                    ? "Use ____ for blanks. e.g., The capital of Germany is ____."
                    : form.questionType === "TRUE_FALSE"
                      ? "Enter a clear statement learners must judge as true or false."
                      : form.questionType === "TWO_PART_ANALYSIS"
                        ? "Provide the scenario or passage for two-part analysis…"
                        : form.questionType === "MULTI_INPUT_REASONING"
                          ? "Provide the passage or scenario that requires multiple inputs…"
                          : "Enter the question text…"
                }
                value={form.questionText}
                onChange={(e) => setForm((prev) => ({ ...prev, questionText: e.target.value }))}
              />
            </div>

            {/* Type-specific editor */}
            <div className="rounded-lg border bg-muted/10 p-5">
              {form.questionType === "MCQ" && (
                <McqEditor
                  options={mcqOptions}
                  correctAnswer={mcqCorrect}
                  onChange={(opts, correct) => { setMcqOptions(opts); setMcqCorrect(correct); }}
                />
              )}
              {form.questionType === "TRUE_FALSE" && (
                <TrueFalseEditor value={trueFalseAnswer} onChange={setTrueFalseAnswer} />
              )}
              {form.questionType === "NUMERIC" && (
                <NumericEditor
                  value={numericValue}
                  tolerance={numericTolerance}
                  onChange={(v, t) => { setNumericValue(v); setNumericTolerance(t); }}
                />
              )}
              {form.questionType === "FILL_IN_THE_BLANK" && (
                <FillBlankEditor answers={fillAnswers} onChange={setFillAnswers} />
              )}
              {form.questionType === "TWO_PART_ANALYSIS" && (
                <TwoPartEditor
                  options={twoPartOptions}
                  correctPartA={twoPartA}
                  correctPartB={twoPartB}
                  onChange={(opts, a, b) => { setTwoPartOptions(opts); setTwoPartA(a); setTwoPartB(b); }}
                />
              )}
              {form.questionType === "MULTI_INPUT_REASONING" && (
                <MultiInputEditor fields={multiFields} onChange={setMultiFields} />
              )}
              {form.questionType === "ESSAY" && (
                <EssayEditor
                  rubric={essayRubric}
                  maxWordCount={essayMaxWords}
                  onChange={(r, w) => { setEssayRubric(r); setEssayMaxWords(w); }}
                />
              )}
            </div>

            {/* Metadata row */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Marks</label>
                <Input
                  type="number"
                  min={1}
                  value={form.marks}
                  onChange={(e) => setForm((prev) => ({ ...prev, marks: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Difficulty</label>
                <select
                  value={form.difficultyLevel}
                  onChange={(e) => setForm((prev) => ({ ...prev, difficultyLevel: e.target.value }))}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Inherit from pool</option>
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Explanation</label>
                <Input
                  placeholder="Why this answer is correct"
                  value={form.explanation}
                  onChange={(e) => setForm((prev) => ({ ...prev, explanation: e.target.value }))}
                />
              </div>
            </div>
          </form>
        </div>

        {/* Right: Live Preview */}
        <div className="hidden w-[420px] shrink-0 bg-muted/20 lg:block">
          <QuestionPreview
            questionText={previewPayload.questionText}
            questionType={previewPayload.questionType}
            options={previewPayload.options}
            correctAnswer={previewPayload.correctAnswer}
            explanation={previewPayload.explanation}
            marks={previewPayload.marks}
            difficultyLevel={form.difficultyLevel || null}
          />
        </div>
      </div>
    </div>
  );
}
