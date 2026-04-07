"use client";

import { useId, useState } from "react";
import { usePathname } from "next/navigation";
import { Info } from "lucide-react";

import { BuilderShell } from "@/components/modules/builders/builder-shell";
import { cn } from "@/lib/utils";

const tabs = [
  {
    href: "/course-builder/content",
    label: "Content Library",
    description: "Organize folders, upload assets, and keep course materials easy to source.",
  },
  {
    href: "/course-builder/batch-mapping",
    label: "Batch Mapping",
    description: "Assign approved content and assessments to live batches in a cleaner operational workspace.",
  },
];

export default function CourseBuilderLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isWorkflowTooltipOpen, setIsWorkflowTooltipOpen] = useState(false);
  const tooltipId = useId();

  const closeTooltipOnBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsWorkflowTooltipOpen(false);
    }
  };

  return (
    <BuilderShell
      title="Content Manager"
      description="Run the source-of-truth workspace for course content and batch mappings. Keep upload operations structured, searchable, and ready for curriculum and batch delivery."
      sections={tabs}
      showHeader={!pathname.startsWith("/course-builder/content")}
      aside={(
        <div
          className="relative"
          onMouseEnter={() => setIsWorkflowTooltipOpen(true)}
          onMouseLeave={() => setIsWorkflowTooltipOpen(false)}
          onFocus={() => setIsWorkflowTooltipOpen(true)}
          onBlur={closeTooltipOnBlur}
        >
          <button
            type="button"
            aria-label="Recommended workflow"
            aria-expanded={isWorkflowTooltipOpen}
            aria-controls={tooltipId}
            aria-describedby={isWorkflowTooltipOpen ? tooltipId : undefined}
            title="Recommended workflow"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#dde1e6] bg-white text-slate-500 shadow-sm transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84] focus-visible:ring-offset-1"
            onClick={() => setIsWorkflowTooltipOpen((current) => !current)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setIsWorkflowTooltipOpen(false);
              }
            }}
          >
            <Info className="h-4 w-4" />
          </button>
          <div
            id={tooltipId}
            role="tooltip"
            className={cn(
              "absolute left-12 top-0 z-30 w-72 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-xl transition-all duration-150",
              isWorkflowTooltipOpen
                ? "translate-y-0 opacity-100"
                : "pointer-events-none -translate-y-1 opacity-0",
            )}
          >
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Recommended Flow</p>
            <p className="mt-2">1. Curate folders and upload content in Content Library.</p>
            <p className="mt-1">2. Prepare reusable assessments from the Assessments workspace.</p>
            <p className="mt-1">3. Use Batch Mapping to assign ready materials to delivery cohorts.</p>
          </div>
        </div>
      )}
    >
      {children}
    </BuilderShell>
  );
}
