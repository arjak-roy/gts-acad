"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type FilterConfig = {
  key: string;
  label: string;
  type: "select" | "text" | "date-range";
  options?: { label: string; value: string }[];
};

type DataTableFilterBarProps = {
  filters: FilterConfig[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onReset: () => void;
  className?: string;
};

export function DataTableFilterBar({ filters, values, onChange, onReset, className }: DataTableFilterBarProps) {
  if (filters.length === 0) return null;

  const hasActiveFilters = Object.values(values).some((v) => v.length > 0);

  return (
    <div className={cn("flex flex-wrap items-end gap-3", className)}>
      {filters.map((filter) => (
        <div key={filter.key} className="min-w-[140px]">
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
            {filter.label}
          </label>
          {filter.type === "select" && filter.options ? (
            <select
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d3b84]"
              value={values[filter.key] ?? ""}
              onChange={(e) => onChange(filter.key, e.target.value)}
            >
              <option value="">All</option>
              {filter.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : filter.type === "date-range" ? (
            <input
              type="date"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d3b84]"
              value={values[filter.key] ?? ""}
              onChange={(e) => onChange(filter.key, e.target.value)}
            />
          ) : (
            <input
              type="text"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0d3b84]"
              placeholder={`Filter by ${filter.label.toLowerCase()}…`}
              value={values[filter.key] ?? ""}
              onChange={(e) => onChange(filter.key, e.target.value)}
            />
          )}
        </div>
      ))}
      {hasActiveFilters ? (
        <Button variant="ghost" size="sm" onClick={onReset} className="text-rose-500 hover:text-rose-700">
          Reset
        </Button>
      ) : null}
    </div>
  );
}
