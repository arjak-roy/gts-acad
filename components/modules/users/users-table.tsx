"use client";

import { startTransition, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { InternalUsersResponse } from "@/types";

type Props = {
  response: InternalUsersResponse;
  filters: {
    search: string;
    status: "ALL" | "ACTIVE" | "INACTIVE";
  };
};

function badgeVariant(status: string) {
  if (status === "sent") {
    return "success" as const;
  }

  if (status === "failed") {
    return "danger" as const;
  }

  if (status === "pending") {
    return "warning" as const;
  }

  return "default" as const;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Never";
  }

  return new Date(value).toLocaleString();
}

export function UsersTable({ response, filters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(filters.search);

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
              <option value="ACTIVE">Active users</option>
              <option value="INACTIVE">Inactive users</option>
            </select>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-100">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Onboarding</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {response.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-slate-500">
                      No internal users matched the current filters.
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
                        <div className="flex flex-wrap gap-1.5">
                          {user.roles.map((role) => (
                            <Badge key={role.id} variant="info">
                              {role.name}
                            </Badge>
                          ))}
                        </div>
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
                        <Button variant="ghost" onClick={() => updateUrl({ id: user.id })}>
                          Open
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              Showing {response.items.length} of {response.totalCount} internal users
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
