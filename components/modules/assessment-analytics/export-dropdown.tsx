"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ExportDropdownProps {
  reportType: "summary" | "learner-performance" | "question-analytics";
  filters: Record<string, string>;
}

export function ExportDropdown({ reportType, filters }: ExportDropdownProps) {
  const handleExport = useCallback(
    async (format: "csv" | "xlsx" | "pdf") => {
      try {
        const params = new URLSearchParams({
          ...filters,
          reportType,
          format,
        });
        const url = `/api/assessment-analytics/export?${params.toString()}`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error("Export failed.");
        }

        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = downloadUrl;
        anchor.download = `${reportType}-report.${format}`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(downloadUrl);

        toast.success(`${format.toUpperCase()} report downloaded.`);
      } catch {
        toast.error("Failed to export report. Please try again.");
      }
    },
    [filters, reportType],
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("csv")}>
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("xlsx")}>
          Export as Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("pdf")}>
          Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
