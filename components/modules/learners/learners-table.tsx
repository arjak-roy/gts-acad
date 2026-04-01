"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, ChevronLeft, ChevronRight, LayoutGrid, Rows3, Search } from "lucide-react";
import { ColumnDef, SortingState, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CardLayoutPreset, FlexibleCardGrid, FlexibleCardItem, parseCardLayoutPreset } from "@/components/ui/flexible-card-layout";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EnrollCandidateSheet } from "@/components/modules/learners/enroll-candidate-sheet";
import { createSearchParams } from "@/lib/utils";
import { LearnerListItem, LearnersResponse, PlacementStatus } from "@/types";

type LearnersTableProps = {
  response: LearnersResponse;
  filters: {
    search: string;
    batchCode: string;
    placementStatus?: string;
    sortBy: string;
    sortDirection: string;
  };
};

function placementVariant(status: PlacementStatus) {
  if (status === PlacementStatus.PLACEMENT_READY) return "success" as const;
  if (status === PlacementStatus.IN_REVIEW) return "warning" as const;
  return "default" as const;
}

export function LearnersTable({ response, filters }: LearnersTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(filters.search);
  const viewMode = searchParams.get("view") === "card" ? "card" : "table";
  const layoutPreset = parseCardLayoutPreset(searchParams.get("layout"));

  useEffect(() => {
    setSearch(filters.search);
  }, [filters.search]);

  const updateUrl = (patch: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(searchParams.toString());

    Object.entries(patch).forEach(([key, value]) => {
      if (value === undefined || value === "") {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });

    if (patch.page === undefined) {
      next.delete("page");
    }

    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  };

  const resolveCardSpan = (index: number, preset: CardLayoutPreset) => {
    if (preset === "focus") {
      return index === 0 ? "hero" : "wide";
    }

    if (preset === "compact") {
      return "normal";
    }

    return index % 3 === 0 ? "wide" : "normal";
  };

  const columns = useMemo<ColumnDef<LearnerListItem>[]>(
    () => [
      {
        accessorKey: "fullName",
        header: () => <HeaderButton label="Learner Profile" onClick={() => toggleSort("fullName")} />,
        cell: ({ row }) => (
          <div>
            <p className="font-bold text-slate-900">{row.original.fullName}</p>
            <p className="text-[11px] text-slate-400">ID: {row.original.learnerCode}</p>
          </div>
        ),
      },
      {
        accessorKey: "programName",
        header: "Program & Batch",
        cell: ({ row }) => (
          <div>
            <p className="font-bold text-slate-700">{row.original.programName ?? "Unassigned"}</p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              {row.original.batchCode ?? "Pending"}
              {row.original.campus ? ` • ${row.original.campus}` : ""}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "attendancePercentage",
        header: () => <HeaderButton label="Attend. %" onClick={() => toggleSort("attendancePercentage")} className="justify-center" />,
        cell: ({ row }) => <div className="text-center font-black text-emerald-600">{row.original.attendancePercentage.toFixed(1)}%</div>,
      },
      {
        accessorKey: "averageScore",
        header: () => <HeaderButton label="Avg Score" onClick={() => toggleSort("averageScore")} className="justify-center" />,
        cell: ({ row }) => <div className="text-center font-black text-slate-900">{row.original.averageScore.toFixed(0)}/100</div>,
      },
      {
        accessorKey: "placementStatus",
        header: () => <HeaderButton label="Readiness" onClick={() => toggleSort("readinessPercentage")} className="justify-center" />,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-2">
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
              <div className="h-1.5 rounded-full bg-accent" style={{ width: `${row.original.readinessPercentage}%` }} />
            </div>
            <Badge variant={placementVariant(row.original.placementStatus)}>{row.original.readinessPercentage}%</Badge>
          </div>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const nextQuery = createSearchParams({
            search: filters.search,
            batchCode: filters.batchCode,
            placementStatus: filters.placementStatus,
            sortBy: filters.sortBy,
            sortDirection: filters.sortDirection,
            page: response.page,
            pageSize: response.pageSize,
            view: viewMode === "card" ? "card" : undefined,
            layout: viewMode === "card" && layoutPreset !== "balanced" ? layoutPreset : undefined,
            id: row.original.learnerCode,
          });

          return (
            <div className="text-right">
              <Button asChild variant="ghost" className="text-primary hover:text-primary">
                <Link href={`/learners?${nextQuery}`} scroll={false}>
                  Open
                </Link>
              </Button>
            </div>
          );
        },
      },
    ],
    [filters.batchCode, filters.placementStatus, filters.search, filters.sortBy, filters.sortDirection, response.page, response.pageSize, viewMode, layoutPreset],
  );

  const sorting = useMemo<SortingState>(
    () => [{ id: filters.sortBy, desc: filters.sortDirection === "desc" }],
    [filters.sortBy, filters.sortDirection],
  );

  const table = useReactTable({
    data: response.items,
    columns,
    pageCount: response.pageCount,
    state: { sorting },
    manualPagination: true,
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
  });

  function toggleSort(column: string) {
    const nextDirection = filters.sortBy === column && filters.sortDirection === "asc" ? "desc" : "asc";
    updateUrl({ sortBy: column, sortDirection: nextDirection, page: 1 });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">Learner Management</h1>
          <p className="mt-2 text-sm font-medium text-slate-500">Enterprise directory of global talent and learning progress.</p>
        </div>
        <div className="flex gap-2">
          <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
            <Button type="button" size="sm" variant={viewMode === "table" ? "secondary" : "ghost"} onClick={() => updateUrl({ view: undefined, page: 1 })}>
              <Rows3 className="mr-1 h-4 w-4" />
              Table
            </Button>
            <Button type="button" size="sm" variant={viewMode === "card" ? "secondary" : "ghost"} onClick={() => updateUrl({ view: "card", page: 1 })}>
              <LayoutGrid className="mr-1 h-4 w-4" />
              Cards
            </Button>
          </div>
          {viewMode === "card" ? (
            <select
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
              value={layoutPreset}
              onChange={(event) => updateUrl({ view: "card", layout: event.target.value, page: 1 })}
            >
              <option value="compact">Compact layout</option>
              <option value="balanced">Balanced layout</option>
              <option value="focus">Focus layout</option>
            </select>
          ) : null}
          <Button variant="secondary">Filter Repository</Button>
          <EnrollCandidateSheet />
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_200px_220px]">
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
                placeholder="Filter by name, learner ID, or email..."
              />
            </div>
            <Input value={filters.batchCode} onChange={(event) => updateUrl({ batchCode: event.target.value, page: 1 })} placeholder="Batch code" />
            <select
              className="h-10 rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700"
              value={filters.placementStatus ?? ""}
              onChange={(event) => updateUrl({ placementStatus: event.target.value || undefined, page: 1 })}
            >
              <option value="">All statuses</option>
              <option value="NOT_READY">Not Ready</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="PLACEMENT_READY">Placement Ready</option>
            </select>
          </div>

          {viewMode === "table" ? (
            <div className="overflow-hidden rounded-2xl border border-slate-100">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id} className={header.column.id === "actions" ? "text-right" : undefined}>
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length > 0 ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="py-10 text-center text-sm text-slate-500">
                        No learners matched the selected filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          ) : response.items.length > 0 ? (
            <FlexibleCardGrid preset={layoutPreset}>
              {response.items.map((learner, index) => {
                const nextQuery = createSearchParams({
                  search: filters.search,
                  batchCode: filters.batchCode,
                  placementStatus: filters.placementStatus,
                  sortBy: filters.sortBy,
                  sortDirection: filters.sortDirection,
                  page: response.page,
                  pageSize: response.pageSize,
                  view: "card",
                  layout: layoutPreset !== "balanced" ? layoutPreset : undefined,
                  id: learner.learnerCode,
                });

                return (
                  <FlexibleCardItem key={learner.id} span={resolveCardSpan(index, layoutPreset)}>
                    <Card className="h-full border-slate-200">
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-slate-900">{learner.fullName}</p>
                            <p className="text-[11px] text-slate-400">ID: {learner.learnerCode}</p>
                          </div>
                          <Badge variant={placementVariant(learner.placementStatus)}>{learner.readinessPercentage}%</Badge>
                        </div>

                        <div className="grid gap-2 text-sm">
                          <p>
                            <span className="font-semibold text-slate-900">Program:</span> {learner.programName ?? "Unassigned"}
                          </p>
                          <p>
                            <span className="font-semibold text-slate-900">Batch:</span> {learner.batchCode ?? "Pending"}
                          </p>
                          <p>
                            <span className="font-semibold text-slate-900">Attendance:</span> {learner.attendancePercentage.toFixed(1)}%
                          </p>
                          <p>
                            <span className="font-semibold text-slate-900">Avg Score:</span> {learner.averageScore.toFixed(0)}/100
                          </p>
                        </div>

                        <div className="flex justify-end">
                          <Button asChild variant="ghost" className="text-primary hover:text-primary">
                            <Link href={`/learners?${nextQuery}`} scroll={false}>
                              Open
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </FlexibleCardItem>
                );
              })}
            </FlexibleCardGrid>
          ) : (
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-8 text-center text-sm text-slate-500">No learners matched the selected filters.</div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Showing <span className="font-bold text-slate-900">{response.items.length}</span> of <span className="font-bold text-slate-900">{response.totalCount}</span> learners.
            </p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={response.page <= 1} onClick={() => updateUrl({ page: response.page - 1 })}>
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="min-w-24 text-center text-sm font-semibold text-slate-600">
                Page {response.page} / {response.pageCount}
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

function HeaderButton({ label, onClick, className }: { label: string; onClick: () => void; className?: string }) {
  return (
    <button className={`flex w-full items-center gap-2 ${className ?? ""}`} onClick={onClick} type="button">
      <span>{label}</span>
      <ArrowUpDown className="h-3.5 w-3.5" />
    </button>
  );
}