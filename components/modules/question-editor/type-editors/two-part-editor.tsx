"use client";

import { Input } from "@/components/ui/input";

export function TwoPartEditor({
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
    <div className="space-y-4">
      <div className="space-y-3">
        <label className="text-sm font-semibold">Shared Options</label>
        <div className="space-y-2">
          {current.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-bold text-muted-foreground">
                {i + 1}
              </span>
              <Input
                placeholder={`Option ${i + 1}`}
                value={opt}
                onChange={(e) => {
                  const updated = [...current];
                  updated[i] = e.target.value;
                  onChange(updated, correctPartA, correctPartB);
                }}
              />
              {current.length > 2 && (
                <button
                  type="button"
                  className="shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    const updated = current.filter((_, j) => j !== i);
                    const nextA = correctPartA === opt ? "" : correctPartA;
                    const nextB = correctPartB === opt ? "" : correctPartB;
                    onChange(updated, nextA, nextB);
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          className="rounded-md px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5"
          onClick={() => onChange([...current, ""], correctPartA, correctPartB)}
        >
          + Add option
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-lg border bg-muted/30 p-4">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Part A — Correct Answer</label>
          <select
            value={correctPartA}
            onChange={(e) => onChange(current, e.target.value, correctPartB)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          >
            <option value="">Select…</option>
            {current.filter(Boolean).map((opt) => (
              <option key={`a-${opt}`} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Part B — Correct Answer</label>
          <select
            value={correctPartB}
            onChange={(e) => onChange(current, correctPartA, e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          >
            <option value="">Select…</option>
            {current.filter(Boolean).map((opt) => (
              <option key={`b-${opt}`} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export const DEFAULT_TWO_PART_OPTIONS = ["", "", "", ""];
