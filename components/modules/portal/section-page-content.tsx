"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, ChevronLeft, ChevronRight, Download, LayoutGrid, MoreHorizontal, Rows3 } from "lucide-react";
import { ColumnDef, SortingState, flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BatchDetailSheet } from "@/components/modules/batches/batch-detail-sheet";
import { BatchEnrollmentSheet } from "@/components/modules/batches/batch-enrollment-sheet";
import { EditBatchSheet } from "@/components/modules/batches/edit-batch-sheet";
import { AddCourseSheet } from "@/components/modules/courses/add-course-sheet";
import { CourseDetailSheet } from "@/components/modules/courses/course-detail-sheet";
import { EditCourseSheet } from "@/components/modules/courses/edit-course-sheet";
import { AddEmailTemplateSheet } from "@/components/modules/email-templates/add-email-template-sheet";
import { EditEmailTemplateSheet } from "@/components/modules/email-templates/edit-email-template-sheet";
import { EmailTemplateDetailSheet } from "@/components/modules/email-templates/email-template-detail-sheet";
import { ProgramDetailSheet } from "@/components/modules/programs/program-detail-sheet";
import { EditProgramSheet } from "@/components/modules/programs/edit-program-sheet";
import { TrainerDetailSheet } from "@/components/modules/trainers/trainer-detail-sheet";
import { EditTrainerSheet } from "@/components/modules/trainers/edit-trainer-sheet";
import { AddTrainerSheet } from "@/components/modules/trainers/add-trainer-sheet";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CreateBatchSheet } from "@/components/modules/batches/create-batch-sheet";
import { AddProgramSheet } from "@/components/modules/programs/add-program-sheet";
import { LogsActionsSection } from "@/components/modules/logs-actions/logs-actions-section";
import { ScheduleSection } from "@/components/modules/schedule/schedule-section";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CardLayoutPreset, FlexibleCardGrid, FlexibleCardItem, parseCardLayoutPreset } from "@/components/ui/flexible-card-layout";
import { CanAccess } from "@/components/ui/can-access";
import { cn } from "@/lib/utils";
import { PortalSectionContent, PortalSectionTableColumn, PortalSectionTableRow } from "@/types";

type SectionPageContentProps = {
  section: PortalSectionContent;
  sectionKey?: string;
};

type ViewMode = "table" | "card";

const PAGE_SIZE = 4;

export function SectionPageContent({ section, sectionKey }: SectionPageContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [viewingCourseId, setViewingCourseId] = useState<string | null>(null);
  const [viewingBatchId, setViewingBatchId] = useState<string | null>(null);
  const [viewingProgramId, setViewingProgramId] = useState<string | null>(null);
  const [viewingTrainerId, setViewingTrainerId] = useState<string | null>(null);
  const [viewingEmailTemplateId, setViewingEmailTemplateId] = useState<string | null>(null);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [editingTrainerId, setEditingTrainerId] = useState<string | null>(null);
  const [editingEmailTemplateId, setEditingEmailTemplateId] = useState<string | null>(null);
  const [studentsBatch, setStudentsBatch] = useState<{ id: string; code: string } | null>(null);
  const [exportingBatchId, setExportingBatchId] = useState<string | null>(null);
  const [batchActionError, setBatchActionError] = useState<string | null>(null);
  const viewMode: ViewMode = searchParams.get("view") === "card" ? "card" : "table";
  const layoutPreset = parseCardLayoutPreset(searchParams.get("layout"));
  const hasDetailActions = sectionKey === "courses" || sectionKey === "batches" || sectionKey === "programs" || sectionKey === "trainers" || sectionKey === "settings";

  const editPermForSection =
    sectionKey === "courses" ? "courses.edit" :
    sectionKey === "batches" ? "batches.edit" :
    sectionKey === "programs" ? "programs.edit" :
    sectionKey === "trainers" ? "trainers.edit" :
    sectionKey === "settings" ? "email_templates.edit" :
    undefined;

  const createPermForSection =
    sectionKey === "courses" ? "courses.create" :
    sectionKey === "batches" ? "batches.create" :
    sectionKey === "programs" ? "programs.create" :
    sectionKey === "trainers" ? "trainers.create" :
    sectionKey === "settings" ? "email_templates.create" :
    undefined;

  if (sectionKey === "logs-actions") {
    return <LogsActionsSection title={section.title} description={section.description} />;
  }

  if (sectionKey === "schedule") {
    return <ScheduleSection title={section.title} description={section.description} />;
  }

  useEffect(() => {
    const viewId = searchParams.get("viewId");
    const editId = searchParams.get("editId");

    // Reset all viewer/editor states first
    setViewingCourseId(null);
    setViewingBatchId(null);
    setViewingProgramId(null);
    setViewingTrainerId(null);
    setViewingEmailTemplateId(null);
    setEditingCourseId(null);
    setEditingBatchId(null);
    setEditingProgramId(null);
    setEditingTrainerId(null);
    setEditingEmailTemplateId(null);

    if (viewId) {
      if (sectionKey === "courses") {
        setViewingCourseId(viewId);
      } else if (sectionKey === "batches") {
        setViewingBatchId(viewId);
      } else if (sectionKey === "programs") {
        setViewingProgramId(viewId);
      } else if (sectionKey === "trainers") {
        setViewingTrainerId(viewId);
      } else if (sectionKey === "settings") {
        setViewingEmailTemplateId(viewId);
      }

      return;
    }

    if (editId) {
      if (sectionKey === "courses") {
        setEditingCourseId(editId);
      } else if (sectionKey === "batches") {
        setEditingBatchId(editId);
      } else if (sectionKey === "programs") {
        setEditingProgramId(editId);
      } else if (sectionKey === "trainers") {
        setEditingTrainerId(editId);
      } else if (sectionKey === "settings") {
        setEditingEmailTemplateId(editId);
      }
    }
  }, [searchParams, sectionKey]);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("viewId");
    next.delete("editId");
    if (value) next.set(key, value);
    startTransition(() => {
      const queryString = next.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    });
  };

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

  const openViewer = (id: string) => setParam("viewId", id);
  const openEditor = (id: string) => setParam("editId", id);
  const closePanel = () => setParam("viewId", null);
  const closeEditor = () => setParam("editId", null);

  const openStudentsPopup = (row: PortalSectionTableRow) => {
    const batchCode = row.code;
    if (!batchCode) {
      return;
    }

    setBatchActionError(null);
    setStudentsBatch({ id: row.id, code: batchCode });
  };

  const exportBatchCsv = async (row: PortalSectionTableRow) => {
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
  };

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
  [hasDetailActions, section.tableColumns, editPermForSection, sectionKey, exportingBatchId],
  );

  const table = useReactTable({
    data: section.tableRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: PAGE_SIZE,
      },
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

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
            ) : sectionKey === "trainers" ? (
              <AddTrainerSheet />
            ) : sectionKey === "settings" ? (
              <AddEmailTemplateSheet />
            ) : (
              <Button>{section.primaryAction}</Button>
            )}
          </CanAccess>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {section.metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader className="space-y-3 pb-3">
              <CardDescription>{metric.label}</CardDescription>
              <CardTitle className="text-3xl font-extrabold text-slate-950">{metric.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">{metric.helper}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6">
        {batchActionError ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{batchActionError}</p> : null}
        <Card>
          <CardHeader>
            <CardTitle>{section.tableTitle}</CardTitle>
            <CardDescription>{section.tableDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {viewMode === "table" ? (
              <div className="overflow-hidden rounded-2xl border border-slate-100">
                <Table>
                  <TableHeader className="bg-slate-50/80">
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
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-8 text-center text-sm font-medium text-slate-500">No rows available for this section.</div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                Showing <span className="font-bold text-slate-900">{table.getRowModel().rows.length}</span> of <span className="font-bold text-slate-900">{section.tableRows.length}</span> rows.
              </p>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="min-w-24 text-center text-sm font-semibold text-slate-600">
                  Page {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
                </span>
                <Button variant="secondary" size="sm" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
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
      <EditProgramSheet programId={editingProgramId} open={Boolean(editingProgramId)} onOpenChange={(nextOpen) => !nextOpen && closeEditor()} />
      <EditTrainerSheet trainerId={editingTrainerId} open={Boolean(editingTrainerId)} onOpenChange={(nextOpen) => !nextOpen && closeEditor()} />
      <EditEmailTemplateSheet
        templateId={editingEmailTemplateId}
        open={Boolean(editingEmailTemplateId)}
        onOpenChange={(nextOpen) => !nextOpen && closeEditor()}
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