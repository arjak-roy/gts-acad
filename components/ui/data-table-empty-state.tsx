import type { ReactNode } from "react";
import { SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DataTableEmptyStateProps = {
  icon?: ReactNode;
  title?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
};

export function DataTableEmptyState({
  icon,
  title = "No records found.",
  description = "Try adjusting your filters or search criteria.",
  action,
  className,
}: DataTableEmptyStateProps) {
  return (
    <div className={cn("rounded-2xl border border-slate-100 bg-slate-50/70 px-8 py-12 text-center", className)}>
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-200/60 text-slate-400">
        {icon ?? <SearchX className="h-5 w-5" />}
      </div>
      <p className="text-sm font-bold text-slate-700">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
      {action ? (
        <Button variant="secondary" size="sm" className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
