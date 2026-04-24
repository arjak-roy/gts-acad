"use client";

import { Input } from "@/components/ui/input";

export type McqOption = { label: string; text: string };

export function McqEditor({
  options,
  correctAnswer,
  onChange,
}: {
  options: McqOption[];
  correctAnswer: string;
  onChange: (opts: McqOption[], correct: string) => void;
}) {
  const current = options.length > 0 ? options : DEFAULT_MCQ_OPTIONS;

  return (
    <div className="space-y-3">
      <label className="text-sm font-semibold">Answer Options</label>
      <div className="space-y-2">
        {current.map((opt, i) => (
          <div key={opt.label} className="group flex items-center gap-3">
            <button
              type="button"
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 text-xs font-bold transition-all ${
                correctAnswer === opt.label
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-200"
                  : "border-border bg-muted/50 text-muted-foreground hover:border-primary/40 hover:bg-muted"
              }`}
              onClick={() => onChange(current, opt.label)}
              title="Mark as correct answer"
            >
              {opt.label}
            </button>
            <Input
              placeholder={`Option ${opt.label}`}
              value={opt.text}
              onChange={(e) => {
                const updated = [...current];
                updated[i] = { ...updated[i], text: e.target.value };
                onChange(updated, correctAnswer);
              }}
              className="flex-1"
            />
            {current.length > 2 && (
              <button
                type="button"
                className="hidden shrink-0 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:block"
                onClick={() => {
                  const updated = current.filter((_, j) => j !== i);
                  const nextCorrect = correctAnswer === opt.label ? "" : correctAnswer;
                  onChange(updated, nextCorrect);
                }}
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="rounded-md px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5"
          onClick={() => {
            const nextLabel = String.fromCharCode(65 + current.length);
            onChange([...current, { label: nextLabel, text: "" }], correctAnswer);
          }}
        >
          + Add option
        </button>
        <p className="text-xs text-muted-foreground">
          {correctAnswer ? `Correct: ${correctAnswer}` : "Click a letter to mark correct"}
        </p>
      </div>
    </div>
  );
}

export const DEFAULT_MCQ_OPTIONS: McqOption[] = [
  { label: "A", text: "" },
  { label: "B", text: "" },
  { label: "C", text: "" },
  { label: "D", text: "" },
];
