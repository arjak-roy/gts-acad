"use client";

import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { FilterConfig } from "@/components/ui/data-table-filter-bar";
import { cn } from "@/lib/utils";

type DataTableFilterChipsProps = {
  filters: FilterConfig[];
  values: Record<string, string>;
  onRemove: (key: string) => void;
  className?: string;
};

export function DataTableFilterChips({ filters, values, onRemove, className }: DataTableFilterChipsProps) {
  const activeFilters = filters.filter((f) => values[f.key]?.length > 0);

  if (activeFilters.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Active filters:</span>
      {activeFilters.map((filter) => {
        const rawValue = values[filter.key];
        const displayValue =
          filter.type === "select" && filter.options
            ? filter.options.find((opt) => opt.value === rawValue)?.label ?? rawValue
            : rawValue;

        return (
          <Badge key={filter.key} variant="info" className="gap-1.5 pr-1.5">
            <span>
              {filter.label}: {displayValue}
            </span>
            <button
              type="button"
              onClick={() => onRemove(filter.key)}
              className="rounded-full p-0.5 hover:bg-[#0d3b84]/20"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        );
      })}
    </div>
  );
}
