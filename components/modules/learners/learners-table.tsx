"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, LayoutGrid, MoreHorizontal, Rows3 } from "lucide-react";
import { ColumnDef, SortingState, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTableSearchBar } from "@/components/ui/data-table-search-bar";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { DataTableEmptyState } from "@/components/ui/data-table-empty-state";
import { DataTableFilterBar, type FilterConfig } from "@/components/ui/data-table-filter-bar";
import { DataTableFilterChips } from "@/components/ui/data-table-filter-chips";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CardLayoutPreset, FlexibleCardGrid, FlexibleCardItem, parseCardLayoutPreset } from "@/components/ui/flexible-card-layout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EnrollCandidateSheet } from "@/components/modules/learners/enroll-candidate-sheet";
import { CanAccess } from "@/components/ui/can-access";
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

const learnerFilterConfigs: FilterConfig[] = [
  {
    key: "batchCode",
    label: "Batch Code",
    type: "text",
  },
  {
    key: "placementStatus",
    label: "Placement Status",
    type: "select",
    options: [
      { label: "Not Ready", value: "NOT_READY" },
      { label: "In Review", value: "IN_REVIEW" },
      { label: "Placement Ready", value: "PLACEMENT_READY" },
    ],
  },
];

export function LearnersTable({ response, filters }: LearnersTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(filters.search);
  const activeSort = filters.sortBy || "fullName";
  const activeDirection = filters.sortDirection === "desc" ? "desc" : "asc";
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
        header: () => <HeaderButton label="Learner Profile" columnKey="fullName" activeSort={activeSort} activeDirection={activeDirection} onClick={() => toggleSort("fullName")} />,
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
        header: () => <HeaderButton label="Attend. %" columnKey="attendancePercentage" activeSort={activeSort} activeDirection={activeDirection} onClick={() => toggleSort("attendancePercentage")} className="justify-center" />,
        cell: ({ row }) => <div className="text-center font-black text-emerald-600">{row.original.attendancePercentage.toFixed(1)}%</div>,
      },
      {
        accessorKey: "averageScore",
        header: () => <HeaderButton label="Avg Score" columnKey="averageScore" activeSort={activeSort} activeDirection={activeDirection} onClick={() => toggleSort("averageScore")} className="justify-center" />,
        cell: ({ row }) => <div className="text-center font-black text-slate-900">{row.original.averageScore.toFixed(0)}/100</div>,
      },
      {
        accessorKey: "placementStatus",
        header: () => <HeaderButton label="Readiness" columnKey="readinessPercentage" activeSort={activeSort} activeDirection={activeDirection} onClick={() => toggleSort("readinessPercentage")} className="justify-center" />,
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
          const openQuery = createSearchParams({
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

          const editQuery = createSearchParams({
            search: filters.search,
            batchCode: filters.batchCode,
            placementStatus: filters.placementStatus,
            sortBy: filters.sortBy,
            sortDirection: filters.sortDirection,
            page: response.page,
            pageSize: response.pageSize,
            view: viewMode === "card" ? "card" : undefined,
            layout: viewMode === "card" && layoutPreset !== "balanced" ? layoutPreset : undefined,
            edit: row.original.learnerCode,
          });

          return (
            <div className="flex items-center justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9">
                    <MoreHorizontal className="h-5 w-5" />
                    <span className="sr-only">Open actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <CanAccess permission="users.edit">
                    <DropdownMenuItem asChild>
                      <Link href={`/learners?${editQuery}`} scroll={false}>
                        Edit
                      </Link>
                    </DropdownMenuItem>
                  </CanAccess>
                  <DropdownMenuItem asChild>
                    <Link href={`/learners?${openQuery}`} scroll={false}>
                      Open
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [activeDirection, activeSort, filters.batchCode, filters.placementStatus, filters.search, filters.sortBy, filters.sortDirection, response.page, response.pageSize, viewMode, layoutPreset],
  );

  const sorting = useMemo<SortingState>(
    () => [{ id: activeSort, desc: activeDirection === "desc" }],
    [activeDirection, activeSort],
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
          <CanAccess permission="users.create">
            <EnrollCandidateSheet />
          </CanAccess>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3">
            <DataTableSearchBar
              value={search}
              onChange={(nextSearch) => {
                setSearch(nextSearch);
                updateUrl({ search: nextSearch, page: 1 });
              }}
              placeholder="Filter by name, learner ID, or email..."
              debounceMs={0}
              className="max-w-sm"
            />
            <DataTableFilterBar
              filters={learnerFilterConfigs}
              values={{ batchCode: filters.batchCode, placementStatus: filters.placementStatus ?? "" }}
              onChange={(key, value) => updateUrl({ [key]: value || undefined, page: 1 })}
              onReset={() => updateUrl({ batchCode: undefined, placementStatus: undefined, page: 1 })}
            />
            <DataTableFilterChips
              filters={learnerFilterConfigs}
              values={{ batchCode: filters.batchCode, placementStatus: filters.placementStatus ?? "" }}
              onRemove={(key) => updateUrl({ [key]: undefined, page: 1 })}
            />
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
                      <TableCell colSpan={columns.length} className="p-0">
                        <DataTableEmptyState title="No learners matched the selected filters." />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          ) : response.items.length > 0 ? (
            <FlexibleCardGrid preset={layoutPreset}>
              {response.items.map((learner, index) => {
                const openQuery = createSearchParams({
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

                const editQuery = createSearchParams({
                  search: filters.search,
                  batchCode: filters.batchCode,
                  placementStatus: filters.placementStatus,
                  sortBy: filters.sortBy,
                  sortDirection: filters.sortDirection,
                  page: response.page,
                  pageSize: response.pageSize,
                  view: "card",
                  layout: layoutPreset !== "balanced" ? layoutPreset : undefined,
                  edit: learner.learnerCode,
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

                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" className="text-slate-600 hover:text-slate-900">
                            <Link href={`/learners?${editQuery}`} scroll={false}>
                              Edit
                            </Link>
                          </Button>
                          <Button asChild variant="ghost" className="text-primary hover:text-primary">
                            <Link href={`/learners?${openQuery}`} scroll={false}>
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
            <DataTableEmptyState title="No learners matched the selected filters." />
          )}

          <DataTablePagination
            currentPage={response.page - 1}
            pageCount={response.pageCount}
            totalRows={response.totalCount}
            visibleRows={response.items.length}
            pageSize={response.pageSize}
            pageSizes={[10, 25, 50, 100]}
            onPageChange={(page) => updateUrl({ page: page + 1 })}
            onPageSizeChange={(size) => updateUrl({ pageSize: size, page: 1 })}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function HeaderButton({ label, columnKey, activeSort, activeDirection, onClick, className }: { label: string; columnKey: string; activeSort: string; activeDirection: string; onClick: () => void; className?: string }) {
  const isActive = activeSort === columnKey;
  return (
    <button className={`flex w-full items-center gap-2 ${className ?? ""}`} onClick={onClick} type="button">
      <span>{label}</span>
      {isActive && activeDirection === "asc" ? (
        <ArrowUp className="h-3.5 w-3.5" />
      ) : isActive && activeDirection === "desc" ? (
        <ArrowDown className="h-3.5 w-3.5" />
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
      )}
    </button>
  );
}