"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, Loader2, Upload, UsersRound } from "lucide-react";
import { toast } from "sonner";

import {
  BulkImportMetricCard,
  BulkImportStatusBadge,
  downloadBlob,
  readImportApi,
} from "@/components/modules/bulk-import/import-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CanAccess } from "@/components/ui/can-access";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TRAINER_IMPORT_TEMPLATE_FILE_NAME } from "@/lib/imports/trainers";
import type { TrainerImportCommitResult, TrainerImportNormalizedRow, TrainerImportPreview } from "@/services/trainers/types";

export function TrainerBulkImportCard({ onImported }: { onImported?: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [isTemplateDownloading, setIsTemplateDownloading] = useState(false);

  const handleTemplateDownload = useCallback(async () => {
    setIsTemplateDownloading(true);

    try {
      const response = await fetch("/api/trainers/import/template", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to download trainer template.");
      }

      downloadBlob(await response.blob(), TRAINER_IMPORT_TEMPLATE_FILE_NAME);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download trainer template.");
    } finally {
      setIsTemplateDownloading(false);
    }
  }, []);

  return (
    <CanAccess permission="trainers.create">
      <>
        <Card className="border-[#d8e1ef] bg-[linear-gradient(135deg,#f6fbff_0%,#ffffff_55%,#fff7ed_100%)]">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">CSV onboarding</Badge>
              <Badge variant="accent">Create only</Badge>
              <Badge variant="danger">Blocks duplicates</Badge>
            </div>
            <CardTitle className="mt-3 flex items-center gap-3 text-xl font-black tracking-tight text-slate-950">
              <UsersRound className="h-5 w-5 text-[#0d3b84]" />
              Bulk Import Trainers
            </CardTitle>
            <CardDescription className="max-w-3xl text-sm font-medium leading-6 text-slate-600">
              Download the default template, upload a CSV, preview each row, and create trainer accounts in one commit.
              Existing emails, employee codes, or unknown courses block the import before any write happens.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2 text-sm font-medium leading-6 text-slate-600">
              <p>Template columns: fullName, employeeCode, email, phone, specialization, capacity, status, availabilityStatus, courses, bio.</p>
              <p>Use semicolons inside the courses cell for multiple assignments, for example: German A1; German B1 Nursing.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="secondary" onClick={() => void handleTemplateDownload()} disabled={isTemplateDownloading}>
                {isTemplateDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Download template
              </Button>
              <Button type="button" variant="accent" onClick={() => setOpen(true)}>
                <Upload className="h-4 w-4" />
                Bulk import
              </Button>
            </div>
          </CardContent>
        </Card>

        <TrainerBulkImportDialog open={open} onOpenChange={setOpen} onImported={onImported} />
      </>
    </CanAccess>
  );
}

function TrainerBulkImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void | Promise<void>;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<TrainerImportPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isTemplateDownloading, setIsTemplateDownloading] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);

  useEffect(() => {
    if (open) {
      return;
    }

    setSelectedFile(null);
    setPreview(null);
    setFileInputKey((current) => current + 1);
  }, [open]);

  const actionableRows = useMemo(
    () => preview?.rows.flatMap((row) => (row.normalizedData ? [row.normalizedData] : [])) ?? [],
    [preview],
  );

  const handleTemplateDownload = useCallback(async () => {
    setIsTemplateDownloading(true);

    try {
      const response = await fetch("/api/trainers/import/template", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to download trainer template.");
      }

      downloadBlob(await response.blob(), TRAINER_IMPORT_TEMPLATE_FILE_NAME);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download trainer template.");
    } finally {
      setIsTemplateDownloading(false);
    }
  }, []);

  const handlePreview = useCallback(async () => {
    if (!selectedFile) {
      toast.info("Select a CSV file to preview.");
      return;
    }

    setIsPreviewing(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const nextPreview = await readImportApi<TrainerImportPreview>("/api/trainers/import/preview", {
        method: "POST",
        body: formData,
      });
      setPreview(nextPreview);
      toast.success(`Preview ready: ${nextPreview.actionableCount} trainer row${nextPreview.actionableCount === 1 ? "" : "s"}.`);
    } catch (error) {
      setPreview(null);
      toast.error(error instanceof Error ? error.message : "Failed to preview trainer upload.");
    } finally {
      setIsPreviewing(false);
    }
  }, [selectedFile]);

  const handleImport = useCallback(async () => {
    if (!preview) {
      toast.info("Preview the CSV before importing.");
      return;
    }

    if (preview.hasBlockingErrors) {
      toast.info("Fix the blocking CSV errors before importing.");
      return;
    }

    if (actionableRows.length === 0) {
      toast.info("Preview contains no actionable rows.");
      return;
    }

    setIsImporting(true);

    try {
      const result = await readImportApi<TrainerImportCommitResult>("/api/trainers/import/commit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: preview.fileName,
          rows: actionableRows,
        }),
      });

      await onImported?.();
      toast.success(`Imported ${result.totalCount} trainer row${result.totalCount === 1 ? "" : "s"}.`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to import trainers.");
    } finally {
      setIsImporting(false);
    }
  }, [actionableRows, onImported, onOpenChange, preview]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[min(96vw,76rem)] max-w-6xl flex-col overflow-hidden p-0">
        <DialogHeader>
          <DialogTitle>Bulk Import Trainers</DialogTitle>
          <DialogDescription>
            Upload a CSV, review every row, and create new trainer accounts only. Existing emails, employee codes, or invalid courses block commit.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden px-6 py-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <Card className="border-[#d8e1ef] bg-slate-50">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="info">CSV only</Badge>
                  <Badge variant="accent">Template ready</Badge>
                </div>
                <CardTitle className="mt-3 text-xl font-black tracking-tight text-slate-950">Upload contract</CardTitle>
                <CardDescription className="text-sm font-medium leading-6 text-slate-600">
                  Required columns: fullName, employeeCode, email, specialization, courses. Optional: phone, capacity, status, availabilityStatus, and bio.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-[22px] border border-dashed border-[#cfd8e6] bg-white px-4 py-4">
                  <label className="block space-y-2">
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">CSV file</span>
                    <input
                      key={fileInputKey}
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(event) => {
                        setSelectedFile(event.target.files?.[0] ?? null);
                        setPreview(null);
                      }}
                      className="block w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-3 text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-[#edf4ff] file:px-3 file:py-2 file:text-sm file:font-bold file:text-[#0d3b84]"
                    />
                  </label>
                  <p className="mt-3 text-sm font-medium text-slate-500">
                    {selectedFile ? `${selectedFile.name} selected` : "Choose the CSV file you want to preview."}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant="secondary" onClick={() => void handleTemplateDownload()} disabled={isTemplateDownloading}>
                    {isTemplateDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Download template
                  </Button>
                  <Button type="button" onClick={() => void handlePreview()} disabled={!selectedFile || isPreviewing}>
                    {isPreviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                    Preview upload
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#d8e1ef] bg-white">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="success">Create new accounts</Badge>
                  <Badge variant="danger">No upserts</Badge>
                </div>
                <CardTitle className="mt-3 text-xl font-black tracking-tight text-slate-950">Preview rules</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm font-medium leading-6 text-slate-600">
                <p>Blank capacity defaults to 0, blank status defaults to ACTIVE, and blank availability defaults to AVAILABLE.</p>
                <p>Duplicate emails and employee codes inside the same file are blocking errors.</p>
                <p>Course names must already exist in the academy and are matched case-insensitively.</p>
              </CardContent>
            </Card>
          </div>

          {preview ? (
            <div className="grid gap-4 md:grid-cols-3">
              <BulkImportMetricCard label="Rows parsed" value={String(preview.totalRows)} helper={preview.fileName} badge="Rows" />
              <BulkImportMetricCard label="Creates" value={String(preview.createCount)} helper="New trainer accounts to be created." badge="Create" badgeVariant="success" />
              <BulkImportMetricCard label="Errors" value={String(preview.errorCount)} helper={preview.hasBlockingErrors ? "Commit is blocked until the CSV is fixed." : "No blocking errors."} badge="Errors" badgeVariant={preview.errorCount > 0 ? "danger" : "info"} />
            </div>
          ) : null}

          <div className="min-h-[320px] flex-1 overflow-auto rounded-[24px] border border-[#d8e1ef] bg-white">
            {!preview ? (
              <div className="flex h-full min-h-[280px] flex-col items-center justify-center px-6 text-center">
                <p className="text-sm font-semibold text-slate-900">Preview a CSV file to inspect row actions.</p>
                <p className="mt-2 max-w-2xl text-sm text-slate-500">The dialog validates emails, employee codes, and course assignments before any trainer account is created.</p>
              </div>
            ) : preview.rows.length === 0 ? (
              <div className="flex h-full min-h-[280px] flex-col items-center justify-center px-6 text-center">
                <p className="text-sm font-semibold text-slate-900">No preview rows available.</p>
                <p className="mt-2 text-sm text-slate-500">Upload a CSV with at least one non-empty trainer row.</p>
              </div>
            ) : (
              <Table className="min-w-[1120px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Trainer</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Specialization</TableHead>
                    <TableHead>Courses</TableHead>
                    <TableHead>Capacity & Status</TableHead>
                    <TableHead>Issues</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((row) => {
                    const normalizedRow = row.normalizedData as TrainerImportNormalizedRow | null;

                    return (
                      <TableRow key={row.rowNumber}>
                        <TableCell className="font-bold text-slate-900">{row.rowNumber}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-bold text-slate-950">{row.input.fullName || "-"}</p>
                            <p className="text-xs font-medium text-slate-500">{row.input.email || "No email"}</p>
                            <p className="text-xs font-semibold text-[#0d3b84]">{row.input.employeeCode || "No employee code"}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <BulkImportStatusBadge status={row.status} />
                        </TableCell>
                        <TableCell className="font-medium text-slate-700">{row.input.specialization || "-"}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {(normalizedRow?.courses ?? row.input.courses.split(";").map((entry) => entry.trim()).filter(Boolean)).length === 0 ? (
                              <p className="text-sm font-medium text-slate-500">-</p>
                            ) : (
                              (normalizedRow?.courses ?? row.input.courses.split(";").map((entry) => entry.trim()).filter(Boolean)).map((course) => (
                                <p key={`${row.rowNumber}-${course}`} className="text-xs font-medium text-slate-700">
                                  {course}
                                </p>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm font-medium text-slate-700">
                            <p>Capacity: {normalizedRow?.capacity ?? (row.input.capacity || "0")}</p>
                            <p>Status: {normalizedRow?.status ?? (row.input.status || "ACTIVE")}</p>
                            <p>Availability: {normalizedRow?.availabilityStatus ?? (row.input.availabilityStatus || "AVAILABLE")}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {row.issues.length === 0 ? (
                            <p className="text-sm font-medium text-emerald-700">Ready to import</p>
                          ) : (
                            <div className="space-y-1">
                              {row.issues.map((issue, index) => (
                                <p key={`${row.rowNumber}-${issue.field ?? "general"}-${index}`} className="text-xs font-medium text-rose-700">
                                  {issue.field ? `${issue.field}: ` : ""}
                                  {issue.message}
                                </p>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={isImporting || isPreviewing}>
            Close
          </Button>
          <Button type="button" onClick={() => void handleImport()} disabled={!preview || preview.hasBlockingErrors || actionableRows.length === 0 || isImporting}>
            {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Commit import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}