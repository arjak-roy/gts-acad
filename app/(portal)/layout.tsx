import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { RouteGuard } from "@/components/layout/route-guard";

export const dynamic = "force-dynamic";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout>
      <RouteGuard>{children}</RouteGuard>
    </DashboardLayout>
  );
}