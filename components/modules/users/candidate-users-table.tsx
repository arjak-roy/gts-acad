"use client";

import { startTransition, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, MoreHorizontal, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { SortableTableHead, type SortDirection } from "@/components/ui/sortable-table-head";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

  const activeSort = filters.sortBy ?? null;
  const activeDirection: SortDirection = (filters.sortDirection as SortDirection) ?? null;

  function handleSort(columnKey: string, direction: "asc" | "desc") {
    updateUrl({ sortBy: columnKey, sortDirection: direction, page: 1 });
  }

  useEffect(() => {
    setSearch(filters.search);
  }, [filters.search]);

  function updateUrl(patch: Record<string, string | number | undefined>) {
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
  }

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
            <select
              className="h-10 rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700"
              value={filters.status}
              onChange={(event) => updateUrl({ status: event.target.value || "ALL", page: 1 })}
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active candidates</option>
              <option value="INACTIVE">Inactive candidates</option>
            </select>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-100">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <SortableTableHead label="Candidate" columnKey="name" activeSort={activeSort} activeDirection={activeDirection} onSort={handleSort} />
                  <TableHead>Learner Code</TableHead>
                  <TableHead>Program</TableHead>
                  <SortableTableHead label="Status" columnKey="status" activeSort={activeSort} activeDirection={activeDirection} onSort={handleSort} />
                  <TableHead>Onboarding</TableHead>
                  <SortableTableHead label="Last Login" columnKey="lastLoginAt" activeSort={activeSort} activeDirection={activeDirection} onSort={handleSort} />
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {response.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-slate-500">
                      No candidate users matched the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  response.items.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <p className="font-bold text-slate-900">{user.name}</p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm text-slate-700">{user.learnerCode ?? "—"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-700">{user.programName ?? "—"}</span>
                        {user.batchCode ? (
                          <p className="text-xs text-slate-400">{user.batchCode}</p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? "success" : "danger"}>{user.isActive ? "Active" : "Inactive"}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant={badgeVariant(user.onboardingStatus)}>{user.onboardingStatus.replace("_", " ")}</Badge>
                          {user.requiresPasswordReset ? <Badge variant="warning">Reset Required</Badge> : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{formatDate(user.lastLoginAt)}</TableCell>
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

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              Showing {response.items.length} of {response.totalCount} candidate users
            </p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={response.page <= 1} onClick={() => updateUrl({ page: response.page - 1 })}>
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm font-medium text-slate-600">
                Page {response.page} of {response.pageCount}
              </span>
              <Button variant="secondary" size="sm" disabled={response.page >= response.pageCount} onClick={() => updateUrl({ page: response.page + 1 })}>
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
