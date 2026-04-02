import { DashboardLayout } from "@/components/layout/dashboard-layout";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}