"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, GraduationCap, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { LEARNER_IMPORT_TEMPLATE_FILE_NAME } from "@/lib/imports/learners";
import type { LearnerImportCommitResult, LearnerImportNormalizedRow, LearnerImportPreview } from "@/services/learners/types";

export function LearnerBulkImportCard() {
  const [open, setOpen] = useState(false);
  const [isTemplateDownloading, setIsTemplateDownloading] = useState(false);

  const handleTemplateDownload = useCallback(async () => {
    setIsTemplateDownloading(true);

    try {
      const response = await fetch("/api/learners/import/template", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to download learner template.");
      }

      downloadBlob(await response.blob(), LEARNER_IMPORT_TEMPLATE_FILE_NAME);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download learner template.");
    } finally {
      setIsTemplateDownloading(false);
    }
  }, []);

  return (
    <CanAccess permission="users.create">
      <>
        <Card className="border-[#d8e1ef] bg-[linear-gradient(135deg,#fffaf3_0%,#ffffff_50%,#f3f9ff_100%)]">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">CSV enrollment</Badge>
              <Badge variant="accent">Minimal fields</Badge>
              <Badge variant="danger">Batch checked</Badge>
            </div>
            <CardTitle className="mt-3 flex items-center gap-3 text-xl font-black tracking-tight text-slate-950">
              <GraduationCap className="h-5 w-5 text-[#0d3b84]" />
              Bulk Import Learners
            </CardTitle>
            <CardDescription className="max-w-3xl text-sm font-medium leading-6 text-slate-600">
              Use the default template to onboard learners in bulk. The preview validates batch codes, checks program-to-batch alignment, and blocks duplicates before enrollment starts.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2 text-sm font-medium leading-6 text-slate-600">
              <p>Template columns: fullName, email, phone, programName, batchCode, campus.</p>
              <p>Rows are create-only. Existing learner or user emails are rejected so the import remains deterministic.</p>
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

        <LearnerBulkImportDialog open={open} onOpenChange={setOpen} />
      </>
    </CanAccess>
  );
}

function LearnerBulkImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<LearnerImportPreview | null>(null);
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
      const response = await fetch("/api/learners/import/template", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to download learner template.");
      }

      downloadBlob(await response.blob(), LEARNER_IMPORT_TEMPLATE_FILE_NAME);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download learner template.");
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
      const nextPreview = await readImportApi<LearnerImportPreview>("/api/learners/import/preview", {
        method: "POST",
        body: formData,
      });
      setPreview(nextPreview);
      toast.success(`Preview ready: ${nextPreview.actionableCount} learner row${nextPreview.actionableCount === 1 ? "" : "s"}.`);
    } catch (error) {
      setPreview(null);
      toast.error(error instanceof Error ? error.message : "Failed to preview learner upload.");
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
      const result = await readImportApi<LearnerImportCommitResult>("/api/learners/import/commit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: preview.fileName,
          rows: actionableRows,
        }),
      });

      router.refresh();
      toast.success(`Imported ${result.totalCount} learner row${result.totalCount === 1 ? "" : "s"}.`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to import learners.");
    } finally {
      setIsImporting(false);
    }
  }, [actionableRows, onOpenChange, preview, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[min(96vw,74rem)] max-w-6xl flex-col overflow-hidden p-0">
        <DialogHeader>
          <DialogTitle>Bulk Import Learners</DialogTitle>
          <DialogDescription>
            Upload a CSV, review each learner row, and create new enrollments only. Existing emails, invalid batches, or batch-program mismatches block commit.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden px-6 py-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <Card className="border-[#d8e1ef] bg-slate-50">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="info">CSV only</Badge>
                  <Badge variant="accent">Enrollment template</Badge>
                </div>
                <CardTitle className="mt-3 text-xl font-black tracking-tight text-slate-950">Upload contract</CardTitle>
                <CardDescription className="text-sm font-medium leading-6 text-slate-600">
                  Required columns: fullName, email, programName, batchCode. Optional: phone and campus.
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
                  <Badge variant="success">Create new learners</Badge>
                  <Badge variant="danger">No duplicate emails</Badge>
                </div>
                <CardTitle className="mt-3 text-xl font-black tracking-tight text-slate-950">Preview rules</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm font-medium leading-6 text-slate-600">
                <p>Rows are create-only. Existing learner emails and existing user accounts both block commit.</p>
                <p>Every batch code must exist and the program name must match the batch before import is allowed.</p>
                <p>Use the preview to catch CSV duplicates before any learner code or account is generated.</p>
              </CardContent>
            </Card>
          </div>

          {preview ? (
            <div className="grid gap-4 md:grid-cols-3">
              <BulkImportMetricCard label="Rows parsed" value={String(preview.totalRows)} helper={preview.fileName} badge="Rows" />
              <BulkImportMetricCard label="Creates" value={String(preview.createCount)} helper="New learners ready for onboarding." badge="Create" badgeVariant="success" />
              <BulkImportMetricCard label="Errors" value={String(preview.errorCount)} helper={preview.hasBlockingErrors ? "Commit is blocked until the CSV is fixed." : "No blocking errors."} badge="Errors" badgeVariant={preview.errorCount > 0 ? "danger" : "info"} />
            </div>
          ) : null}

          <div className="min-h-[320px] flex-1 overflow-auto rounded-[24px] border border-[#d8e1ef] bg-white">
            {!preview ? (
              <div className="flex h-full min-h-[280px] flex-col items-center justify-center px-6 text-center">
                <p className="text-sm font-semibold text-slate-900">Preview a CSV file to inspect row actions.</p>
                <p className="mt-2 max-w-2xl text-sm text-slate-500">The dialog validates learner identity fields, batch codes, and program alignment before enrollment begins.</p>
              </div>
            ) : preview.rows.length === 0 ? (
              <div className="flex h-full min-h-[280px] flex-col items-center justify-center px-6 text-center">
                <p className="text-sm font-semibold text-slate-900">No preview rows available.</p>
                <p className="mt-2 text-sm text-slate-500">Upload a CSV with at least one non-empty learner row.</p>
              </div>
            ) : (
              <Table className="min-w-[1040px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Learner</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Campus</TableHead>
                    <TableHead>Issues</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((row) => {
                    const normalizedRow = row.normalizedData as LearnerImportNormalizedRow | null;

                    return (
                      <TableRow key={row.rowNumber}>
                        <TableCell className="font-bold text-slate-900">{row.rowNumber}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-bold text-slate-950">{row.input.fullName || "-"}</p>
                            <p className="text-xs font-medium text-slate-500">{row.input.email || "No email"}</p>
                            <p className="text-xs font-semibold text-[#0d3b84]">{row.input.phone || "No phone"}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <BulkImportStatusBadge status={row.status} />
                        </TableCell>
                        <TableCell className="font-medium text-slate-700">{normalizedRow?.programName ?? (row.input.programName || "-")}</TableCell>
                        <TableCell className="font-medium text-slate-700">{normalizedRow?.batchCode ?? (row.input.batchCode || "-")}</TableCell>
                        <TableCell className="font-medium text-slate-700">{normalizedRow?.campus ?? (row.input.campus || "-")}</TableCell>
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