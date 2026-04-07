"use client";

import { FormEvent, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type QuestionForm = {
  questionText: string;
  questionType: string;
  options: unknown;
  correctAnswer: unknown;
  explanation: string;
  marks: number;
};

const QUESTION_TYPES = [
  { value: "MCQ", label: "MCQ" },
  { value: "NUMERIC", label: "Numeric" },
  { value: "ESSAY", label: "Essay" },
  { value: "FILL_IN_THE_BLANK", label: "Fill in Blank" },
  { value: "MULTI_INPUT_REASONING", label: "Multi-Input" },
  { value: "TWO_PART_ANALYSIS", label: "Two-Part" },
];

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
  onQuestionAdded,
}: {
  poolId: string;
  defaultType: string;
  onQuestionAdded: () => void;
}) {
  const [form, setForm] = useState<QuestionForm>({
    questionText: "",
    questionType: defaultType || "MCQ",
    options: null,
    correctAnswer: null,
    explanation: "",
    marks: 1,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Type-specific state
  const [mcqOptions, setMcqOptions] = useState<{ label: string; text: string }[]>([
    { label: "A", text: "" }, { label: "B", text: "" }, { label: "C", text: "" }, { label: "D", text: "" },
  ]);
  const [mcqCorrect, setMcqCorrect] = useState("");
  const [numericValue, setNumericValue] = useState<number | string>("");
  const [numericTolerance, setNumericTolerance] = useState<number | string>(0);
  const [fillAnswers, setFillAnswers] = useState<string[]>([""]);
  const [twoPartOptions, setTwoPartOptions] = useState<string[]>(["", "", "", ""]);
  const [twoPartA, setTwoPartA] = useState("");
  const [twoPartB, setTwoPartB] = useState("");
  const [multiFields, setMultiFields] = useState<{ label: string; expectedAnswer: string }[]>([{ label: "", expectedAnswer: "" }]);

  const buildPayload = () => {
    let options: unknown = null;
    let correctAnswer: unknown = null;

    switch (form.questionType) {
      case "MCQ":
        options = mcqOptions;
        correctAnswer = mcqCorrect;
        break;
      case "NUMERIC":
        correctAnswer = { value: Number(numericValue), tolerance: Number(numericTolerance) };
        break;
      case "FILL_IN_THE_BLANK":
        correctAnswer = fillAnswers.filter(Boolean);
        break;
      case "TWO_PART_ANALYSIS":
        options = twoPartOptions.filter(Boolean);
        correctAnswer = { partA: twoPartA, partB: twoPartB };
        break;
      case "MULTI_INPUT_REASONING":
        options = { fields: multiFields };
        correctAnswer = multiFields.reduce((acc, f) => ({ ...acc, [f.label]: f.expectedAnswer }), {});
        break;
      case "ESSAY":
        options = { rubric: "", maxWordCount: 500 };
        break;
    }

    return { options, correctAnswer };
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.questionText.trim()) return;

    const { options, correctAnswer } = buildPayload();

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/assessment-pool/${poolId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionText: form.questionText,
          questionType: form.questionType,
          options,
          correctAnswer,
          explanation: form.explanation,
          marks: form.marks,
        }),
      });

      if (!response.ok) {
        const errData = (await response.json()) as { error?: string };
        throw new Error(errData.error || "Failed to add question.");
      }

      toast.success("Question added.");
      setForm((prev) => ({ ...prev, questionText: "", explanation: "" }));
      onQuestionAdded();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add question.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Add Question</h4>
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
              onClick={() => setForm((prev) => ({ ...prev, questionType: type.value }))}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

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
        <Button type="submit" size="sm" disabled={isSubmitting || !form.questionText.trim()}>
          {isSubmitting ? "Adding…" : "Add Question"}
        </Button>
      </div>
    </form>
  );
}
