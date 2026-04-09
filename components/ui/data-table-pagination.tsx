"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DEFAULT_PAGE_SIZES = [10, 25, 50, 100];

type DataTablePaginationProps = {
  currentPage: number;
  pageCount: number;
  totalRows: number;
  visibleRows: number;
  pageSize: number;
  pageSizes?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  className?: string;
};

export function DataTablePagination({
  currentPage,
  pageCount,
  totalRows,
  visibleRows,
  pageSize,
  pageSizes = DEFAULT_PAGE_SIZES,
  onPageChange,
  onPageSizeChange,
  className,
}: DataTablePaginationProps) {
  const canPrevious = currentPage > 0;
  const canNext = currentPage < pageCount - 1;

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex items-center gap-3">
        <p className="text-sm text-slate-500">
          Showing <span className="font-bold text-slate-900">{visibleRows}</span> of{" "}
          <span className="font-bold text-slate-900">{totalRows}</span> rows.
        </p>
        <div className="flex items-center gap-1.5">
          <label htmlFor="dt-page-size" className="text-xs font-medium text-slate-500">
            Per page
          </label>
          <select
            id="dt-page-size"
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d3b84]"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" disabled={!canPrevious} onClick={() => onPageChange(currentPage - 1)}>
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <span className="min-w-24 text-center text-sm font-semibold text-slate-600">
          Page {currentPage + 1} / {Math.max(pageCount, 1)}
        </span>
        <Button variant="secondary" size="sm" disabled={!canNext} onClick={() => onPageChange(currentPage + 1)}>
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
