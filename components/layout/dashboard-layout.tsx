import { ReactNode } from "react";

import { AppHeader } from "@/components/layout/app-header";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SidebarNav } from "@/components/layout/sidebar-nav";

export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardShell sidebar={<SidebarNav />}>
      <AppHeader />
      <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">{children}</main>
    </DashboardShell>
  );
}