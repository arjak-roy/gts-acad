"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, ChevronLeft, ChevronRight, LayoutGrid, Rows3 } from "lucide-react";
import { ColumnDef, SortingState, flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BatchDetailSheet } from "@/components/modules/batches/batch-detail-sheet";
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
import { CreateBatchSheet } from "@/components/modules/batches/create-batch-sheet";
import { AddProgramSheet } from "@/components/modules/programs/add-program-sheet";
import { LogsActionsSection } from "@/components/modules/logs-actions/logs-actions-section";
import { ScheduleSection } from "@/components/modules/schedule/schedule-section";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CardLayoutPreset, FlexibleCardGrid, FlexibleCardItem, parseCardLayoutPreset } from "@/components/ui/flexible-card-layout";
import { cn } from "@/lib/utils";
import { PortalSectionContent, PortalSectionTableColumn, PortalSectionTableRow } from "@/types";

type SectionPageContentProps = {
  section: PortalSectionContent;
  sectionKey?: string;
};

type ViewMode = "table" | "card";

const PAGE_SIZE = 4;

type BatchLearner = {
  id: string;
  learnerCode: string;
  fullName: string;
};

type LearnersResponse = {
  items: BatchLearner[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

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
  const [batchStudents, setBatchStudents] = useState<BatchLearner[]>([]);
  const [studentsTotal, setStudentsTotal] = useState(0);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const viewMode: ViewMode = searchParams.get("view") === "card" ? "card" : "table";
  const layoutPreset = parseCardLayoutPreset(searchParams.get("layout"));
  const hasDetailActions = sectionKey === "courses" || sectionKey === "batches" || sectionKey === "programs" || sectionKey === "trainers" || sectionKey === "settings";

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

  const openStudentsPopup = async (row: PortalSectionTableRow) => {
    const batchCode = row.code;
    if (!batchCode) {
      return;
    }

    setStudentsBatch({ id: row.id, code: batchCode });
    setBatchStudents([]);
    setStudentsTotal(0);
    setStudentsError(null);
    setIsLoadingStudents(true);

    try {
      const params = new URLSearchParams({
        batchCode,
        page: "1",
        pageSize: "50",
        sortBy: "fullName",
        sortDirection: "asc",
      });

      const response = await fetch(`/api/learners?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load candidates.");
      }

      const payload = (await response.json()) as { data?: LearnersResponse };
      setBatchStudents(payload.data?.items ?? []);
      setStudentsTotal(payload.data?.totalCount ?? 0);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load candidates.";
      setStudentsError(message);
    } finally {
      setIsLoadingStudents(false);
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
            <div className="flex justify-end gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => openViewer(row.original.id)}>
                View
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => openEditor(row.original.id)}>
                Edit
              </Button>
              {sectionKey === "batches" ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => void openStudentsPopup(row.original)}>
                  Students
                </Button>
              ) : null}
            </div>
          ),
        });
      }

      return baseColumns;
    },
    [hasDetailActions, section.tableColumns],
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
                            <Button type="button" variant="ghost" size="sm" onClick={() => openEditor(row.original.id)}>
                              Edit
                            </Button>
                            {sectionKey === "batches" ? (
                              <Button type="button" variant="ghost" size="sm" onClick={() => void openStudentsPopup(row.original)}>
                                Students
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

      <Sheet open={Boolean(studentsBatch)} onOpenChange={(nextOpen) => !nextOpen && setStudentsBatch(null)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Batch Candidates</SheetTitle>
            <SheetDescription>
              {studentsBatch ? `Batch ${studentsBatch.code}` : "Candidates enrolled in this batch"}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-3 p-6">
            {isLoadingStudents ? <p className="text-sm text-slate-500">Loading candidates...</p> : null}
            {studentsError ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{studentsError}</p> : null}

            {!isLoadingStudents && !studentsError ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Total Candidates: {studentsTotal}</p>
                {batchStudents.length > 0 ? (
                  <div className="space-y-2">
                    {batchStudents.map((learner) => (
                      <div key={learner.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-sm font-semibold text-slate-900">{learner.fullName}</p>
                        <p className="text-xs text-slate-500">{learner.learnerCode}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No candidates found for this batch.</p>
                )}
              </>
            ) : null}
          </div>

          <SheetFooter>
            <Button type="button" variant="secondary" onClick={() => setStudentsBatch(null)}>
              Close
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
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