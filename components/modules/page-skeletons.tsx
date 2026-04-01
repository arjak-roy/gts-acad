import { Skeleton } from "@/components/ui/skeleton";

export function DashboardPageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-72" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-32 bg-white" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Skeleton className="h-80 bg-white xl:col-span-2" />
        <Skeleton className="h-80 bg-white" />
      </div>
    </div>
  );
}

export function LearnersPageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-[420px] bg-white" />
      <Skeleton className="h-[280px] bg-white" />
    </div>
  );
}

export function SectionPageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-80" />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Skeleton className="h-72 bg-white" />
        <Skeleton className="h-72 bg-white" />
      </div>
    </div>
  );
}