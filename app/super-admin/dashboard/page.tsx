import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSuperAdminDashboardStatsService } from "@/services/roles-service";

export default async function SuperAdminDashboardPage() {
  const stats = await getSuperAdminDashboardStatsService();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--primary-blue)]">Super Admin</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Platform governance dashboard</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total Staff Users" value={String(stats.totalStaffUsers)} />
        <StatCard title="Total Roles" value={String(stats.totalRoles)} />
        <StatCard title="Total Permissions Configured" value={String(stats.totalPermissionsConfigured)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <QuickActionCard title="Manage Roles" href="/super-admin/roles" copy="Create, edit, and scope permissions for staff roles." />
        <QuickActionCard title="Manage Users" href="/super-admin/users" copy="Assign roles to staff accounts and audit access placement." />
        <QuickActionCard title="Audit Log" href="/super-admin/audit" copy="Review sensitive changes and governance events." />
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="space-y-3 p-6">
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">{title}</p>
        <p className="text-4xl font-black text-slate-950">{value}</p>
      </CardContent>
    </Card>
  );
}

function QuickActionCard({ title, href, copy }: { title: string; href: string; copy: string }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl font-black text-slate-950">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-slate-600">{copy}</p>
        <Button asChild>
          <Link href={href}>Open</Link>
        </Button>
      </CardContent>
    </Card>
  );
}