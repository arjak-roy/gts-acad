"use client";

import { ReactNode } from "react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useDashboardUI } from "@/hooks/use-dashboard-ui";

type DashboardShellProps = {
  sidebar: ReactNode;
  children: ReactNode;
};

export function DashboardShell({ sidebar, children }: DashboardShellProps) {
  const isSidebarCollapsed = useDashboardUI((state) => state.isSidebarCollapsed);
  const isMobileSidebarOpen = useDashboardUI((state) => state.isMobileSidebarOpen);
  const setMobileSidebarOpen = useDashboardUI((state) => state.setMobileSidebarOpen);

  return (
    <div className="flex min-h-screen bg-[#f6f7f9]">
      <Sheet open={isMobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent className="left-0 right-auto w-[88vw] max-w-[320px] border-r border-[#dde1e6] p-0 sm:max-w-[360px] lg:hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>Portal navigation</SheetTitle>
            <SheetDescription>Open the academy admin sidebar navigation on mobile devices.</SheetDescription>
          </SheetHeader>
          <div className="h-full overflow-y-auto">{sidebar}</div>
        </SheetContent>
      </Sheet>
      <aside
        data-collapsed={isSidebarCollapsed}
        className={cn(
          "group/sidebar sticky top-0 hidden h-screen shrink-0 border-r border-[#dde1e6] bg-white transition-all duration-300 lg:block",
          isSidebarCollapsed ? "w-20" : "w-60",
        )}
      >
        {sidebar}
      </aside>
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}