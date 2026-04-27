"use client";

import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import type { BreadcrumbItem } from "@/components/ui/breadcrumb";

/**
 * Human-readable label for every top-level portal segment.
 * Keeps breadcrumb generation self-contained without duplicating sidebar nav items.
 */
const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  learners: "Learners",
  courses: "Courses",
  programs: "Programs",
  batches: "Batches",
  centers: "Centers",
  trainers: "Trainers",
  overview: "Overview",
  "course-builder": "Resource Repository",
  "curriculum-builder": "Curriculum Builder",
  schedule: "Schedule",
  attendance: "Attendance",
  assessments: "Assessments",
  certifications: "Certifications",
  readiness: "Readiness Engine",
  "language-lab": "Language Lab",
  users: "Users",
  payments: "Fees & Payments",
  support: "Support Tickets",
  "logs-actions": "Logs & Actions",
  settings: "Application Settings",
  roles: "Roles & Permissions",
  search: "Search Results",
};

const SUB_ROUTE_LABELS: Record<string, Record<string, string>> = {
  assessments: { reviews: "Assessment Reviews" },
  settings: { "email-templates": "Email Settings" },
};

/**
 * Derive breadcrumb items from the current pathname.
 * Optionally accepts an overlay label for detail views (sheets).
 */
export function useBreadcrumbs(detailLabel?: string): BreadcrumbItem[] {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return useMemo(() => {
    const segments = pathname
      .split("/")
      .filter((s) => s.length > 0);

    if (segments.length === 0) return [];

    const items: BreadcrumbItem[] = [];
    let builtPath = "";

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      builtPath += `/${segment}`;

      // Check for two-segment sub-routes first
      const parentSegment = i > 0 ? segments[i - 1] : undefined;
      const subLabel = parentSegment
        ? SUB_ROUTE_LABELS[parentSegment]?.[segment]
        : undefined;

      if (subLabel) {
        // Keep the parent item as a link and add the sub-route as a new crumb
        items.push({ label: subLabel, href: builtPath });
        continue;
      }

      const label = ROUTE_LABELS[segment];
      if (label) {
        items.push({ label, href: builtPath });
      }
    }

    // If a detail view is open (viewId / editId in search params), add it as the last crumb
    if (detailLabel) {
      items.push({ label: detailLabel });
    } else if (items.length > 0) {
      // Last item is the current page — remove href so it's non-clickable
      const last = items[items.length - 1];
      items[items.length - 1] = { label: last.label };
    }

    return items;
  }, [pathname, detailLabel]);
}
