"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type SortDirection = "asc" | "desc" | null;

export type SortableTableHeadProps = {
  /** Column header label */
  label: string;
  /** Unique column key used in sort events */
  columnKey: string;
  /** Current sort column key (compared against `columnKey` to decide active state) */
  activeSort: string | null;
  /** Current sort direction */
  activeDirection: SortDirection;
  /** Called when the user clicks the header to toggle sort */
  onSort: (columnKey: string, direction: "asc" | "desc") => void;
  /** Extra className on the <th> */
  className?: string;
};

/**
 * A drop-in replacement for `<TableHead>` that adds a clickable sort toggle
 * with ascending / descending / neutral indicator icons.
 *
 * Cycle: neutral → asc → desc → asc → …
 */
export function SortableTableHead({
  label,
  columnKey,
  activeSort,
  activeDirection,
  onSort,
  className,
}: SortableTableHeadProps) {
  const isActive = activeSort === columnKey;
  const currentDirection: SortDirection = isActive ? activeDirection : null;

  function handleClick() {
    const next: "asc" | "desc" =
      currentDirection === "asc" ? "desc" : "asc";
    onSort(columnKey, next);
  }

  return (
    <TableHead className={cn(className)}>
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-slate-600"
        onClick={handleClick}
      >
        {label}
        {currentDirection === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : currentDirection === "desc" ? (
          <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}
