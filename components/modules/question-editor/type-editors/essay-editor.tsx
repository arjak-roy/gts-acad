"use client";

import { Input } from "@/components/ui/input";

export function EssayEditor({
  rubric,
  maxWordCount,
  onChange,
}: {
  rubric: string;
  maxWordCount: number;
  onChange: (rubric: string, maxWordCount: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 border-dashed border-amber-200 bg-amber-50/50 p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-sm">
            ✍️
          </span>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-900">Essay — Manual Grading</p>
            <p className="text-xs text-amber-700 leading-relaxed">
              Essay responses require a trainer to review and grade manually. Define rubric guidelines below to help graders evaluate consistently.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold">Grading Rubric</label>
        <textarea
          className="w-full rounded-lg border bg-background px-4 py-3 text-sm min-h-[120px] resize-y placeholder:text-muted-foreground/60"
          placeholder="Describe the grading criteria, expected points to cover, and how marks should be distributed…"
          value={rubric}
          onChange={(e) => onChange(e.target.value, maxWordCount)}
        />
      </div>

      <div className="max-w-[200px] space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Max Word Count</label>
        <Input
          type="number"
          min={10}
          placeholder="500"
          value={maxWordCount || ""}
          onChange={(e) => onChange(rubric, Number(e.target.value) || 500)}
        />
      </div>
    </div>
  );
}
