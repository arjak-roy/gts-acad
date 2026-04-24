"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type MultiInputField = { label: string; expectedAnswer: string };

export function MultiInputEditor({
  fields,
  onChange,
}: {
  fields: MultiInputField[];
  onChange: (fields: MultiInputField[]) => void;
}) {
  const current = fields.length > 0 ? fields : [{ label: "", expectedAnswer: "" }];

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-semibold">Input Fields & Expected Answers</label>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Define labeled input fields and the expected answers for each.
        </p>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_auto] gap-0 border-b bg-muted/50 px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Field Label</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Expected Answer</span>
          <span className="w-8" />
        </div>
        {current.map((field, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 border-b last:border-b-0 px-3 py-2">
            <Input
              placeholder="e.g., Revenue"
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
            <div className="flex w-8 items-center justify-center">
              {current.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => onChange(current.filter((_, j) => j !== i))}
                >
                  ×
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="rounded-md px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5"
        onClick={() => onChange([...current, { label: "", expectedAnswer: "" }])}
      >
        + Add field
      </button>
    </div>
  );
}

export const DEFAULT_MULTI_FIELDS: MultiInputField[] = [{ label: "", expectedAnswer: "" }];
