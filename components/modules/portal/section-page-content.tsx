"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, Download, LayoutGrid, MoreHorizontal, Rows3 } from "lucide-react";
import { ColumnDef, ColumnFiltersState, SortingState, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableSearchBar } from "@/components/ui/data-table-search-bar";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { DataTableFilterBar, type FilterConfig } from "@/components/ui/data-table-filter-bar";
import { DataTableFilterChips } from "@/components/ui/data-table-filter-chips";
import { DataTableEmptyState } from "@/components/ui/data-table-empty-state";
import { SavedFilterPresetsMenu } from "@/components/ui/saved-filter-presets-menu";
import { BatchDetailSheet } from "@/components/modules/batches/batch-detail-sheet";
import { BatchEnrollmentSheet } from "@/components/modules/batches/batch-enrollment-sheet";
import { EditBatchSheet } from "@/components/modules/batches/edit-batch-sheet";
import { AddCenterSheet } from "@/components/modules/centers/add-center-sheet";
import { CenterDetailSheet } from "@/components/modules/centers/center-detail-sheet";
import { EditCenterSheet } from "@/components/modules/centers/edit-center-sheet";
import { AddCourseSheet } from "@/components/modules/courses/add-course-sheet";
import { CourseDetailSheet } from "@/components/modules/courses/course-detail-sheet";
import { EditCourseSheet } from "@/components/modules/courses/edit-course-sheet";
import { AddEmailTemplateSheet } from "@/components/modules/email-templates/add-email-template-sheet";
import { EditEmailTemplateSheet } from "@/components/modules/email-templates/edit-email-template-sheet";
import { EmailTemplateDetailSheet } from "@/components/modules/email-templates/email-template-detail-sheet";
import { TemplateHistorySheet } from "@/components/modules/email-templates/template-history-sheet";
import { TemplateVariableLegend } from "@/components/modules/email-templates/template-variable-legend";
import { ProgramDetailSheet } from "@/components/modules/programs/program-detail-sheet";
import { EditProgramSheet } from "@/components/modules/programs/edit-program-sheet";
import { TrainerDetailSheet } from "@/components/modules/trainers/trainer-detail-sheet";
import { EditTrainerSheet } from "@/components/modules/trainers/edit-trainer-sheet";
import { AddTrainerSheet } from "@/components/modules/trainers/add-trainer-sheet";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CreateBatchSheet } from "@/components/modules/batches/create-batch-sheet";
import { AddProgramSheet } from "@/components/modules/programs/add-program-sheet";
import { LanguageLabSection } from "@/components/modules/language-lab/language-lab-section";
import { LogsActionsSection } from "@/components/modules/logs-actions/logs-actions-section";
import { ScheduleSection } from "@/components/modules/schedule/schedule-section";
import { TrainerSessionsSection } from "@/components/modules/schedule/trainer-sessions-section";
import { TableColumnVisibilityMenu } from "@/components/ui/table-column-visibility-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CardLayoutPreset, FlexibleCardGrid, FlexibleCardItem, parseCardLayoutPreset } from "@/components/ui/flexible-card-layout";
import { CanAccess } from "@/components/ui/can-access";
import { usePersistedTablePreferences } from "@/hooks/use-persisted-table-preferences";
import { useSavedFilterPresets } from "@/hooks/use-saved-filter-presets";
import { getSectionFilterConfigs } from "@/lib/constants/section-filters";
import { cn } from "@/lib/utils";
import { PortalSectionContent, PortalSectionTableColumn, PortalSectionTableRow } from "@/types";

type SectionPageContentProps = {
  section: PortalSectionContent;
  sectionKey?: string;
};

type ViewMode = "table" | "card";

const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_TABLE_PAGE_SIZES = [10, 25, 50, 100];
const MAX_FILTER_OPTIONS = 15;

function deriveFilterConfigs(rows: PortalSectionTableRow[], columns: PortalSectionTableColumn[]): FilterConfig[] {
  const configs: FilterConfig[] = [];

  for (const column of columns) {
    if (column.key === "id") continue;
    const uniqueValues = new Set<string>();
    for (const row of rows) {
      const value = row[column.key];
      if (value) uniqueValues.add(value);
    }
    if (uniqueValues.size >= 2 && uniqueValues.size <= MAX_FILTER_OPTIONS) {
      configs.push({
        key: column.key,
        label: column.header,
        type: "select",
        options: Array.from(uniqueValues).sort().map((v) => ({ label: v, value: v })),
      });
    }
  }

  return configs;
}

export function SectionPageContent({ section, sectionKey }: SectionPageContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // URL-driven initial state
  const initialSearch = searchParams.get("search") ?? "";
  const initialPageSize = Number(searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE;
  const initialPage = Math.max(0, Number(searchParams.get("page")) - 1 || 0);

  const [sorting, setSorting] = useState<SortingState>(() => {
    const sortBy = searchParams.get("sortBy");
    const sortDir = searchParams.get("sortDir");
    if (sortBy) return [{ id: sortBy, desc: sortDir === "desc" }];
    return [];
  });
  const [globalFilter, setGlobalFilter] = useState(initialSearch);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() => {
    const initial: ColumnFiltersState = [];
    searchParams.forEach((value, key) => {
      if (key.startsWith("filter_") && value) {
        initial.push({ id: key.slice(7), value });
      }
    });
    return initial;
  });
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [viewingCourseId, setViewingCourseId] = useState<string | null>(null);
  const [viewingBatchId, setViewingBatchId] = useState<string | null>(null);
  const [viewingCenterId, setViewingCenterId] = useState<string | null>(null);
  const [viewingProgramId, setViewingProgramId] = useState<string | null>(null);
  const [viewingTrainerId, setViewingTrainerId] = useState<string | null>(null);
  const [viewingEmailTemplateId, setViewingEmailTemplateId] = useState<string | null>(null);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editingCenterId, setEditingCenterId] = useState<string | null>(null);
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [editingTrainerId, setEditingTrainerId] = useState<string | null>(null);
  const [editingEmailTemplateId, setEditingEmailTemplateId] = useState<string | null>(null);
  const [historyTemplateId, setHistoryTemplateId] = useState<string | null>(null);
  const [historyTemplateName, setHistoryTemplateName] = useState<string | null>(null);
  const [studentsBatch, setStudentsBatch] = useState<{ id: string; code: string } | null>(null);
  const [exportingBatchId, setExportingBatchId] = useState<string | null>(null);
  const [batchActionError, setBatchActionError] = useState<string | null>(null);
  const viewMode: ViewMode = searchParams.get("view") === "card" ? "card" : "table";
  const layoutPreset = parseCardLayoutPreset(searchParams.get("layout"));
  const isEmailTemplatesSection = sectionKey === "settings" || sectionKey === "email-templates";
  const hasDetailActions = sectionKey === "courses" || sectionKey === "batches" || sectionKey === "centers" || sectionKey === "programs" || sectionKey === "trainers" || isEmailTemplatesSection;

  const editPermForSection =
    sectionKey === "courses" ? "courses.edit" :
    sectionKey === "batches" ? "batches.edit" :
    sectionKey === "centers" ? "centers.edit" :
    sectionKey === "programs" ? "programs.edit" :
    sectionKey === "trainers" ? "trainers.edit" :
    isEmailTemplatesSection ? "email_templates.edit" :
    undefined;

  const createPermForSection =
    sectionKey === "courses" ? "courses.create" :
    sectionKey === "batches" ? "batches.create" :
    sectionKey === "centers" ? "centers.create" :
    sectionKey === "programs" ? "programs.create" :
    sectionKey === "trainers" ? "trainers.create" :
    isEmailTemplatesSection ? "email_templates.create" :
    undefined;

  const emailTemplateKeys = useMemo(
    () => (isEmailTemplatesSection
      ? section.tableRows.reduce<string[]>((keys, row) => {
          if (row.key) {
            keys.push(row.key);
          }
          return keys;
        }, [])
      : []),
    [isEmailTemplatesSection, section.tableRows],
  );
  const tablePreferenceKey = useMemo(() => {
    if (isEmailTemplatesSection) {
      return "portal:email-templates";
    }

    if (sectionKey) {
      return `portal:${sectionKey}`;
    }

    return `portal:${section.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  }, [isEmailTemplatesSection, section.title, sectionKey]);
  const tableColumnOptions = useMemo(
    () => section.tableColumns.map((column) => ({ key: column.key, label: column.header })),
    [section.tableColumns],
  );
  const {
    preferences,
    hasLoadedPreferences,
    visibleColumnIds,
    setPageSize: persistPageSize,
    toggleColumnVisibility,
    resetPreferences,
  } = usePersistedTablePreferences({
    tableKey: tablePreferenceKey,
    defaultPageSize: initialPageSize,
    pageSizes: DEFAULT_TABLE_PAGE_SIZES,
    columnIds: tableColumnOptions.map((column) => column.key),
  });

  // Auto-derive filterable columns from data, then merge with curated configs
  const filterConfigs = useMemo(() => {
    const derived = deriveFilterConfigs(section.tableRows, section.tableColumns);
    const curated = getSectionFilterConfigs(sectionKey ?? "");
    if (!curated) return derived;

    // Curated filters take priority; append any auto-derived filters not already covered
    const curatedKeys = new Set(curated.map((f) => f.key));
    return [...curated, ...derived.filter((f) => !curatedKeys.has(f.key))];
  }, [section.tableRows, section.tableColumns, sectionKey]);

  // Column filter values as a flat map (for bar/chips)
  const columnFilterValues = useMemo(() => {
    const map: Record<string, string> = {};
    for (const cf of columnFilters) {
      map[cf.id] = String(cf.value);
    }
    return map;
  }, [columnFilters]);

  // Saved filter presets
  const { presets: savedPresets, savePreset, deletePreset: deleteFilterPreset } = useSavedFilterPresets(tablePreferenceKey);

  // URL state sync
  const updateUrl = useCallback(
    (patch: Record<string, string | number | null | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(patch).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      });
      startTransition(() => {
        const qs = next.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [searchParams, pathname, router],
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setGlobalFilter(value);
      updateUrl({ search: value || null, page: null });
    },
    [updateUrl],
  );

  const handleColumnFilterChange = useCallback(
    (key: string, value: string) => {
      setColumnFilters((prev) => {
        const without = prev.filter((f) => f.id !== key);
        return value ? [...without, { id: key, value }] : without;
      });
      updateUrl({ [`filter_${key}`]: value || null, page: null });
    },
    [updateUrl],
  );

  const handleColumnFilterReset = useCallback(() => {
    setColumnFilters([]);
    const patch: Record<string, null> = {};
    for (const f of filterConfigs) {
      patch[`filter_${f.key}`] = null;
    }
    patch.page = null;
    updateUrl(patch);
  }, [filterConfigs, updateUrl]);

  const handleColumnFilterRemove = useCallback(
    (key: string) => handleColumnFilterChange(key, ""),
    [handleColumnFilterChange],
  );

  const handleApplyFilterPreset = useCallback(
    (filters: Record<string, string>) => {
      const nextFilters: ColumnFiltersState = [];
      const urlPatch: Record<string, string | null> = { page: null };

      // Clear all existing filter_ params
      for (const f of filterConfigs) {
        urlPatch[`filter_${f.key}`] = null;
      }

      // Apply preset filters
      for (const [key, value] of Object.entries(filters)) {
        if (value) {
          nextFilters.push({ id: key, value });
          urlPatch[`filter_${key}`] = value;
        }
      }

      setColumnFilters(nextFilters);
      updateUrl(urlPatch);
    },
    [filterConfigs, updateUrl],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      table.setPageIndex(page);
      updateUrl({ page: page > 0 ? page + 1 : null });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateUrl],
  );

  const handlePageSizeChange = useCallback(
    (size: number) => {
      persistPageSize(size);
      setPageSize(size);
      table.setPageSize(size);
      table.setPageIndex(0);
      updateUrl({ pageSize: size !== DEFAULT_PAGE_SIZE ? size : null, page: null });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persistPageSize, updateUrl],
  );

  useEffect(() => {
    const viewId = searchParams.get("viewId");
    const editId = searchParams.get("editId");

    // Reset all viewer/editor states first
    setViewingCourseId(null);
    setViewingBatchId(null);
    setViewingCenterId(null);
    setViewingProgramId(null);
    setViewingTrainerId(null);
    setViewingEmailTemplateId(null);
    setEditingCourseId(null);
    setEditingBatchId(null);
    setEditingCenterId(null);
    setEditingProgramId(null);
    setEditingTrainerId(null);
    setEditingEmailTemplateId(null);

    if (viewId) {
      if (sectionKey === "courses") {
        setViewingCourseId(viewId);
      } else if (sectionKey === "batches") {
        setViewingBatchId(viewId);
      } else if (sectionKey === "centers") {
        setViewingCenterId(viewId);
      } else if (sectionKey === "programs") {
        setViewingProgramId(viewId);
      } else if (sectionKey === "trainers") {
        setViewingTrainerId(viewId);
      } else if (isEmailTemplatesSection) {
        setViewingEmailTemplateId(viewId);
      }

      return;
    }

    if (editId) {
      if (sectionKey === "courses") {
        setEditingCourseId(editId);
      } else if (sectionKey === "batches") {
        setEditingBatchId(editId);
      } else if (sectionKey === "centers") {
        setEditingCenterId(editId);
      } else if (sectionKey === "programs") {
        setEditingProgramId(editId);
      } else if (sectionKey === "trainers") {
        setEditingTrainerId(editId);
      } else if (isEmailTemplatesSection) {
        setEditingEmailTemplateId(editId);
      }
    }
  }, [isEmailTemplatesSection, searchParams, sectionKey]);

  const setParam = useCallback((key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("viewId");
    next.delete("editId");
    if (value) next.set(key, value);
    startTransition(() => {
      const queryString = next.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    });
  }, [pathname, router, searchParams]);

  const setViewMode = (nextMode: ViewMode) => {
    const next = new URLSearchParams(searchParams.toString());
    if (nextMode === "table") {
      next.delete("view");
      next.delete("layout");
    } else {
      next.set("view", "card");
    }
    startTransition(() => {
      const queryString = next.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    });
  };

  const setLayoutPreset = (nextPreset: CardLayoutPreset) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("view", "card");
    if (nextPreset === "balanced") {
      next.delete("layout");
    } else {
      next.set("layout", nextPreset);
    }
    startTransition(() => {
      const queryString = next.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
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

  const openViewer = useCallback((id: string) => setParam("viewId", id), [setParam]);
  const openEditor = useCallback((id: string) => setParam("editId", id), [setParam]);
  const closePanel = useCallback(() => setParam("viewId", null), [setParam]);
  const closeEditor = useCallback(() => setParam("editId", null), [setParam]);

  const openStudentsPopup = useCallback((row: PortalSectionTableRow) => {
    const batchCode = row.code;
    if (!batchCode) {
      return;
    }

    setBatchActionError(null);
    setStudentsBatch({ id: row.id, code: batchCode });
  }, []);

  const exportBatchCsv = useCallback(async (row: PortalSectionTableRow) => {
    setBatchActionError(null);
    setExportingBatchId(row.id);

    try {
      const response = await fetch(`/api/batches/${row.id}/export`, { cache: "no-store" });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to export batch CSV.");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition");
      const match = disposition?.match(/filename=\"?([^\";]+)\"?/i);
      const filename = match?.[1] ?? `${row.code.toLowerCase()}-enrollments.csv`;

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (exportError) {
      setBatchActionError(exportError instanceof Error ? exportError.message : "Failed to export batch CSV.");
    } finally {
      setExportingBatchId(null);
    }
  }, []);

  const handleDuplicateTemplate = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/email-templates/${id}/duplicate`, { method: "POST" });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(payload?.error ?? "Failed to duplicate template.");
      router.refresh();
    } catch (err) {
      console.error(err);
    }
  }, [router]);

  const handleDeleteTemplate = useCallback(async (row: PortalSectionTableRow) => {
    if (row.isSystem === "true") return;
    if (!confirm(`Delete template "${row.name}"? This action cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/email-templates/${row.id}`, { method: "DELETE" });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(payload?.error ?? "Failed to delete template.");
      router.refresh();
    } catch (err) {
      console.error(err);
    }
  }, [router]);

  const handleToggleTemplateStatus = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/email-templates/${id}/toggle-status`, { method: "PATCH" });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(payload?.error ?? "Failed to toggle template status.");
      router.refresh();
    } catch (err) {
      console.error(err);
    }
  }, [router]);

  const openTemplateHistory = useCallback((row: PortalSectionTableRow) => {
    setHistoryTemplateId(row.id);
    setHistoryTemplateName(row.name);
  }, []);

  const columns = useMemo<ColumnDef<PortalSectionTableRow>[]>(
    () => {
      const baseColumns: ColumnDef<PortalSectionTableRow>[] = section.tableColumns.map((column) => ({
        accessorKey: column.key,
        header: () => <HeaderButton label={column.header} />,
        cell: ({ row }) => renderCell(row.original[column.key], column),
      }));

      if (hasDetailActions) {
        baseColumns.push({
          id: "actions",
          header: () => <div className="text-right">Actions</div>,
          cell: ({ row }) => (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9">
                    <MoreHorizontal className="h-5 w-5" />
                    <span className="sr-only">Open actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => openViewer(row.original.id)}>View</DropdownMenuItem>
                  <CanAccess permission={editPermForSection}>
                    <DropdownMenuItem onSelect={() => openEditor(row.original.id)}>Edit</DropdownMenuItem>
                  </CanAccess>
                  {isEmailTemplatesSection ? (
                    <>
                      <CanAccess permission="email_templates.edit">
                        <DropdownMenuItem onSelect={() => void handleToggleTemplateStatus(row.original.id)}>
                          {row.original.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                      </CanAccess>
                      <CanAccess permission="email_templates.create">
                        <DropdownMenuItem onSelect={() => void handleDuplicateTemplate(row.original.id)}>Duplicate</DropdownMenuItem>
                      </CanAccess>
                      <DropdownMenuItem onSelect={() => openTemplateHistory(row.original)}>History</DropdownMenuItem>
                      {row.original.isSystem !== "true" ? (
                        <CanAccess permission="email_templates.delete">
                          <DropdownMenuItem onSelect={() => void handleDeleteTemplate(row.original)} className="text-rose-600">Delete</DropdownMenuItem>
                        </CanAccess>
                      ) : null}
                    </>
                  ) : null}
                  {sectionKey === "batches" ? (
                    <CanAccess permission="batches.edit">
                      <DropdownMenuItem onSelect={() => void openStudentsPopup(row.original)}>Students</DropdownMenuItem>
                    </CanAccess>
                  ) : null}
                  {sectionKey === "batches" ? (
                    <DropdownMenuItem onSelect={() => void exportBatchCsv(row.original)} disabled={exportingBatchId === row.original.id}>
                      {exportingBatchId === row.original.id ? "Exporting" : "Export"}
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ),
        });
      }

    return baseColumns;
  },
  [
    editPermForSection,
    exportBatchCsv,
    exportingBatchId,
    handleDeleteTemplate,
    handleDuplicateTemplate,
    handleToggleTemplateStatus,
    hasDetailActions,
    isEmailTemplatesSection,
    openEditor,
    openStudentsPopup,
    openTemplateHistory,
    openViewer,
    section.tableColumns,
    sectionKey,
  ],
  );

  const table = useReactTable({
    data: section.tableRows,
    columns,
    state: {
      sorting,
      globalFilter,
      columnFilters,
      columnVisibility: {
        ...Object.fromEntries(
          tableColumnOptions.map((column) => [column.key, !preferences.hiddenColumnIds.includes(column.key)]),
        ),
        actions: true,
      },
    },
    onSortingChange: (updater) => {
      setSorting(updater);
      const next = typeof updater === "function" ? updater(sorting) : updater;
      if (next.length > 0) {
        updateUrl({ sortBy: next[0].id, sortDir: next[0].desc ? "desc" : "asc" });
      } else {
        updateUrl({ sortBy: null, sortDir: null });
      }
    },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    initialState: {
      pagination: {
        pageIndex: initialPage,
        pageSize,
      },
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  useEffect(() => {
    if (!hasLoadedPreferences || searchParams.has("pageSize") || preferences.pageSize === pageSize) {
      return;
    }

    handlePageSizeChange(preferences.pageSize);
  }, [handlePageSizeChange, hasLoadedPreferences, pageSize, preferences.pageSize, searchParams]);

  if (sectionKey === "logs-actions") {
    return <LogsActionsSection title={section.title} description={section.description} />;
  }

  if (sectionKey === "schedule") {
    return <ScheduleSection title={section.title} description={section.description} />;
  }

  if (sectionKey === "trainer-sessions") {
    return <TrainerSessionsSection />;
  }

  if (sectionKey === "language-lab") {
    return <LanguageLabSection title={section.title} description={section.description} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">{section.title}</h1>
          <p className="mt-2 max-w-3xl text-sm font-medium text-slate-500">{section.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
            <Button type="button" size="sm" variant={viewMode === "table" ? "secondary" : "ghost"} onClick={() => setViewMode("table")}>
              <Rows3 className="mr-1 h-4 w-4" />
              Table
            </Button>
            <Button type="button" size="sm" variant={viewMode === "card" ? "secondary" : "ghost"} onClick={() => setViewMode("card")}>
              <LayoutGrid className="mr-1 h-4 w-4" />
              Cards
            </Button>
          </div>
          {viewMode === "card" ? (
            <select
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
              value={layoutPreset}
              onChange={(event) => setLayoutPreset(event.target.value as CardLayoutPreset)}
            >
              <option value="compact">Compact layout</option>
              <option value="balanced">Balanced layout</option>
              <option value="focus">Focus layout</option>
            </select>
          ) : null}
          <Badge variant="accent">{section.accent}</Badge>
          <Button variant="secondary">{section.secondaryAction}</Button>
          <CanAccess permission={createPermForSection}>
            {sectionKey === "courses" ? (
              <AddCourseSheet />
            ) : sectionKey === "programs" ? (
              <AddProgramSheet />
            ) : sectionKey === "batches" ? (
              <CreateBatchSheet />
            ) : sectionKey === "centers" ? (
              <AddCenterSheet />
            ) : sectionKey === "trainers" ? (
              <AddTrainerSheet />
            ) : isEmailTemplatesSection ? (
              <AddEmailTemplateSheet existingTemplateKeys={emailTemplateKeys} />
            ) : (
              <Button>{section.primaryAction}</Button>
            )}
          </CanAccess>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {section.metrics.map((metric) => (
          <Card key={metric.label} className="shadow-none">
            <CardContent className="min-w-0 space-y-2 p-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase leading-4 tracking-[0.16em] text-slate-400 break-words">{metric.label}</p>
                <p className="mt-1 break-words text-2xl font-extrabold leading-tight text-slate-950 sm:text-3xl">{metric.value}</p>
              </div>
              <p className="break-words text-xs leading-5 text-slate-500">{metric.helper}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6">
        {batchActionError ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{batchActionError}</p> : null}
        {isEmailTemplatesSection && <TemplateVariableLegend />}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>{section.tableTitle}</CardTitle>
                <CardDescription>{section.tableDescription}</CardDescription>
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                <DataTableSearchBar
                  value={globalFilter}
                  onChange={handleSearchChange}
                  placeholder={`Search ${section.tableTitle.toLowerCase()}…`}
                  className="w-full sm:w-64"
                />
                {viewMode === "table" ? (
                  <TableColumnVisibilityMenu
                    columns={tableColumnOptions.map((column) => ({
                      key: column.key,
                      label: column.label,
                      checked: !preferences.hiddenColumnIds.includes(column.key),
                      disabled:
                        !preferences.hiddenColumnIds.includes(column.key) && visibleColumnIds.length === 1,
                    }))}
                    onToggle={toggleColumnVisibility}
                    onReset={resetPreferences}
                  />
                ) : null}
              </div>
            </div>
            {filterConfigs.length > 0 ? (
              <div className="mt-3 space-y-2">
                <div className="flex items-end gap-3">
                  <DataTableFilterBar
                    filters={filterConfigs}
                    values={columnFilterValues}
                    onChange={handleColumnFilterChange}
                    onReset={handleColumnFilterReset}
                    className="flex-1"
                  />
                  <SavedFilterPresetsMenu
                    presets={savedPresets}
                    currentFilters={columnFilterValues}
                    onApplyPreset={handleApplyFilterPreset}
                    onSavePreset={savePreset}
                    onDeletePreset={deleteFilterPreset}
                  />
                </div>
                <DataTableFilterChips
                  filters={filterConfigs}
                  values={columnFilterValues}
                  onRemove={handleColumnFilterRemove}
                />
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {viewMode === "table" ? (
              <div className="overflow-hidden rounded-2xl border border-slate-100">
                <Table className="min-w-[960px]">
                  <TableHeader className="sticky-admin-table-header">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHead
                            key={header.id}
                            className={cn(
                              header.column.id === "actions" ? "text-right" : undefined,
                              resolveAlignment(section.tableColumns.find((column) => column.key === header.column.id)?.align),
                            )}
                          >
                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell
                            key={cell.id}
                            className={cn(
                              resolveAlignment(section.tableColumns.find((column) => column.key === cell.column.id)?.align),
                              "font-medium text-slate-700",
                            )}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : table.getRowModel().rows.length > 0 ? (
              <FlexibleCardGrid preset={layoutPreset}>
                {table.getRowModel().rows.map((row, index) => (
                  <FlexibleCardItem key={row.id} span={resolveCardSpan(index, layoutPreset)}>
                    <Card className="h-full border-slate-200">
                      <CardContent className="space-y-3 p-4">
                        {section.tableColumns.map((column) => (
                          <div key={`${row.id}-${column.key}`} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{column.header}</span>
                            <span className="text-right text-sm font-semibold text-slate-900">{renderCell(row.original[column.key], column)}</span>
                          </div>
                        ))}
                        {hasDetailActions ? (
                          <div className="flex justify-end gap-1 pt-1">
                            <Button type="button" variant="ghost" size="sm" onClick={() => openViewer(row.original.id)}>
                              View
                            </Button>
                            <CanAccess permission={editPermForSection}>
                              <Button type="button" variant="ghost" size="sm" onClick={() => openEditor(row.original.id)}>
                                Edit
                              </Button>
                            </CanAccess>
                            {sectionKey === "batches" ? (
                              <CanAccess permission="batches.edit">
                                <Button type="button" variant="ghost" size="sm" onClick={() => void openStudentsPopup(row.original)}>
                                  Students
                                </Button>
                              </CanAccess>
                            ) : null}
                            {sectionKey === "batches" ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => void exportBatchCsv(row.original)}
                                disabled={exportingBatchId === row.original.id}
                              >
                                <Download className="mr-1 h-3.5 w-3.5" />
                                {exportingBatchId === row.original.id ? "Exporting" : "Export"}
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  </FlexibleCardItem>
                ))}
              </FlexibleCardGrid>
            ) : (
              <DataTableEmptyState
                title="No rows available for this section."
                description={globalFilter || columnFilters.length > 0 ? "Try adjusting your filters or search criteria." : undefined}
                action={globalFilter || columnFilters.length > 0 ? { label: "Clear filters", onClick: () => { handleSearchChange(""); handleColumnFilterReset(); } } : undefined}
              />
            )}

            <DataTablePagination
              currentPage={table.getState().pagination.pageIndex}
              pageCount={table.getPageCount()}
              totalRows={table.getFilteredRowModel().rows.length}
              visibleRows={table.getRowModel().rows.length}
              pageSize={pageSize}
              pageSizes={DEFAULT_TABLE_PAGE_SIZES}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          </CardContent>
        </Card>
      </div>

      <CourseDetailSheet
        courseId={viewingCourseId}
        open={Boolean(viewingCourseId)}
        onOpenChange={(nextOpen) => !nextOpen && closePanel()}
        onEdit={(id) => openEditor(id)}
      />
      <BatchDetailSheet
        batchId={viewingBatchId}
        open={Boolean(viewingBatchId)}
        onOpenChange={(nextOpen) => !nextOpen && closePanel()}
        onEdit={(id) => openEditor(id)}
      />
      <CenterDetailSheet
        centerId={viewingCenterId}
        open={Boolean(viewingCenterId)}
        onOpenChange={(nextOpen) => !nextOpen && closePanel()}
        onEdit={(id) => openEditor(id)}
      />
      <ProgramDetailSheet
        programId={viewingProgramId}
        open={Boolean(viewingProgramId)}
        onOpenChange={(nextOpen) => !nextOpen && closePanel()}
        onEdit={(id) => openEditor(id)}
      />
      <TrainerDetailSheet
        trainerId={viewingTrainerId}
        open={Boolean(viewingTrainerId)}
        onOpenChange={(nextOpen) => !nextOpen && closePanel()}
        onEdit={(id) => openEditor(id)}
      />
      <EmailTemplateDetailSheet
        templateId={viewingEmailTemplateId}
        open={Boolean(viewingEmailTemplateId)}
        onOpenChange={(nextOpen) => !nextOpen && closePanel()}
        onEdit={(id) => openEditor(id)}
      />
      <EditCourseSheet courseId={editingCourseId} open={Boolean(editingCourseId)} onOpenChange={(nextOpen) => !nextOpen && closeEditor()} />
      <EditBatchSheet batchId={editingBatchId} open={Boolean(editingBatchId)} onOpenChange={(nextOpen) => !nextOpen && closeEditor()} />
      <EditCenterSheet centerId={editingCenterId} open={Boolean(editingCenterId)} onOpenChange={(nextOpen) => !nextOpen && closeEditor()} />
      <EditProgramSheet programId={editingProgramId} open={Boolean(editingProgramId)} onOpenChange={(nextOpen) => !nextOpen && closeEditor()} />
      <EditTrainerSheet trainerId={editingTrainerId} open={Boolean(editingTrainerId)} onOpenChange={(nextOpen) => !nextOpen && closeEditor()} />
      <EditEmailTemplateSheet
        templateId={editingEmailTemplateId}
        open={Boolean(editingEmailTemplateId)}
        onOpenChange={(nextOpen) => !nextOpen && closeEditor()}
        existingTemplateKeys={emailTemplateKeys}
      />
      <TemplateHistorySheet
        templateId={historyTemplateId}
        templateName={historyTemplateName}
        open={Boolean(historyTemplateId)}
        onOpenChange={(nextOpen) => { if (!nextOpen) { setHistoryTemplateId(null); setHistoryTemplateName(null); } }}
      />
      <BatchEnrollmentSheet
        open={Boolean(studentsBatch)}
        batch={studentsBatch}
        onOpenChange={(nextOpen) => !nextOpen && setStudentsBatch(null)}
        onDataChange={() => router.refresh()}
      />
    </div>
  );
}

function HeaderButton({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span>{label}</span>
      <ArrowUpDown className="h-3.5 w-3.5" />
    </div>
  );
}

function renderCell(value: string, column: PortalSectionTableColumn) {
  return <span className={cn(column.key === "status" || column.key === "state" || column.key === "sync" ? "font-bold text-slate-900" : undefined)}>{value}</span>;
}

function resolveAlignment(align: PortalSectionTableColumn["align"]) {
  if (align === "center") {
    return "text-center";
  }

  if (align === "right") {
    return "text-right";
  }

  return "text-left";
}