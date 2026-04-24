"use client";

import { Input } from "@/components/ui/input";

export function NumericEditor({
  value,
  tolerance,
  onChange,
}: {
  value: number | string;
  tolerance: number | string;
  onChange: (value: number, tolerance: number) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="text-sm font-semibold">Numeric Answer</label>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Correct Value</label>
          <Input
            type="number"
            step="any"
            placeholder="e.g., 42"
            value={value}
            onChange={(e) => onChange(Number(e.target.value), Number(tolerance) || 0)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Tolerance (±)</label>
          <Input
            type="number"
            step="any"
            min={0}
            placeholder="0"
            value={tolerance}
            onChange={(e) => onChange(Number(value) || 0, Number(e.target.value))}
          />
          <p className="text-[10px] text-muted-foreground">
            Answers within ±{Number(tolerance) || 0} of {Number(value) || 0} are accepted.
          </p>
        </div>
      </div>
    </div>
  );
}
