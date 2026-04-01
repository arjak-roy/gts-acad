"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";

/**
 * Loading skeleton for detail/view sheets (display-only content)
 * Shows header + info fields without edit capability
 */
export function SheetDetailSkeleton() {
  return (
    <>
      <SheetHeader className="border-b border-[#dde1e6] pb-6">
        <div className="flex items-start gap-4">
          <Skeleton className="h-16 w-16 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-5 w-32" />
          </div>
        </div>
      </SheetHeader>

      <div className="space-y-6 py-6">
        {/* Field group 1 */}
        <div className="space-y-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Field group 2 */}
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Field group 3 */}
        <div className="space-y-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-24 w-full" />
        </div>

        {/* Field group 4 */}
        <div className="space-y-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>

      <div className="border-t border-[#dde1e6] pt-6">
        <Skeleton className="h-10 w-24" />
      </div>
    </>
  );
}

/**
 * Loading skeleton for form sheets (edit/create content)
 * Shows header + form fields with various input types
 */
export function SheetFormSkeleton() {
  return (
    <>
      <SheetHeader className="border-b border-[#dde1e6] pb-6">
        <SheetTitle>
          <Skeleton className="h-7 w-48" />
        </SheetTitle>
      </SheetHeader>

      <div className="space-y-6 py-6">
        {/* Text input field */}
        <div className="space-y-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Text input field */}
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Select/Dropdown field */}
        <div className="space-y-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Multi-select field */}
        <div className="space-y-2">
          <Skeleton className="h-5 w-28" />
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>

        {/* Textarea field */}
        <div className="space-y-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>

      <div className="border-t border-[#dde1e6] pt-6 flex gap-3 justify-end">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-20" />
      </div>
    </>
  );
}

/**
 * Wrapper component for conditional loading skeleton display
 * Use this to wrap your sheet content
 */
export function SheetLoadingSkeleton({
  isLoading,
  children,
  variant = "detail",
}: {
  isLoading: boolean;
  children?: React.ReactNode;
  variant?: "detail" | "form";
}) {
  if (isLoading) {
    return variant === "form" ? <SheetFormSkeleton /> : <SheetDetailSkeleton />;
  }
  return <>{children ?? null}</>;
}
