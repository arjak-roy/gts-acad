"use client";

import { Badge } from "@/components/ui/badge";
import { QUESTION_TYPE_LABELS } from "@/lib/question-types";

type PreviewProps = {
  questionText: string;
  questionType: string;
  options: unknown;
  correctAnswer: unknown;
  explanation: string;
  marks: number;
  difficultyLevel?: string | null;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function McqPreview({ options, correctAnswer }: { options: unknown; correctAnswer: unknown }) {
  if (!Array.isArray(options) || options.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No options defined yet.</p>;
  }
  return (
    <div className="space-y-2">
      {options.map((opt: unknown) => {
        if (!isRecord(opt)) return null;
        const label = String(opt.label ?? "");
        const text = String(opt.text ?? "");
        const isCorrect = correctAnswer === label;
        return (
          <div
            key={label}
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
              isCorrect
                ? "border-emerald-300 bg-emerald-50/70"
                : "border-border bg-background hover:bg-muted/30"
            }`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                isCorrect
                  ? "border-emerald-500 bg-emerald-100 text-emerald-700"
                  : "border-muted-foreground/30 text-muted-foreground"
              }`}
            >
              {label}
            </span>
            <span className={`text-sm ${isCorrect ? "font-medium text-emerald-800" : "text-foreground"}`}>
              {text || <span className="italic text-muted-foreground">Empty option</span>}
            </span>
            {isCorrect && (
              <Badge variant="success" className="ml-auto text-[10px]">Correct</Badge>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TrueFalsePreview({ correctAnswer }: { correctAnswer: unknown }) {
  const answer = typeof correctAnswer === "boolean" ? correctAnswer : null;
  return (
    <div className="grid grid-cols-2 gap-3">
      {[true, false].map((val) => {
        const isCorrect = answer === val;
        return (
          <div
            key={String(val)}
            className={`rounded-xl border-2 px-5 py-4 text-center ${
              isCorrect
                ? "border-emerald-400 bg-emerald-50"
                : "border-border bg-background"
            }`}
          >
            <span className={`text-base font-bold ${isCorrect ? "text-emerald-700" : "text-foreground"}`}>
              {val ? "True" : "False"}
            </span>
            {isCorrect && <Badge variant="success" className="mt-2 text-[10px]">Correct</Badge>}
          </div>
        );
      })}
    </div>
  );
}

function NumericPreview({ correctAnswer }: { correctAnswer: unknown }) {
  if (!isRecord(correctAnswer)) {
    return <p className="text-xs text-muted-foreground italic">No answer defined yet.</p>;
  }
  const value = Number(correctAnswer.value ?? 0);
  const tolerance = Number(correctAnswer.tolerance ?? 0);
  return (
    <div className="rounded-lg border bg-muted/30 px-5 py-4">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-foreground">{value}</span>
        {tolerance > 0 && (
          <span className="text-sm text-muted-foreground">± {tolerance}</span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Accepted range: {value - tolerance} to {value + tolerance}
      </p>
    </div>
  );
}

function FillBlankPreview({ correctAnswer }: { correctAnswer: unknown }) {
  if (!Array.isArray(correctAnswer) || correctAnswer.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No accepted answers defined yet.</p>;
  }
  return (
    <div className="space-y-2">
      <div className="rounded-lg border bg-muted/30 px-4 py-3">
        <div className="flex h-10 items-center rounded-md border-2 border-dashed border-primary/30 bg-background px-3">
          <span className="text-sm text-muted-foreground">Learner types answer here…</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Accepted:</span>
        {correctAnswer.map((ans: unknown, i: number) => (
          <Badge key={i} variant="default" className="text-xs">{String(ans)}</Badge>
        ))}
      </div>
    </div>
  );
}

function TwoPartPreview({ options, correctAnswer }: { options: unknown; correctAnswer: unknown }) {
  const opts = Array.isArray(options) ? options.filter((o): o is string => typeof o === "string") : [];
  const answer = isRecord(correctAnswer) ? correctAnswer : { partA: "", partB: "" };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-muted/30 p-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Part A</span>
          <p className="mt-1 text-sm font-medium">{String(answer.partA || "Not selected")}</p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Part B</span>
          <p className="mt-1 text-sm font-medium">{String(answer.partB || "Not selected")}</p>
        </div>
      </div>
      {opts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Options:</span>
          {opts.map((opt, i) => (
            <Badge
              key={i}
              variant={opt === answer.partA || opt === answer.partB ? "success" : "default"}
              className="text-xs"
            >
              {opt}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function MultiInputPreview({ options, correctAnswer }: { options: unknown; correctAnswer: unknown }) {
  const fields = isRecord(options) && Array.isArray(options.fields) ? options.fields : [];
  const answers = isRecord(correctAnswer) ? correctAnswer : {};

  if (fields.length === 0 && Object.keys(answers).length === 0) {
    return <p className="text-xs text-muted-foreground italic">No input fields defined yet.</p>;
  }

  const displayFields = fields.length > 0
    ? fields.map((f: unknown) => {
        if (!isRecord(f)) return null;
        return { label: String(f.label ?? ""), expected: String(f.expectedAnswer ?? "") };
      }).filter(Boolean) as { label: string; expected: string }[]
    : Object.entries(answers).map(([label, expected]) => ({ label, expected: String(expected) }));

  return (
    <div className="rounded-lg border overflow-hidden">
      {displayFields.map((field, i) => (
        <div key={i} className="flex items-center gap-3 border-b last:border-b-0 px-4 py-3">
          <span className="text-sm font-medium text-foreground min-w-[100px]">{field.label || "Unnamed"}</span>
          <div className="flex-1 rounded-md border bg-muted/30 px-3 py-1.5 text-sm text-muted-foreground">
            {field.expected || "…"}
          </div>
        </div>
      ))}
    </div>
  );
}

function EssayPreview() {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-muted/20 p-4">
        <div className="h-32 rounded-md border-2 border-dashed border-muted-foreground/20 bg-background p-3">
          <span className="text-sm text-muted-foreground">Learner writes their essay response here…</span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-amber-600">
        <span>✍️</span>
        <span>Requires manual grading by a trainer.</span>
      </div>
    </div>
  );
}

export function QuestionPreview({ questionText, questionType, options, correctAnswer, explanation, marks, difficultyLevel }: PreviewProps) {
  const typeLabel = QUESTION_TYPE_LABELS[questionType as keyof typeof QUESTION_TYPE_LABELS] ?? questionType;
  const difficultyColors: Record<string, string> = {
    EASY: "bg-emerald-100 text-emerald-700",
    MEDIUM: "bg-amber-100 text-amber-700",
    HARD: "bg-red-100 text-red-700",
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-5 py-3">
        <h3 className="text-sm font-bold text-foreground">Live Preview</h3>
        <div className="flex items-center gap-2">
          <Badge variant="default" className="text-[10px]">{typeLabel}</Badge>
          {difficultyLevel && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${difficultyColors[difficultyLevel] ?? "bg-muted text-muted-foreground"}`}>
              {difficultyLevel}
            </span>
          )}
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            {marks} {marks === 1 ? "mark" : "marks"}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="space-y-5">
          {/* Question text */}
          <div className="rounded-lg bg-muted/40 p-4">
            {questionText.trim() ? (
              <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{questionText}</p>
            ) : (
              <p className="text-sm italic text-muted-foreground">Start typing to see your question here…</p>
            )}
          </div>

          {/* Type-specific answer preview */}
          {questionType === "MCQ" && <McqPreview options={options} correctAnswer={correctAnswer} />}
          {questionType === "TRUE_FALSE" && <TrueFalsePreview correctAnswer={correctAnswer} />}
          {questionType === "NUMERIC" && <NumericPreview correctAnswer={correctAnswer} />}
          {questionType === "FILL_IN_THE_BLANK" && <FillBlankPreview correctAnswer={correctAnswer} />}
          {questionType === "TWO_PART_ANALYSIS" && <TwoPartPreview options={options} correctAnswer={correctAnswer} />}
          {questionType === "MULTI_INPUT_REASONING" && <MultiInputPreview options={options} correctAnswer={correctAnswer} />}
          {questionType === "ESSAY" && <EssayPreview />}

          {/* Explanation */}
          {explanation.trim() && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Explanation</span>
              <p className="mt-1 text-xs leading-relaxed text-blue-800">{explanation}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
