"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MoreHorizontal, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { SortableTableHead, type SortDirection } from "@/components/ui/sortable-table-head";
import { TableColumnVisibilityMenu } from "@/components/ui/table-column-visibility-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePersistedTablePreferences } from "@/hooks/use-persisted-table-preferences";
import type { CandidateUsersResponse } from "@/types";

type Props = {
  response: CandidateUsersResponse;
  filters: {
    search: string;
    status: "ALL" | "ACTIVE" | "INACTIVE";
    sortBy?: string;
    sortDirection?: string;
  };
};

const CANDIDATE_USERS_TABLE_KEY = "portal:users:candidates";
const CANDIDATE_USERS_PAGE_SIZES = [10, 25, 50, 100];
const CANDIDATE_USER_COLUMN_OPTIONS = [
  { key: "candidate", label: "Candidate" },
  { key: "learnerCode", label: "Learner Code" },
  { key: "program", label: "Program" },
  { key: "status", label: "Status" },
  { key: "onboarding", label: "Onboarding" },
  { key: "lastLoginAt", label: "Last Login" },
];

function badgeVariant(status: string) {
  if (status === "sent") return "success" as const;
  if (status === "failed") return "danger" as const;
  if (status === "pending") return "warning" as const;
  return "default" as const;
}

function formatDate(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

export function CandidateUsersTable({ response, filters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(filters.search);
  const {
    preferences,
    hasLoadedPreferences,
    visibleColumnIds,
    setPageSize,
    toggleColumnVisibility,
    resetPreferences,
  } = usePersistedTablePreferences({
    tableKey: CANDIDATE_USERS_TABLE_KEY,
    defaultPageSize: response.pageSize,
    pageSizes: CANDIDATE_USERS_PAGE_SIZES,
    columnIds: CANDIDATE_USER_COLUMN_OPTIONS.map((column) => column.key),
  });

  const activeSort = filters.sortBy || "name";
  const activeDirection: SortDirection = filters.sortDirection === "desc" ? "desc" : "asc";

  function handleSort(columnKey: string, direction: "asc" | "desc") {
    updateUrl({ sortBy: columnKey, sortDirection: direction, page: 1 });
  }

  useEffect(() => {
    setSearch(filters.search);
  }, [filters.search]);

  const updateUrl = useCallback((patch: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(searchParams.toString());

    Object.entries(patch).forEach(([key, value]) => {
      if (value === undefined || value === "") {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });

    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (!hasLoadedPreferences || searchParams.has("pageSize") || preferences.pageSize === response.pageSize) {
      return;
    }

    updateUrl({ pageSize: preferences.pageSize, page: 1 });
  }, [hasLoadedPreferences, preferences.pageSize, response.pageSize, searchParams, updateUrl]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => {
                  const nextSearch = event.target.value;
                  setSearch(nextSearch);
                  updateUrl({ search: nextSearch, page: 1 });
                }}
                className="pl-10"
                placeholder="Search by name, email, or phone..."
              />
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
              <select
                className="h-10 rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700"
                value={filters.status}
                onChange={(event) => updateUrl({ status: event.target.value || "ALL", page: 1 })}
              >
                <option value="ALL">All statuses</option>
                <option value="ACTIVE">Active candidates</option>
                <option value="INACTIVE">Inactive candidates</option>
              </select>
              <TableColumnVisibilityMenu
                columns={CANDIDATE_USER_COLUMN_OPTIONS.map((column) => ({
                  key: column.key,
                  label: column.label,
                  checked: !preferences.hiddenColumnIds.includes(column.key),
                  disabled:
                    !preferences.hiddenColumnIds.includes(column.key) && visibleColumnIds.length === 1,
                }))}
                onToggle={toggleColumnVisibility}
                onReset={resetPreferences}
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-100">
            <Table className="min-w-[980px]">
              <TableHeader className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm">
                <TableRow>
                  {!preferences.hiddenColumnIds.includes("candidate") ? <SortableTableHead label="Candidate" columnKey="name" activeSort={activeSort} activeDirection={activeDirection} onSort={handleSort} /> : null}
                  {!preferences.hiddenColumnIds.includes("learnerCode") ? <TableHead>Learner Code</TableHead> : null}
                  {!preferences.hiddenColumnIds.includes("program") ? <TableHead>Program</TableHead> : null}
                  {!preferences.hiddenColumnIds.includes("status") ? <SortableTableHead label="Status" columnKey="status" activeSort={activeSort} activeDirection={activeDirection} onSort={handleSort} /> : null}
                  {!preferences.hiddenColumnIds.includes("onboarding") ? <TableHead>Onboarding</TableHead> : null}
                  {!preferences.hiddenColumnIds.includes("lastLoginAt") ? <SortableTableHead label="Last Login" columnKey="lastLoginAt" activeSort={activeSort} activeDirection={activeDirection} onSort={handleSort} /> : null}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {response.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={visibleColumnIds.length + 1} className="py-10 text-center text-sm text-slate-500">
                      No candidate users matched the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  response.items.map((user) => (
                    <TableRow key={user.id}>
                      {!preferences.hiddenColumnIds.includes("candidate") ? (
                        <TableCell>
                          <div>
                            <p className="font-bold text-slate-900">{user.name}</p>
                            <p className="text-xs text-slate-500">{user.email}</p>
                          </div>
                        </TableCell>
                      ) : null}
                      {!preferences.hiddenColumnIds.includes("learnerCode") ? (
                        <TableCell>
                          <span className="font-mono text-sm text-slate-700">{user.learnerCode ?? "—"}</span>
                        </TableCell>
                      ) : null}
                      {!preferences.hiddenColumnIds.includes("program") ? (
                        <TableCell>
                          <span className="text-sm text-slate-700">{user.programName ?? "—"}</span>
                          {user.batchCode ? (
                            <p className="text-xs text-slate-400">{user.batchCode}</p>
                          ) : null}
                        </TableCell>
                      ) : null}
                      {!preferences.hiddenColumnIds.includes("status") ? (
                        <TableCell>
                          <Badge variant={user.isActive ? "success" : "danger"}>{user.isActive ? "Active" : "Inactive"}</Badge>
                        </TableCell>
                      ) : null}
                      {!preferences.hiddenColumnIds.includes("onboarding") ? (
                        <TableCell>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant={badgeVariant(user.onboardingStatus)}>{user.onboardingStatus.replace("_", " ")}</Badge>
                            {user.requiresPasswordReset ? <Badge variant="warning">Reset Required</Badge> : null}
                          </div>
                        </TableCell>
                      ) : null}
                      {!preferences.hiddenColumnIds.includes("lastLoginAt") ? (
                        <TableCell className="text-sm text-slate-600">{formatDate(user.lastLoginAt)}</TableCell>
                      ) : null}
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="ghost" size="icon" className="h-9 w-9">
                              <MoreHorizontal className="h-5 w-5" />
                              <span className="sr-only">Open actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => updateUrl({ id: user.id })}>Open</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <DataTablePagination
            currentPage={response.page - 1}
            pageCount={response.pageCount}
            totalRows={response.totalCount}
            visibleRows={response.items.length}
            pageSize={response.pageSize}
            pageSizes={CANDIDATE_USERS_PAGE_SIZES}
            onPageChange={(page) => updateUrl({ page: page + 1 })}
            onPageSizeChange={(size) => {
              setPageSize(size);
              updateUrl({ pageSize: size, page: 1 });
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
