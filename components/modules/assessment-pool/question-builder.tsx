"use client";

import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type QuestionForm = {
  questionText: string;
  questionType: string;
  explanation: string;
  marks: number;
};

type EditableQuestion = {
  id: string;
  questionText: string;
  questionType: string;
  options: unknown;
  correctAnswer: unknown;
  explanation: string | null;
  marks: number;
  sortOrder?: number;
};

type QuestionBuilderPayload = {
  questionText: string;
  questionType: string;
  options: unknown;
  correctAnswer: unknown;
  explanation: string;
  marks: number;
};

type QuestionBuilderContext = "assessment" | "question-bank";

const QUESTION_TYPES = [
  { value: "MCQ", label: "MCQ" },
  { value: "NUMERIC", label: "Numeric" },
  { value: "ESSAY", label: "Essay" },
  { value: "FILL_IN_THE_BLANK", label: "Fill in Blank" },
  { value: "MULTI_INPUT_REASONING", label: "Multi-Input" },
  { value: "TWO_PART_ANALYSIS", label: "Two-Part" },
];

const DEFAULT_MCQ_OPTIONS = [
  { label: "A", text: "" },
  { label: "B", text: "" },
  { label: "C", text: "" },
  { label: "D", text: "" },
];

const DEFAULT_TWO_PART_OPTIONS = ["", "", "", ""];

const DEFAULT_MULTI_FIELDS = [{ label: "", expectedAnswer: "" }];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function cloneMcqOptions(options: { label: string; text: string }[]) {
  return options.map((option) => ({ ...option }));
}

function getInitialQuestionType(defaultType: string, question?: EditableQuestion | null) {
  return question?.questionType || defaultType || "MCQ";
}

function buildInitialForm(defaultType: string, question?: EditableQuestion | null): QuestionForm {
  return {
    questionText: question?.questionText ?? "",
    questionType: getInitialQuestionType(defaultType, question),
    explanation: question?.explanation ?? "",
    marks: question?.marks ?? 1,
  };
}

function getInitialMcqOptions(options: unknown) {
  if (!Array.isArray(options)) {
    return cloneMcqOptions(DEFAULT_MCQ_OPTIONS);
  }

  const normalized = options
    .map((option, index) => {
      if (!isRecord(option)) {
        return null;
      }

      const label = typeof option.label === "string" && option.label.trim().length > 0
        ? option.label
        : String.fromCharCode(65 + index);
      const text = typeof option.text === "string" ? option.text : "";

      return { label, text };
    })
    .filter((option): option is { label: string; text: string } => Boolean(option));

  return normalized.length > 0 ? normalized : cloneMcqOptions(DEFAULT_MCQ_OPTIONS);
}

function getInitialMcqCorrectAnswer(
  correctAnswer: unknown,
  options: { label: string; text: string }[],
) {
  if (typeof correctAnswer !== "string") {
    return "";
  }

  if (options.some((option) => option.label === correctAnswer)) {
    return correctAnswer;
  }

  const matchingOption = options.find((option) => option.text === correctAnswer);
  return matchingOption?.label ?? "";
}

function getInitialNumericAnswer(correctAnswer: unknown) {
  if (!isRecord(correctAnswer)) {
    return { value: "", tolerance: 0 };
  }

  const value = typeof correctAnswer.value === "number" || typeof correctAnswer.value === "string"
    ? correctAnswer.value
    : "";
  const tolerance = typeof correctAnswer.tolerance === "number" || typeof correctAnswer.tolerance === "string"
    ? correctAnswer.tolerance
    : 0;

  return { value, tolerance };
}

function getInitialFillAnswers(correctAnswer: unknown) {
  if (!Array.isArray(correctAnswer)) {
    return [""];
  }

  const answers = correctAnswer.filter((answer): answer is string => typeof answer === "string");
  return answers.length > 0 ? answers : [""];
}

function getInitialTwoPartOptions(options: unknown) {
  if (!Array.isArray(options)) {
    return [...DEFAULT_TWO_PART_OPTIONS];
  }

  const normalized = options.filter((option): option is string => typeof option === "string");
  return normalized.length > 0 ? normalized : [...DEFAULT_TWO_PART_OPTIONS];
}

function getInitialTwoPartAnswer(correctAnswer: unknown) {
  if (!isRecord(correctAnswer)) {
    return { partA: "", partB: "" };
  }

  return {
    partA: typeof correctAnswer.partA === "string" ? correctAnswer.partA : "",
    partB: typeof correctAnswer.partB === "string" ? correctAnswer.partB : "",
  };
}

function getInitialMultiFields(options: unknown, correctAnswer: unknown) {
  if (isRecord(options) && Array.isArray(options.fields)) {
    const normalized = options.fields
      .map((field) => {
        if (!isRecord(field)) {
          return null;
        }

        return {
          label: typeof field.label === "string" ? field.label : "",
          expectedAnswer: typeof field.expectedAnswer === "string" ? field.expectedAnswer : "",
        };
      })
      .filter((field): field is { label: string; expectedAnswer: string } => Boolean(field));

    if (normalized.length > 0) {
      return normalized;
    }
  }

  if (isRecord(correctAnswer)) {
    const normalized = Object.entries(correctAnswer)
      .filter(([, value]) => typeof value === "string")
      .map(([label, expectedAnswer]) => ({ label, expectedAnswer: expectedAnswer as string }));

    if (normalized.length > 0) {
      return normalized;
    }
  }

  return [...DEFAULT_MULTI_FIELDS];
}

function McqOptions({
  options,
  correctAnswer,
  onChange,
}: {
  options: { label: string; text: string }[];
  correctAnswer: string;
  onChange: (opts: { label: string; text: string }[], correct: string) => void;
}) {
  const defaultOptions = options.length > 0 ? options : [
    { label: "A", text: "" },
    { label: "B", text: "" },
    { label: "C", text: "" },
    { label: "D", text: "" },
  ];

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Options</label>
      {defaultOptions.map((opt, i) => (
        <div key={opt.label} className="flex items-center gap-2">
          <button
            type="button"
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors ${
              correctAnswer === opt.label
                ? "border-green-500 bg-green-50 text-green-700"
                : "border-border hover:border-primary/50"
            }`}
            onClick={() => onChange(defaultOptions, opt.label)}
            title="Mark as correct"
          >
            {opt.label}
          </button>
          <Input
            placeholder={`Option ${opt.label}`}
            value={opt.text}
            onChange={(e) => {
              const updated = [...defaultOptions];
              updated[i] = { ...updated[i], text: e.target.value };
              onChange(updated, correctAnswer);
            }}
            className="text-sm"
          />
        </div>
      ))}
      <p className="text-xs text-muted-foreground">Click a letter to mark it as the correct answer.</p>
    </div>
  );
}

function NumericAnswer({
  value,
  tolerance,
  onChange,
}: {
  value: number | string;
  tolerance: number | string;
  onChange: (value: number, tolerance: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <label className="text-xs font-medium">Correct Value</label>
        <Input
          type="number"
          step="any"
          placeholder="e.g., 42"
          value={value}
          onChange={(e) => onChange(Number(e.target.value), Number(tolerance) || 0)}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium">Tolerance (±)</label>
        <Input
          type="number"
          step="any"
          min={0}
          placeholder="0"
          value={tolerance}
          onChange={(e) => onChange(Number(value) || 0, Number(e.target.value))}
        />
      </div>
    </div>
  );
}

function FillBlankAnswer({
  answers,
  onChange,
}: {
  answers: string[];
  onChange: (answers: string[]) => void;
}) {
  const current = answers.length > 0 ? answers : [""];
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Accepted Answers</label>
      {current.map((ans, i) => (
        <div key={i} className="flex gap-2">
          <Input
            placeholder={`Answer ${i + 1}`}
            value={ans}
            onChange={(e) => {
              const updated = [...current];
              updated[i] = e.target.value;
              onChange(updated);
            }}
            className="text-sm"
          />
          {current.length > 1 && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onChange(current.filter((_, j) => j !== i))}
            >
              ×
            </Button>
          )}
        </div>
      ))}
      <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...current, ""])}>
        + Add alternative answer
      </Button>
      <p className="text-xs text-muted-foreground">Use ____ in the question text to indicate blank positions.</p>
    </div>
  );
}

function TwoPartOptions({
  options,
  correctPartA,
  correctPartB,
  onChange,
}: {
  options: string[];
  correctPartA: string;
  correctPartB: string;
  onChange: (opts: string[], partA: string, partB: string) => void;
}) {
  const current = options.length > 0 ? options : ["", "", "", ""];
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label className="text-sm font-medium">Shared Options</label>
        {current.map((opt, i) => (
          <div key={i} className="flex gap-2">
            <Input
              placeholder={`Option ${i + 1}`}
              value={opt}
              onChange={(e) => {
                const updated = [...current];
                updated[i] = e.target.value;
                onChange(updated, correctPartA, correctPartB);
              }}
              className="text-sm"
            />
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onChange([...current, ""], correctPartA, correctPartB)}
        >
          + Add option
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium">Part A Correct</label>
          <select
            value={correctPartA}
            onChange={(e) => onChange(current, e.target.value, correctPartB)}
            className="w-full rounded-md border px-2 py-1.5 text-sm"
          >
            <option value="">Select…</option>
            {current.filter(Boolean).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Part B Correct</label>
          <select
            value={correctPartB}
            onChange={(e) => onChange(current, correctPartA, e.target.value)}
            className="w-full rounded-md border px-2 py-1.5 text-sm"
          >
            <option value="">Select…</option>
            {current.filter(Boolean).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

function MultiInputFields({
  fields,
  onChange,
}: {
  fields: { label: string; expectedAnswer: string }[];
  onChange: (fields: { label: string; expectedAnswer: string }[]) => void;
}) {
  const current = fields.length > 0 ? fields : [{ label: "", expectedAnswer: "" }];
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Input Fields</label>
      {current.map((field, i) => (
        <div key={i} className="grid grid-cols-2 gap-2">
          <Input
            placeholder="Field label"
            value={field.label}
            onChange={(e) => {
              const updated = [...current];
              updated[i] = { ...updated[i], label: e.target.value };
              onChange(updated);
            }}
            className="text-sm"
          />
          <Input
            placeholder="Expected answer"
            value={field.expectedAnswer}
            onChange={(e) => {
              const updated = [...current];
              updated[i] = { ...updated[i], expectedAnswer: e.target.value };
              onChange(updated);
            }}
            className="text-sm"
          />
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => onChange([...current, { label: "", expectedAnswer: "" }])}
      >
        + Add field
      </Button>
    </div>
  );
}

export function QuestionBuilder({
  poolId,
  defaultType,
  questionCount,
  mode = "create",
  initialQuestion = null,
  context = "assessment",
  createEndpoint,
  getUpdateEndpoint,
  requestTransform,
  onSaved,
  onCancel,
}: {
  poolId?: string;
  defaultType: string;
  questionCount?: number;
  mode?: "create" | "edit";
  initialQuestion?: EditableQuestion | null;
  context?: QuestionBuilderContext;
  createEndpoint?: string;
  getUpdateEndpoint?: (questionId: string) => string;
  requestTransform?: (payload: QuestionBuilderPayload) => Record<string, unknown>;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState<QuestionForm>(() => buildInitialForm(defaultType, initialQuestion));
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Type-specific state
  const [mcqOptions, setMcqOptions] = useState<{ label: string; text: string }[]>(() => getInitialMcqOptions(initialQuestion?.options));
  const [mcqCorrect, setMcqCorrect] = useState(() => getInitialMcqCorrectAnswer(initialQuestion?.correctAnswer, getInitialMcqOptions(initialQuestion?.options)));
  const [numericValue, setNumericValue] = useState<number | string>(() => getInitialNumericAnswer(initialQuestion?.correctAnswer).value);
  const [numericTolerance, setNumericTolerance] = useState<number | string>(() => getInitialNumericAnswer(initialQuestion?.correctAnswer).tolerance);
  const [fillAnswers, setFillAnswers] = useState<string[]>(() => getInitialFillAnswers(initialQuestion?.correctAnswer));
  const [twoPartOptions, setTwoPartOptions] = useState<string[]>(() => getInitialTwoPartOptions(initialQuestion?.options));
  const [twoPartA, setTwoPartA] = useState(() => getInitialTwoPartAnswer(initialQuestion?.correctAnswer).partA);
  const [twoPartB, setTwoPartB] = useState(() => getInitialTwoPartAnswer(initialQuestion?.correctAnswer).partB);
  const [multiFields, setMultiFields] = useState<{ label: string; expectedAnswer: string }[]>(() => getInitialMultiFields(initialQuestion?.options, initialQuestion?.correctAnswer));
  const [validationError, setValidationError] = useState<string | null>(null);

  const isEditMode = mode === "edit" && Boolean(initialQuestion?.id);
  const createUrl = createEndpoint ?? (poolId ? `/api/assessment-pool/${poolId}/questions` : "");
  const updateUrl = initialQuestion?.id
    ? (getUpdateEndpoint?.(initialQuestion.id) ?? (poolId ? `/api/assessment-pool/${poolId}/questions/${initialQuestion.id}` : ""))
    : "";
  const createTitle = context === "question-bank" ? "Add Bank Question" : "Add Question";
  const editTitle = context === "question-bank" ? "Edit Bank Question" : "Edit Question";
  const addButtonLabel = context === "question-bank" ? "Save to Bank" : "Add Question";
  const savingButtonLabel = context === "question-bank" ? "Saving..." : "Adding...";
  const successCreateMessage = context === "question-bank" ? "Question saved to bank." : "Question added.";
  const successUpdateMessage = context === "question-bank" ? "Bank question updated." : "Question updated.";
  const errorCreateMessage = context === "question-bank" ? "Failed to save question to bank." : "Failed to add question.";
  const errorUpdateMessage = context === "question-bank" ? "Failed to update bank question." : "Failed to update question.";
  const createHint = context === "question-bank"
    ? questionCount && questionCount > 0
      ? `${questionCount} reusable question${questionCount === 1 ? "" : "s"} already in the bank.`
      : "Add your first reusable question to start the bank."
    : questionCount && questionCount > 0
      ? `${questionCount} question${questionCount === 1 ? "" : "s"} already in this assessment.`
      : "Add your first question to unlock publishing.";
  const createBadgeLabel = context === "question-bank"
    ? questionCount && questionCount > 0
      ? "Reusable"
      : "Start Bank"
    : questionCount && questionCount > 0
      ? "Publish Ready"
      : "Needs Questions";
  const createBadgeVariant = context === "question-bank"
    ? questionCount && questionCount > 0
      ? "info"
      : "warning"
    : questionCount && questionCount > 0
      ? "success"
      : "warning";

  useEffect(() => {
    if (mode === "edit" && initialQuestion) {
      const nextMcqOptions = getInitialMcqOptions(initialQuestion.options);
      const nextNumeric = getInitialNumericAnswer(initialQuestion.correctAnswer);
      const nextTwoPartAnswer = getInitialTwoPartAnswer(initialQuestion.correctAnswer);

      setForm(buildInitialForm(defaultType, initialQuestion));
      setMcqOptions(nextMcqOptions);
      setMcqCorrect(getInitialMcqCorrectAnswer(initialQuestion.correctAnswer, nextMcqOptions));
      setNumericValue(nextNumeric.value);
      setNumericTolerance(nextNumeric.tolerance);
      setFillAnswers(getInitialFillAnswers(initialQuestion.correctAnswer));
      setTwoPartOptions(getInitialTwoPartOptions(initialQuestion.options));
      setTwoPartA(nextTwoPartAnswer.partA);
      setTwoPartB(nextTwoPartAnswer.partB);
      setMultiFields(getInitialMultiFields(initialQuestion.options, initialQuestion.correctAnswer));
      setValidationError(null);
      return;
    }

    setForm(buildInitialForm(defaultType));
    setMcqOptions(cloneMcqOptions(DEFAULT_MCQ_OPTIONS));
    setMcqCorrect("");
    setNumericValue("");
    setNumericTolerance(0);
    setFillAnswers([""]);
    setTwoPartOptions([...DEFAULT_TWO_PART_OPTIONS]);
    setTwoPartA("");
    setTwoPartB("");
    setMultiFields([...DEFAULT_MULTI_FIELDS]);
    setValidationError(null);
  }, [defaultType, initialQuestion?.id, mode]);

  const buildPayload = () => {
    let options: unknown = null;
    let correctAnswer: unknown = null;

    switch (form.questionType) {
      case "MCQ": {
        const normalizedOptions = mcqOptions.map((option) => ({
          label: option.label,
          text: option.text.trim(),
        }));
        options = normalizedOptions.filter((option) => option.text.length > 0);
        correctAnswer = mcqCorrect;
        break;
      }
      case "NUMERIC":
        correctAnswer = { value: Number(numericValue), tolerance: Number(numericTolerance) };
        break;
      case "FILL_IN_THE_BLANK":
        correctAnswer = fillAnswers.map((answer) => answer.trim()).filter(Boolean);
        break;
      case "TWO_PART_ANALYSIS":
        options = twoPartOptions.map((option) => option.trim()).filter(Boolean);
        correctAnswer = { partA: twoPartA.trim(), partB: twoPartB.trim() };
        break;
      case "MULTI_INPUT_REASONING": {
        const normalizedFields = multiFields
          .map((field) => ({
            label: field.label.trim(),
            expectedAnswer: field.expectedAnswer.trim(),
          }))
          .filter((field) => field.label.length > 0 && field.expectedAnswer.length > 0);
        options = { fields: normalizedFields };
        correctAnswer = normalizedFields.reduce<Record<string, string>>((acc, field) => ({
          ...acc,
          [field.label]: field.expectedAnswer,
        }), {});
        break;
      }
      case "ESSAY":
        options = { rubric: "", maxWordCount: 500 };
        break;
    }

    return { options, correctAnswer };
  };

  const validateQuestionBeforeSubmit = (): string | null => {
    if (form.questionText.trim().length < 5) {
      return "Question text must be at least 5 characters.";
    }

    if (!Number.isFinite(form.marks) || form.marks < 1) {
      return "Marks must be at least 1.";
    }

    if (form.questionType === "MCQ") {
      const usableOptions = mcqOptions.filter((option) => option.text.trim().length > 0);
      if (usableOptions.length < 2) {
        return "MCQ requires at least two non-empty options.";
      }

      const selectedOption = mcqOptions.find((option) => option.label === mcqCorrect);
      if (!selectedOption || selectedOption.text.trim().length === 0) {
        return "Select a valid correct option for this MCQ.";
      }
    }

    if (form.questionType === "NUMERIC") {
      if (String(numericValue).trim().length === 0) {
        return "Enter a valid numeric answer.";
      }

      const parsedValue = Number(numericValue);
      const parsedTolerance = Number(numericTolerance);
      if (!Number.isFinite(parsedValue)) {
        return "Enter a valid numeric answer.";
      }

      if (!Number.isFinite(parsedTolerance) || parsedTolerance < 0) {
        return "Numeric tolerance cannot be negative.";
      }
    }

    if (form.questionType === "FILL_IN_THE_BLANK") {
      const answers = fillAnswers.map((answer) => answer.trim()).filter(Boolean);
      if (answers.length < 1) {
        return "Add at least one accepted answer for fill-in-the-blank.";
      }
    }

    if (form.questionType === "TWO_PART_ANALYSIS") {
      const options = twoPartOptions.map((option) => option.trim()).filter(Boolean);
      if (options.length < 2) {
        return "Two-part analysis needs at least two shared options.";
      }

      if (!twoPartA || !twoPartB) {
        return "Select both Part A and Part B correct answers.";
      }
    }

    if (form.questionType === "MULTI_INPUT_REASONING") {
      const validFields = multiFields.filter((field) => field.label.trim() && field.expectedAnswer.trim());
      if (validFields.length < 1) {
        return "Add at least one complete input field and expected answer.";
      }
    }

    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const nextValidationError = validateQuestionBeforeSubmit();
    if (nextValidationError) {
      setValidationError(nextValidationError);
      return;
    }

    const { options, correctAnswer } = buildPayload();
    setValidationError(null);

    const payload: QuestionBuilderPayload = {
      questionText: form.questionText,
      questionType: form.questionType,
      options,
      correctAnswer,
      explanation: form.explanation,
      marks: form.marks,
    };

    const body = requestTransform ? requestTransform(payload) : payload;
    const requestUrl = isEditMode ? updateUrl : createUrl;

    if (!requestUrl) {
      toast.error("Question builder endpoint is not configured.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(requestUrl, {
        method: isEditMode ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errData = (await response.json()) as { error?: string };
        throw new Error(errData.error || (isEditMode ? errorUpdateMessage : errorCreateMessage));
      }

      toast.success(isEditMode ? successUpdateMessage : successCreateMessage);

      if (!isEditMode) {
        setForm((prev) => ({
          ...prev,
          questionText: "",
          explanation: "",
          marks: 1,
        }));
        setMcqOptions(cloneMcqOptions(DEFAULT_MCQ_OPTIONS));
        setMcqCorrect("");
        setNumericValue("");
        setNumericTolerance(0);
        setFillAnswers([""]);
        setTwoPartOptions([...DEFAULT_TWO_PART_OPTIONS]);
        setTwoPartA("");
        setTwoPartB("");
        setMultiFields([...DEFAULT_MULTI_FIELDS]);
      }

      setValidationError(null);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (isEditMode ? errorUpdateMessage : errorCreateMessage));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <h4 className="text-sm font-medium">{isEditMode ? editTitle : createTitle}</h4>
          <p className="text-xs text-muted-foreground">
            {isEditMode
              ? "Update the question content, answers, and marks, then save your changes."
              : createHint}
          </p>
        </div>
        <Badge variant={isEditMode ? "info" : createBadgeVariant}>
          {isEditMode ? "Editing" : createBadgeLabel}
        </Badge>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {QUESTION_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              className={`rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                form.questionType === type.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
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

      {validationError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {validationError}
        </div>
      ) : null}

      <div className="space-y-2">
        <label className="text-sm font-medium">Question Text</label>
        <textarea
          className="w-full rounded-md border px-3 py-2 text-sm min-h-[80px] resize-y"
          placeholder={
            form.questionType === "FILL_IN_THE_BLANK"
              ? "Use ____ for blanks. e.g., The capital of Germany is ____."
              : form.questionType === "TWO_PART_ANALYSIS"
                ? "Provide the scenario or passage for analysis…"
                : form.questionType === "MULTI_INPUT_REASONING"
                  ? "Provide the passage or scenario that requires multiple inputs…"
                  : "Enter the question text…"
          }
          value={form.questionText}
          onChange={(e) => setForm((prev) => ({ ...prev, questionText: e.target.value }))}
          required
        />
      </div>

      {/* Type-specific inputs */}
      {form.questionType === "MCQ" && (
        <McqOptions
          options={mcqOptions}
          correctAnswer={mcqCorrect}
          onChange={(opts, correct) => { setMcqOptions(opts); setMcqCorrect(correct); }}
        />
      )}

      {form.questionType === "NUMERIC" && (
        <NumericAnswer
          value={numericValue}
          tolerance={numericTolerance}
          onChange={(v, t) => { setNumericValue(v); setNumericTolerance(t); }}
        />
      )}

      {form.questionType === "FILL_IN_THE_BLANK" && (
        <FillBlankAnswer answers={fillAnswers} onChange={setFillAnswers} />
      )}

      {form.questionType === "TWO_PART_ANALYSIS" && (
        <TwoPartOptions
          options={twoPartOptions}
          correctPartA={twoPartA}
          correctPartB={twoPartB}
          onChange={(opts, a, b) => { setTwoPartOptions(opts); setTwoPartA(a); setTwoPartB(b); }}
        />
      )}

      {form.questionType === "MULTI_INPUT_REASONING" && (
        <MultiInputFields fields={multiFields} onChange={setMultiFields} />
      )}

      {form.questionType === "ESSAY" && (
        <div className="rounded-lg border border-dashed p-4 text-center">
          <p className="text-xs text-muted-foreground">
            Essay questions require manual grading. Add rubric/guidelines in the explanation field.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium">Marks</label>
          <Input
            type="number"
            min={1}
            value={form.marks}
            onChange={(e) => setForm((prev) => ({ ...prev, marks: Number(e.target.value) }))}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Explanation (optional)</label>
          <Input
            placeholder="Why this answer is correct"
            value={form.explanation}
            onChange={(e) => setForm((prev) => ({ ...prev, explanation: e.target.value }))}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <div className="flex items-center gap-2">
          {isEditMode && onCancel ? (
            <Button type="button" size="sm" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
          ) : null}
          <Button type="submit" size="sm" disabled={isSubmitting || !form.questionText.trim()}>
            {isSubmitting ? (isEditMode ? "Saving..." : savingButtonLabel) : (isEditMode ? "Save Changes" : addButtonLabel)}
          </Button>
        </div>
      </div>
    </form>
  );
}
