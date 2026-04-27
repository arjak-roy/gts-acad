"use client";

import { Fragment } from "react";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

import { cn } from "@/lib/utils";

export type BreadcrumbItem = {
  /** Display label */
  label: string;
  /** Navigation href — omit for the active (last) item */
  href?: string;
};

type BreadcrumbProps = {
  items: BreadcrumbItem[];
  /** Show a home icon as the first crumb (default: true) */
  showHome?: boolean;
  className?: string;
};

export function Breadcrumb({ items, showHome = true, className }: BreadcrumbProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center gap-1.5 text-sm", className)}>
      {showHome && (
        <>
          <Link
            href="/dashboard"
            className="flex items-center text-slate-400 transition-colors hover:text-slate-700"
          >
            <Home className="h-3.5 w-3.5" />
            <span className="sr-only">Dashboard</span>
          </Link>
          {items.length > 0 && <ChevronRight className="h-3 w-3 text-slate-300" />}
        </>
      )}
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <Fragment key={`${item.label}-${index}`}>
            {isLast || !item.href ? (
              <span
                className={cn(
                  "max-w-[200px] truncate font-medium",
                  isLast ? "text-slate-900" : "text-slate-400",
                )}
              >
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="max-w-[200px] truncate text-slate-400 transition-colors hover:text-slate-700"
              >
                {item.label}
              </Link>
            )}
            {!isLast && <ChevronRight className="h-3 w-3 shrink-0 text-slate-300" />}
          </Fragment>
        );
      })}
    </nav>
  );
}
