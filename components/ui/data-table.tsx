"use client";

import { useMemo, useState } from "react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/ui/can-access";
import { DataTableEmptyState } from "@/components/ui/data-table-empty-state";
import { DataTableFilterBar, type FilterConfig } from "@/components/ui/data-table-filter-bar";
import { DataTableFilterChips } from "@/components/ui/data-table-filter-chips";
import { DataTableLoadingState } from "@/components/ui/data-table-loading-state";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { DataTableSearchBar } from "@/components/ui/data-table-search-bar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DataTableColumn<TData> = {
  /** Object key to read from each row */
  key: string;
  /** Header label */
  label: string;
  /** Text alignment (default: "left") */
  align?: "left" | "center" | "right";
  /** Allow sorting on this column (default: inherits from table `sorting` prop) */
  sortable?: boolean;
  /** Custom cell renderer – receives the cell value and the full row */
  render?: (value: unknown, row: TData) => React.ReactNode;
  /** Extra className applied to both <th> and <td> */
  className?: string;
};

export type DataTableAction<TData> = {
  /** Menu item label */
  label: string;
  /** Optional leading icon */
  icon?: React.ComponentType<{ className?: string }>;
  /** Click handler – receives the row data */
  onClick: (row: TData) => void;
  /** RBAC permission required to see this action */
  permission?: string;
  /** Visual variant – "danger" renders text in red */
  variant?: "default" | "danger";
  /** Dynamic visibility per row */
  visible?: (row: TData) => boolean;
};

type PaginationConfig = {
  defaultPageSize?: number;
  pageSizes?: number[];
};

type EmptyStateConfig = {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
};

export type SortChangeEvent = {
  /** Column key being sorted */
  column: string;
  /** Sort direction */
  direction: "asc" | "desc";
} | null;

export type DataTableProps<TData> = {
  /** Column definitions */
  columns: DataTableColumn<TData>[];
  /** Row data – each object should contain the keys referenced by columns */
  data: TData[];
  /** Row action menu items (rendered in a dropdown at the end of each row) */
  actions?: DataTableAction<TData>[];
  /** Show skeleton loading state */
  loading?: boolean;
  /** Enable column sorting (default: true) */
  sorting?: boolean;
  /** Enable global search bar. Pass an object to customise the placeholder */
  search?: boolean | { placeholder?: string };
  /** Filter definitions – rendered above the table */
  filters?: FilterConfig[];
  /** Enable pagination. Pass an object to customise page sizes */
  pagination?: boolean | PaginationConfig;
  /** Customise the empty state message */
  emptyState?: EmptyStateConfig;
  /** Called when a row body cell is clicked */
  onRowClick?: (row: TData) => void;
  /** Called when the sort state changes – emits current sort or null when cleared */
  onSortChange?: (sort: SortChangeEvent) => void;
  /** Stick the header row while scrolling (default: true) */
  stickyHeader?: boolean;
  /** Extra className on the outermost wrapper */
  className?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_PAGE_SIZES = [10, 25, 50, 100];

function alignClass(align?: "left" | "center" | "right") {
  if (align === "center") return "text-center";
  if (align === "right") return "text-right";
  return "text-left";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DataTable<TData extends Record<string, unknown>>({
  columns,
  data,
  actions,
  loading = false,
  sorting: sortingEnabled = true,
  search,
  filters,
  pagination,
  emptyState,
  onRowClick,
  onSortChange,
  stickyHeader = true,
  className,
}: DataTableProps<TData>) {
  // ---- Search state ----
  const [globalFilter, setGlobalFilter] = useState("");

  // ---- Filter state ----
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  // ---- Sorting state ----
  const [sortingState, setSortingState] = useState<SortingState>([]);

  // ---- Pagination config ----
  const paginationEnabled = !!pagination;
  const paginationConfig: PaginationConfig =
    typeof pagination === "object" ? pagination : {};
  const pageSize = paginationConfig.defaultPageSize ?? DEFAULT_PAGE_SIZE;
  const pageSizes = paginationConfig.pageSizes ?? DEFAULT_PAGE_SIZES;

  // ---- Search config ----
  const searchEnabled = !!search;
  const searchPlaceholder =
    typeof search === "object" ? search.placeholder : undefined;

  // ---- Build TanStack columns from simple config ----
  const hasActions = actions && actions.length > 0;

  const tanstackColumns = useMemo<ColumnDef<TData>[]>(() => {
    const cols: ColumnDef<TData>[] = columns.map((col) => ({
      id: col.key,
      accessorFn: (row: TData) => row[col.key],
      header: ({ column }) => {
        const isSortable =
          col.sortable !== undefined ? col.sortable : sortingEnabled;
        if (!isSortable) return col.label;

        const sorted = column.getIsSorted();
        return (
          <button
            type="button"
            className="inline-flex items-center gap-1 hover:text-slate-600"
            onClick={() => column.toggleSorting()}
          >
            {col.label}
            {sorted === "asc" ? (
              <ArrowUp className="h-3 w-3" />
            ) : sorted === "desc" ? (
              <ArrowDown className="h-3 w-3" />
            ) : (
              <ArrowUpDown className="h-3 w-3 opacity-40" />
            )}
          </button>
        );
      },
      cell: ({ row }) => {
        const value = row.original[col.key];
        if (col.render) return col.render(value, row.original);
        return value != null ? String(value) : "—";
      },
      enableSorting:
        col.sortable !== undefined ? col.sortable : sortingEnabled,
      meta: { align: col.align, className: col.className },
    }));

    if (hasActions) {
      cols.push({
        id: "__actions",
        header: () => null,
        enableSorting: false,
        cell: ({ row }) => <RowActions row={row.original} actions={actions} />,
        meta: { align: "right" as const, className: "w-12" },
      });
    }

    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, hasActions, sortingEnabled]);

  // ---- Client-side filter function ----
  const filteredData = useMemo(() => {
    if (!filters || Object.values(filterValues).every((v) => !v)) return data;

    return data.filter((row) =>
      filters.every((f) => {
        const fv = filterValues[f.key];
        if (!fv) return true;
        const cellValue = String(row[f.key] ?? "");
        if (f.type === "select") return cellValue === fv;
        return cellValue.toLowerCase().includes(fv.toLowerCase());
      }),
    );
  }, [data, filters, filterValues]);

  // ---- Table instance ----
  const table = useReactTable({
    data: filteredData,
    columns: tanstackColumns,
    state: {
      sorting: sortingState,
      globalFilter,
    },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sortingState) : updater;
      setSortingState(next);
      if (onSortChange) {
        if (next.length > 0) {
          onSortChange({ column: next[0].id, direction: next[0].desc ? "desc" : "asc" });
        } else {
          onSortChange(null);
        }
      }
    },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(paginationEnabled ? { getPaginationRowModel: getPaginationRowModel() } : {}),
    initialState: {
      pagination: { pageSize },
    },
  });

  const totalColumns = columns.length + (hasActions ? 1 : 0);

  // ---- Loading skeleton ----
  if (loading) {
    return (
      <DataTableLoadingState
        columnCount={totalColumns}
        className={className}
      />
    );
  }

  // ---- Render ----
  return (
    <div className={cn("space-y-4", className)}>
      {/* Toolbar: search + filters */}
      {(searchEnabled || (filters && filters.length > 0)) && (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {searchEnabled && (
              <DataTableSearchBar
                value={globalFilter}
                onChange={setGlobalFilter}
                placeholder={searchPlaceholder}
                className="w-full sm:max-w-xs"
              />
            )}
            {filters && filters.length > 0 && (
              <DataTableFilterBar
                filters={filters}
                values={filterValues}
                onChange={(key, value) =>
                  setFilterValues((prev) => ({ ...prev, [key]: value }))
                }
                onReset={() => setFilterValues({})}
              />
            )}
          </div>
          {filters && filters.length > 0 && (
            <DataTableFilterChips
              filters={filters}
              values={filterValues}
              onRemove={(key) =>
                setFilterValues((prev) => ({ ...prev, [key]: "" }))
              }
            />
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-100">
        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <TableHeader
              className={cn(
                "bg-slate-50/80",
                stickyHeader && "sticky-admin-table-header",
              )}
            >
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const meta = header.column.columnDef.meta as
                      | { align?: string; className?: string }
                      | undefined;
                    return (
                      <TableHead
                        key={header.id}
                        className={cn(
                          alignClass(meta?.align as "left" | "center" | "right"),
                          meta?.className,
                        )}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={cn(onRowClick && "cursor-pointer")}
                    onClick={() => onRowClick?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta as
                        | { align?: string; className?: string }
                        | undefined;
                      return (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            alignClass(meta?.align as "left" | "center" | "right"),
                            meta?.className,
                          )}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={totalColumns} className="h-48 text-center">
                    <DataTableEmptyState {...emptyState} className="border-0 bg-transparent" />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {paginationEnabled && (
        <DataTablePagination
          currentPage={table.getState().pagination.pageIndex}
          pageCount={table.getPageCount()}
          totalRows={table.getFilteredRowModel().rows.length}
          visibleRows={table.getRowModel().rows.length}
          pageSize={table.getState().pagination.pageSize}
          pageSizes={pageSizes}
          onPageChange={(page) => table.setPageIndex(page)}
          onPageSizeChange={(size) => {
            table.setPageSize(size);
            table.setPageIndex(0);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row Actions Dropdown (internal)
// ---------------------------------------------------------------------------

function RowActions<TData>({
  row,
  actions,
}: {
  row: TData;
  actions: DataTableAction<TData>[];
}) {
  const visibleActions = actions.filter(
    (a) => !a.visible || a.visible(row),
  );

  if (visibleActions.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {visibleActions.map((action) => {
          const item = (
            <DropdownMenuItem
              key={action.label}
              className={cn(
                action.variant === "danger" && "text-rose-600 focus:text-rose-700",
              )}
              onClick={(e) => {
                e.stopPropagation();
                action.onClick(row);
              }}
            >
              {action.icon && (
                <action.icon className="mr-2 h-4 w-4" />
              )}
              {action.label}
            </DropdownMenuItem>
          );

          if (action.permission) {
            return (
              <CanAccess key={action.label} permission={action.permission}>
                {item}
              </CanAccess>
            );
          }

          return item;
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
