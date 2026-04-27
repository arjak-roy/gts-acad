"use client";

import { Suspense } from "react";

import { Breadcrumb } from "@/components/ui/breadcrumb";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";

function BreadcrumbInner() {
  const items = useBreadcrumbs();

  // Hide on dashboard (Home icon already links there) and empty states
  if (items.length === 0 || (items.length === 1 && items[0].label === "Dashboard")) return null;

  return <Breadcrumb items={items} className="px-4 pt-4 md:px-6 lg:px-8" />;
}

export function PortalBreadcrumb() {
  return (
    <Suspense fallback={null}>
      <BreadcrumbInner />
    </Suspense>
  );
}
