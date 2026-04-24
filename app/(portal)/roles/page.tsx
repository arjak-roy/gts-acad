"use client";

import { useCallback, useEffect, useMemo, useState, startTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield, Users, Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { Skeleton } from "@/components/ui/skeleton";
import { TableColumnVisibilityMenu } from "@/components/ui/table-column-visibility-menu";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { CanAccess } from "@/components/ui/can-access";
import { RoleDetailSheet } from "@/components/modules/roles/role-detail-sheet";
import { AddRoleSheet } from "@/components/modules/roles/add-role-sheet";
import { usePersistedTablePreferences } from "@/hooks/use-persisted-table-preferences";
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

const ROLES_TABLE_KEY = "portal:roles";
const ROLES_PAGE_SIZES = [10, 25, 50, 100];
const ROLE_COLUMN_OPTIONS = [
  { key: "name", label: "Role" },
  { key: "code", label: "Code" },
  { key: "description", label: "Description" },
  { key: "permissionCount", label: "Permissions" },
  { key: "userCount", label: "Users" },
  { key: "status", label: "Status" },
];

export default function RolesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [roles, setRoles] = useState<RoleListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortState, setSortState] = useState<{ column: RoleSortKey; direction: ActiveSortDirection }>({
    column: "name",
    direction: "asc",
  });
  const [currentPage, setCurrentPage] = useState(0);
  const {
    preferences,
    hasLoadedPreferences,
    visibleColumnIds,
    setPageSize,
    toggleColumnVisibility,
    resetPreferences,
  } = usePersistedTablePreferences({
    tableKey: ROLES_TABLE_KEY,
    defaultPageSize: 10,
    pageSizes: ROLES_PAGE_SIZES,
    columnIds: ROLE_COLUMN_OPTIONS.map((column) => column.key),
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
  const paginatedRoles = useMemo(
    () => sortedRoles.slice(currentPage * preferences.pageSize, (currentPage + 1) * preferences.pageSize),
    [currentPage, preferences.pageSize, sortedRoles],
  );

  useEffect(() => {
    if (!hasLoadedPreferences) {
      return;
    }

    setCurrentPage(0);
  }, [hasLoadedPreferences, preferences.pageSize]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(sortedRoles.length / preferences.pageSize) - 1);
    if (currentPage > maxPage) {
      setCurrentPage(maxPage);
    }
  }, [currentPage, preferences.pageSize, sortedRoles.length]);

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
        <div className="flex items-center gap-2">
          <TableColumnVisibilityMenu
            columns={ROLE_COLUMN_OPTIONS.map((column) => ({
              key: column.key,
              label: column.label,
              checked: !preferences.hiddenColumnIds.includes(column.key),
              disabled:
                !preferences.hiddenColumnIds.includes(column.key) && visibleColumnIds.length === 1,
            }))}
            onToggle={toggleColumnVisibility}
            onReset={resetPreferences}
          />
          <CanAccess permission="roles.create">
            <AddRoleSheet onCreated={handleRoleUpdated} />
          </CanAccess>
        </div>
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
          <Table className="min-w-[980px]">
            <TableHeader className="sticky-admin-table-header">
              <TableRow>
                {!preferences.hiddenColumnIds.includes("name") ? <SortableTableHead label="Role" columnKey="name" activeSort={sortState.column} activeDirection={sortState.direction} onSort={handleSort} className="w-[200px]" /> : null}
                {!preferences.hiddenColumnIds.includes("code") ? <SortableTableHead label="Code" columnKey="code" activeSort={sortState.column} activeDirection={sortState.direction} onSort={handleSort} /> : null}
                {!preferences.hiddenColumnIds.includes("description") ? <SortableTableHead label="Description" columnKey="description" activeSort={sortState.column} activeDirection={sortState.direction} onSort={handleSort} /> : null}
                {!preferences.hiddenColumnIds.includes("permissionCount") ? <SortableTableHead label="Permissions" columnKey="permissionCount" activeSort={sortState.column} activeDirection={sortState.direction} onSort={handleSort} className="text-center" /> : null}
                {!preferences.hiddenColumnIds.includes("userCount") ? <SortableTableHead label="Users" columnKey="userCount" activeSort={sortState.column} activeDirection={sortState.direction} onSort={handleSort} className="text-center" /> : null}
                {!preferences.hiddenColumnIds.includes("status") ? <SortableTableHead label="Status" columnKey="status" activeSort={sortState.column} activeDirection={sortState.direction} onSort={handleSort} className="text-center" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColumnIds.length} className="h-24 text-center text-slate-400">
                    No roles found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRoles.map((role) => (
                  <TableRow
                    key={role.id}
                    className="cursor-pointer"
                    onClick={() => handleRoleClick(role.id)}
                  >
                    {!preferences.hiddenColumnIds.includes("name") ? (
                      <TableCell className="font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          {role.name}
                          {role.isSystemRole && (
                            <Lock className="h-3 w-3 text-slate-400" />
                          )}
                        </div>
                      </TableCell>
                    ) : null}
                    {!preferences.hiddenColumnIds.includes("code") ? (
                      <TableCell>
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                          {role.code}
                        </code>
                      </TableCell>
                    ) : null}
                    {!preferences.hiddenColumnIds.includes("description") ? (
                      <TableCell className="max-w-[300px] truncate text-slate-500">
                        {role.description ?? "—"}
                      </TableCell>
                    ) : null}
                    {!preferences.hiddenColumnIds.includes("permissionCount") ? <TableCell className="text-center">{role.permissionCount}</TableCell> : null}
                    {!preferences.hiddenColumnIds.includes("userCount") ? <TableCell className="text-center">{role.userCount}</TableCell> : null}
                    {!preferences.hiddenColumnIds.includes("status") ? (
                      <TableCell className="text-center">
                        <Badge variant={role.isActive ? "success" : "default"}>
                          {role.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <CardContent className="pt-4">
            <DataTablePagination
              currentPage={currentPage}
              pageCount={Math.max(1, Math.ceil(sortedRoles.length / preferences.pageSize))}
              totalRows={sortedRoles.length}
              visibleRows={paginatedRoles.length}
              pageSize={preferences.pageSize}
              pageSizes={ROLES_PAGE_SIZES}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(0);
              }}
            />
          </CardContent>
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
