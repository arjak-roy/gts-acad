import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl bg-gradient-to-r from-slate-200/50 via-slate-200/70 to-slate-200/50 animate-shimmer",
        className,
      )}
      style={{
        backgroundSize: "1000px 100%",
      }}
    />
  );
}

export function ShellSkeleton() {
  return (
    <div className="flex min-h-screen gap-0">
      <div className="hidden w-[240px] border-r border-[#dde1e6] bg-white lg:block">
        <div className="space-y-4 p-6">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
      <div className="flex-1 p-6">
        <Skeleton className="h-14 w-full rounded-2xl bg-white" />
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-32 bg-white" />
          <Skeleton className="h-32 bg-white" />
          <Skeleton className="h-32 bg-white" />
          <Skeleton className="h-32 bg-white" />
        </div>
      </div>
    </div>
  );
}