import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRoleLabel } from "@/lib/utils";
import { getAllRolesService } from "@/services/roles-service";

export default async function SuperAdminRolesPage() {
  const roles = await getAllRolesService();
  const systemRoles = ["superadmin", "admin", "trainer"]
    .map((name) => roles.find((role) => role.name === name))
    .filter((role): role is (typeof roles)[number] => Boolean(role));
  const customRoles = roles.filter((role) => !role.isSystem);
  const roleCards = [
    ...systemRoles.map((role) => ({
      key: role.id,
      name: formatRoleLabel(role.name),
      description: role.description || "No description provided.",
      permissionCount: role._count.permissions,
      userCount: role._count.users,
      badgeLabel: "System",
      badgeVariant: "accent" as const,
      href: `/super-admin/roles/${role.id}`,
      actionLabel: "Open",
    })),
    {
      key: "candidate",
      name: "Candidate",
      description: "Candidate access is handled through the learner portal and candidate session flow, not the staff role assignment table.",
      permissionCount: 0,
      userCount: 0,
      badgeLabel: "Portal",
      badgeVariant: "info" as const,
      href: "/learners/login",
      actionLabel: "View Portal",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--primary-blue)]">Super Admin</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Roles and permissions</h1>
          <p className="mt-2 max-w-3xl text-sm font-medium text-slate-500">The default role catalog shows only Super Admin, Admin, Trainer, and Candidate. Custom roles can be created separately and assigned their own permissions.</p>
        </div>
        <Button asChild>
          <Link href="/super-admin/roles/new">Create Custom Role</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Default Roles</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {roleCards.map((role) => (
            <div key={role.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold text-slate-950">{role.name}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{role.description}</p>
                </div>
                <Badge variant={role.badgeVariant}>{role.badgeLabel}</Badge>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Permissions</p>
                  <p className="mt-2 text-lg font-bold text-slate-900">{role.permissionCount}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Users</p>
                  <p className="mt-2 text-lg font-bold text-slate-900">{role.userCount}</p>
                </div>
              </div>

              <div className="mt-4">
                <Button asChild variant="secondary" className="w-full">
                  <Link href={role.href}>{role.actionLabel}</Link>
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle>Custom Roles</CardTitle>
            <p className="text-sm text-slate-500">Create your own role name and choose its permissions from the role editor.</p>
          </div>
          <Button asChild>
            <Link href="/super-admin/roles/new">Create Custom Role</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {customRoles.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Permissions Count</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customRoles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <div>
                        <p className="font-bold text-slate-900">{formatRoleLabel(role.name)}</p>
                        <p className="text-sm text-slate-500">{role.description || "No description provided."}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">Custom</Badge>
                    </TableCell>
                    <TableCell className="font-bold text-slate-900">{role._count.permissions}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="secondary" size="sm">
                        <Link href={`/super-admin/roles/${role.id}`}>Edit</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
              <p className="text-sm font-semibold text-slate-700">No custom roles yet.</p>
              <p className="mt-2 text-sm text-slate-500">Use Create Custom Role to add a new role with its own name and permission set.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}