import { ReactNode } from "react";

import { AppHeader } from "@/components/layout/app-header";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { getCurrentAuthSession } from "@/lib/auth/access";

export async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getCurrentAuthSession();

  return (
    <DashboardShell sidebar={<SidebarNav session={session} />}>
      <AppHeader session={session} />
      <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">{children}</main>
    </DashboardShell>
  );
}