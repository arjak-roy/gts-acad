"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type BuilderShellSection = {
  href: string;
  label: string;
  description: string;
};

type BuilderShellProps = {
  title: string;
  description: string;
  sections: BuilderShellSection[];
  actions?: React.ReactNode;
  aside?: React.ReactNode;
  showHeader?: boolean;
  children: React.ReactNode;
};

export function BuilderSectionRibbon({ sections }: { sections: BuilderShellSection[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Content manager section tools" className="flex flex-wrap gap-2">
      {sections.map((section) => {
        const isActive = pathname === section.href || pathname.startsWith(`${section.href}/`);

        return (
          <Link
            key={section.href}
            href={section.href}
            title={section.label}
            aria-label={section.label}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group inline-flex items-center justify-center rounded-xl border px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84] focus-visible:ring-offset-1",
              isActive
                ? "border-primary bg-primary text-white shadow-sm"
                : "border-[#dde1e6] bg-white text-slate-600 hover:border-primary/40 hover:bg-slate-50 hover:text-primary",
            )}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BuilderShell({ title, description, sections, actions, aside, showHeader = true, children }: BuilderShellProps) {
  return (
    <div className="space-y-6">
      {showHeader ? (
        <div className="overflow-hidden rounded-[28px] border border-[#d8e1ee] bg-[radial-gradient(circle_at_top_left,_rgba(13,59,132,0.14),_transparent_36%),linear-gradient(135deg,_#ffffff_0%,_#f6f9fc_100%)] p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-2">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">Workspace</p>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">{title}</h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t border-white/60 pt-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 space-y-2">
              <p className="text-[9px] font-black uppercase tracking-[0.24em] text-slate-400">Tool Ribbon</p>
              <BuilderSectionRibbon sections={sections} />
            </div>

            {aside ? <div className="flex items-center justify-start lg:justify-end">{aside}</div> : null}
          </div>
        </div>
      ) : null}

      <div className="min-w-0 space-y-6">{children}</div>
    </div>
  );
}