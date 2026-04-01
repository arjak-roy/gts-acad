import { DashboardLayout } from "@/components/layout/dashboard-layout";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}