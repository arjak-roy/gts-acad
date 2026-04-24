"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function FillBlankEditor({
  answers,
  onChange,
}: {
  answers: string[];
  onChange: (answers: string[]) => void;
}) {
  const current = answers.length > 0 ? answers : [""];

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-semibold">Accepted Answers</label>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Use <code className="rounded bg-muted px-1 py-0.5 text-[10px]">____</code> in the question text to mark blank positions.
        </p>
      </div>
      <div className="space-y-2">
        {current.map((ans, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-bold text-muted-foreground">
              {i + 1}
            </span>
            <Input
              placeholder={`Accepted answer ${i + 1}`}
              value={ans}
              onChange={(e) => {
                const updated = [...current];
                updated[i] = e.target.value;
                onChange(updated);
              }}
            />
            {current.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => onChange(current.filter((_, j) => j !== i))}
              >
                ×
              </Button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="rounded-md px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5"
        onClick={() => onChange([...current, ""])}
      >
        + Add alternative answer
      </button>
    </div>
  );
}
