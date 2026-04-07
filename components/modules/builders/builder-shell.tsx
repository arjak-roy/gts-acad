"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  children: React.ReactNode;
};

export function BuilderShell({ title, description, sections, actions, aside, children }: BuilderShellProps) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[28px] border border-[#d8e1ee] bg-[radial-gradient(circle_at_top_left,_rgba(13,59,132,0.14),_transparent_36%),linear-gradient(135deg,_#ffffff_0%,_#f6f9fc_100%)] p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-2">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">Workspace</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">{title}</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Builder Sections</CardTitle>
              <CardDescription>Use the section rail to move between source content, reusable assessments, and mapping workflows.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {sections.map((section) => {
                const isActive = pathname === section.href || pathname.startsWith(`${section.href}/`);

                return (
                  <Link
                    key={section.href}
                    href={section.href}
                    className={cn(
                      "block rounded-2xl border px-4 py-3 transition-colors",
                      isActive
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-[#dde1e6] bg-white hover:border-primary/40 hover:bg-slate-50",
                    )}
                  >
                    <p className="text-sm font-semibold text-slate-900">{section.label}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{section.description}</p>
                  </Link>
                );
              })}
            </CardContent>
          </Card>

          {aside}
        </div>

        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </div>
  );
}