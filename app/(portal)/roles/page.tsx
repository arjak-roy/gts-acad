"use client";

import { useCallback, useEffect, useMemo, useState, startTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Shield, Users, Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CanAccess } from "@/components/ui/can-access";
import { RoleDetailSheet } from "@/components/modules/roles/role-detail-sheet";
import { AddRoleSheet } from "@/components/modules/roles/add-role-sheet";
import { sortByAccessor, type ActiveSortDirection } from "@/lib/table-sorting";

type RoleListItem = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isSystemRole: boolean;
  isActive: boolean;
  permissionCount: number;
  userCount: number;
};

type RoleSortKey = "name" | "code" | "description" | "permissionCount" | "userCount" | "status";

const roleSortAccessors: Record<RoleSortKey, (role: RoleListItem) => string | number> = {
  name: (role) => role.name,
  code: (role) => role.code,
  description: (role) => role.description ?? "",
  permissionCount: (role) => role.permissionCount,
  userCount: (role) => role.userCount,
  status: (role) => (role.isActive ? "Active" : "Inactive"),
};

export default function RolesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [roles, setRoles] = useState<RoleListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortState, setSortState] = useState<{ column: RoleSortKey; direction: ActiveSortDirection }>({
    column: "name",
    direction: "asc",
  });

  const selectedRoleId = searchParams.get("id");

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch("/api/roles");
      if (!res.ok) throw new Error("Failed to fetch roles");
      const json = await res.json();
      setRoles(json.data ?? []);
    } catch {
      setRoles([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const handleRoleClick = (roleId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("id", roleId);
    startTransition(() => router.replace(`/roles?${params.toString()}`));
  };

  const handleSheetClose = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("id");
    startTransition(() => router.replace(`/roles?${params.toString()}`));
  };

  const handleRoleUpdated = () => {
    fetchRoles();
  };

  const sortedRoles = useMemo(
    () => sortByAccessor(roles, sortState.direction, roleSortAccessors[sortState.column]),
    [roles, sortState],
  );

  const handleSort = (columnKey: string, direction: "asc" | "desc") => {
    setSortState({ column: columnKey as RoleSortKey, direction });
  };

  const totalUsers = roles.reduce((sum, r) => sum + r.userCount, 0);
  const activeRoles = roles.filter((r) => r.isActive).length;
  const systemRoles = roles.filter((r) => r.isSystemRole).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Roles & Permissions</h1>
          <p className="mt-1 text-sm text-slate-500">Manage user roles and their permission assignments.</p>
        </div>
        <CanAccess permission="roles.create">
          <AddRoleSheet onCreated={handleRoleUpdated} />
        </CanAccess>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Roles</CardTitle>
            <Shield className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{isLoading ? "—" : roles.length}</div>
            <p className="text-xs text-slate-500">{systemRoles} system · {activeRoles - systemRoles} custom</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Users Assigned</CardTitle>
            <Users className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{isLoading ? "—" : totalUsers}</div>
            <p className="text-xs text-slate-500">Across all active roles</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">System Roles</CardTitle>
            <Lock className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{isLoading ? "—" : systemRoles}</div>
            <p className="text-xs text-slate-500">Protected from deletion</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <RolesTableSkeleton />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead label="Role" columnKey="name" activeSort={sortState.column} activeDirection={sortState.direction} onSort={handleSort} className="w-[200px]" />
                <SortableTableHead label="Code" columnKey="code" activeSort={sortState.column} activeDirection={sortState.direction} onSort={handleSort} />
                <SortableTableHead label="Description" columnKey="description" activeSort={sortState.column} activeDirection={sortState.direction} onSort={handleSort} />
                <SortableTableHead label="Permissions" columnKey="permissionCount" activeSort={sortState.column} activeDirection={sortState.direction} onSort={handleSort} className="text-center" />
                <SortableTableHead label="Users" columnKey="userCount" activeSort={sortState.column} activeDirection={sortState.direction} onSort={handleSort} className="text-center" />
                <SortableTableHead label="Status" columnKey="status" activeSort={sortState.column} activeDirection={sortState.direction} onSort={handleSort} className="text-center" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-slate-400">
                    No roles found.
                  </TableCell>
                </TableRow>
              ) : (
                sortedRoles.map((role) => (
                  <TableRow
                    key={role.id}
                    className="cursor-pointer"
                    onClick={() => handleRoleClick(role.id)}
                  >
                    <TableCell className="font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        {role.name}
                        {role.isSystemRole && (
                          <Lock className="h-3 w-3 text-slate-400" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                        {role.code}
                      </code>
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate text-slate-500">
                      {role.description ?? "—"}
                    </TableCell>
                    <TableCell className="text-center">{role.permissionCount}</TableCell>
                    <TableCell className="text-center">{role.userCount}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={role.isActive ? "success" : "default"}>
                        {role.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <RoleDetailSheet
        roleId={selectedRoleId}
        open={!!selectedRoleId}
        onOpenChange={(open) => !open && handleSheetClose()}
        onUpdated={handleRoleUpdated}
      />
    </div>
  );
}

function RolesTableSkeleton() {
  return (
    <Card>
      <div className="p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 flex-1" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </div>
    </Card>
  );
}
