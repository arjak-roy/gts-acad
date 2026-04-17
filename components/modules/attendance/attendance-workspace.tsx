"use client";

import { type ChangeEvent, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Loader2,
  RefreshCcw,
  Search,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMarkAttendance } from "@/hooks/use-mark-attendance";
import { useRbac } from "@/lib/rbac-context";
import { cn } from "@/lib/utils";
import type {
  AttendanceSessionSourceValue,
  AttendanceStatusValue,
  AttendanceWorkspaceBatchOption,
  AttendanceWorkspaceData,
  AttendanceWorkspaceRow,
  AttendanceWorkspaceSummary,
} from "@/services/attendance/types";

type AttendanceWorkspaceProps = {
  initialBatches: AttendanceWorkspaceBatchOption[];
};

type DraftAttendanceRow = AttendanceWorkspaceRow & {
  status: AttendanceStatusValue | "";
  notes: string;
};

type ParsedCsvRow = {
  learnerCode: string;
  status: AttendanceStatusValue;
  notes: string;
};

const ATTENDANCE_STATUS_OPTIONS: Array<{ value: AttendanceStatusValue; label: string; variant: "success" | "danger" | "warning" | "info" }> = [
  { value: "PRESENT", label: "Present", variant: "success" },
  { value: "ABSENT", label: "Absent", variant: "danger" },
  { value: "LATE", label: "Late", variant: "warning" },
  { value: "EXCUSED", label: "Excused", variant: "info" },
];

const SESSION_SOURCE_OPTIONS: Array<{ value: AttendanceSessionSourceValue; label: string; helper: string }> = [
  { value: "MANUAL", label: "Manual Session", helper: "Batch and date driven fallback when no linked class or assessment exists." },
  { value: "SCHEDULE_EVENT", label: "Scheduled Event", helper: "Bind attendance to a specific class or assessment so same-day sessions stay separate." },
];

const statusValueSet = new Set<AttendanceStatusValue>(ATTENDANCE_STATUS_OPTIONS.map((option) => option.value));

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateLabel(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTimeLabel(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTimeRange(startsAt: string, endsAt: string | null) {
  const startLabel = new Date(startsAt).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (!endsAt) {
    return startLabel;
  }

  const endLabel = new Date(endsAt).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${startLabel} - ${endLabel}`;
}

function getStatusMeta(status: AttendanceStatusValue) {
  return ATTENDANCE_STATUS_OPTIONS.find((option) => option.value === status) ?? ATTENDANCE_STATUS_OPTIONS[0];
}

function buildDraftSummary(rows: DraftAttendanceRow[]): AttendanceWorkspaceSummary {
  return rows.reduce(
    (summary, row) => {
      if (!row.status) {
        return summary;
      }

      summary.markedCount += 1;

      if (row.status === "PRESENT") {
        summary.presentCount += 1;
      } else if (row.status === "ABSENT") {
        summary.absentCount += 1;
      } else if (row.status === "LATE") {
        summary.lateCount += 1;
      } else if (row.status === "EXCUSED") {
        summary.excusedCount += 1;
      }

      return summary;
    },
    {
      totalLearners: rows.length,
      markedCount: 0,
      presentCount: 0,
      absentCount: 0,
      lateCount: 0,
      excusedCount: 0,
    },
  );
}

function parseAttendanceCsv(text: string) {
  const rawLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (rawLines.length === 0) {
    return {
      rows: [] as ParsedCsvRow[],
      duplicateLearnerCodes: [] as string[],
      invalidStatuses: [] as string[],
    };
  }

  const [firstLine, ...remainingLines] = rawLines;
  const firstCells = firstLine.split(",").map((cell) => cell.trim().toLowerCase());
  const hasHeader = firstCells[0] === "learnercode" || (firstCells[0] === "learner_id" && firstCells[1] === "status");
  const lines = hasHeader ? remainingLines : rawLines;
  const duplicateLearnerCodes = new Set<string>();
  const invalidStatuses = new Set<string>();
  const parsedRows = new Map<string, ParsedCsvRow>();

  for (const line of lines) {
    const [learnerCodeCell, statusCell, ...rest] = line.split(",");
    const learnerCode = learnerCodeCell?.trim().toUpperCase();
    const status = statusCell?.trim().toUpperCase() as AttendanceStatusValue | undefined;

    if (!learnerCode || !status) {
      continue;
    }

    if (!statusValueSet.has(status)) {
      invalidStatuses.add(`${learnerCode}:${status}`);
      continue;
    }

    if (parsedRows.has(learnerCode)) {
      duplicateLearnerCodes.add(learnerCode);
    }

    parsedRows.set(learnerCode, {
      learnerCode,
      status,
      notes: rest.join(",").trim(),
    });
  }

  return {
    rows: Array.from(parsedRows.values()),
    duplicateLearnerCodes: Array.from(duplicateLearnerCodes.values()),
    invalidStatuses: Array.from(invalidStatuses.values()),
  };
}

async function fetchWorkspace(
  batchCode: string,
  sessionDate: string,
  sessionSourceType: AttendanceSessionSourceValue,
  scheduleEventId?: string,
) {
  const params = new URLSearchParams({
    batchCode,
    sessionDate,
    sessionSourceType,
  });

  if (scheduleEventId) {
    params.set("scheduleEventId", scheduleEventId);
  }

  const response = await fetch(`/api/attendance/workspace?${params.toString()}`, { cache: "no-store" });
  const payload = (await response.json().catch(() => null)) as { data?: AttendanceWorkspaceData; error?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Failed to load the attendance workspace.");
  }

  if (!payload?.data) {
    throw new Error("Attendance workspace response was empty.");
  }

  return payload.data;
}

export function AttendanceWorkspace({ initialBatches }: AttendanceWorkspaceProps) {
  const { can } = useRbac();
  const canManageAttendance = can("attendance.manage");
  const attendanceMutation = useMarkAttendance();
  const [selectedBatchCode, setSelectedBatchCode] = useState(initialBatches[0]?.code ?? "");
  const [sessionDate, setSessionDate] = useState(todayInputValue);
  const [sessionSourceType, setSessionSourceType] = useState<AttendanceSessionSourceValue>("MANUAL");
  const [selectedScheduleEventId, setSelectedScheduleEventId] = useState("");
  const [search, setSearch] = useState("");
  const [draftRows, setDraftRows] = useState<DraftAttendanceRow[]>([]);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  const workspaceQuery = useQuery({
    queryKey: ["attendance-workspace", selectedBatchCode, sessionDate, sessionSourceType, selectedScheduleEventId],
    queryFn: () => fetchWorkspace(selectedBatchCode, sessionDate, sessionSourceType, selectedScheduleEventId || undefined),
    enabled: Boolean(selectedBatchCode && sessionDate),
    staleTime: 15_000,
  });

  const workspace = workspaceQuery.data ?? null;

  useEffect(() => {
    if (sessionSourceType === "MANUAL" && selectedScheduleEventId) {
      setSelectedScheduleEventId("");
    }
  }, [sessionSourceType, selectedScheduleEventId]);

  useEffect(() => {
    if (!workspace) {
      setDraftRows([]);
      return;
    }

    setDraftRows(
      workspace.roster.map((row) => ({
        ...row,
        status: row.existingStatus ?? "",
        notes: row.existingNotes ?? "",
      })),
    );
    setImportFeedback(null);
  }, [workspace]);

  useEffect(() => {
    if (sessionSourceType !== "SCHEDULE_EVENT") {
      return;
    }

    if (!workspace?.scheduledEvents.length) {
      setSelectedScheduleEventId("");
      return;
    }

    const eventStillExists = workspace.scheduledEvents.some((event) => event.id === selectedScheduleEventId);

    if (selectedScheduleEventId && eventStillExists) {
      return;
    }

    if (workspace.scheduledEvents.length === 1) {
      setSelectedScheduleEventId(workspace.scheduledEvents[0].id);
    } else if (!eventStillExists) {
      setSelectedScheduleEventId("");
    }
  }, [sessionSourceType, selectedScheduleEventId, workspace?.scheduledEvents]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();

    if (!normalizedSearch) {
      return draftRows;
    }

    return draftRows.filter(
      (row) =>
        row.learnerName.toLowerCase().includes(normalizedSearch) ||
        row.learnerCode.toLowerCase().includes(normalizedSearch),
    );
  }, [deferredSearch, draftRows]);

  const draftSummary = useMemo(() => buildDraftSummary(draftRows), [draftRows]);

  const selectedBatch = initialBatches.find((batch) => batch.code === selectedBatchCode) ?? null;

  const applyStatusToAll = (status: AttendanceStatusValue) => {
    setDraftRows((currentRows) => currentRows.map((row) => ({ ...row, status })));
  };

  const resetToLoadedValues = () => {
    if (!workspace) {
      return;
    }

    setDraftRows(
      workspace.roster.map((row) => ({
        ...row,
        status: row.existingStatus ?? "",
        notes: row.existingNotes ?? "",
      })),
    );
    setImportFeedback(null);
  };

  const updateRow = (enrollmentId: string, patch: Partial<Pick<DraftAttendanceRow, "status" | "notes">>) => {
    setDraftRows((currentRows) => currentRows.map((row) => (row.enrollmentId === enrollmentId ? { ...row, ...patch } : row)));
  };

  const handleDownloadTemplate = () => {
    if (draftRows.length === 0) {
      return;
    }

    const lines = [
      "learnerCode,status,notes",
      ...draftRows.map((row) => `${row.learnerCode},${row.status},${row.notes.replace(/\r?\n/g, " ")}`),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `${selectedBatchCode.toLowerCase()}-${sessionDate}-attendance-template.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  };

  const handleCsvUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const { rows, duplicateLearnerCodes, invalidStatuses } = parseAttendanceCsv(text);

      if (rows.length === 0) {
        throw new Error("No valid attendance rows were found in the CSV.");
      }

      const csvRowMap = new Map(rows.map((row) => [row.learnerCode, row]));
      const missingLearnerCodes: string[] = [];
      let appliedCount = 0;

      setDraftRows((currentRows) =>
        currentRows.map((row) => {
          const matched = csvRowMap.get(row.learnerCode.toUpperCase());

          if (!matched) {
            return row;
          }

          appliedCount += 1;
          return {
            ...row,
            status: matched.status,
            notes: matched.notes,
          };
        }),
      );

      for (const learnerCode of csvRowMap.keys()) {
        const existsInRoster = draftRows.some((row) => row.learnerCode.toUpperCase() === learnerCode);

        if (!existsInRoster) {
          missingLearnerCodes.push(learnerCode);
        }
      }

      const feedbackParts = [`Applied ${appliedCount} CSV rows.`];

      if (duplicateLearnerCodes.length > 0) {
        feedbackParts.push(`Duplicate learner codes kept the last row: ${duplicateLearnerCodes.join(", ")}.`);
      }

      if (invalidStatuses.length > 0) {
        feedbackParts.push(`Ignored invalid statuses: ${invalidStatuses.join(", ")}.`);
      }

      if (missingLearnerCodes.length > 0) {
        feedbackParts.push(`Ignored unknown learner codes: ${missingLearnerCodes.join(", ")}.`);
      }

      setImportFeedback(feedbackParts.join(" "));
      toast.success("CSV attendance rows applied to the roster.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to import the attendance CSV.";
      setImportFeedback(message);
      toast.error(message);
    }
  };

  const handleSave = async () => {
    const markedRows = draftRows.filter((row) => row.status);

    if (markedRows.length === 0) {
      toast.error("Choose at least one learner attendance status before saving.");
      return;
    }

    if (sessionSourceType === "SCHEDULE_EVENT" && !selectedScheduleEventId) {
      toast.error("Select the scheduled class or assessment to continue.");
      return;
    }

    if (
      workspace?.session?.existingRecordCount &&
      !window.confirm(
        `This session already has ${workspace.session.existingRecordCount} saved records. Saving now will overwrite matching learner marks. Continue?`,
      )
    ) {
      return;
    }

    try {
      const result = await attendanceMutation.mutateAsync({
        batchCode: selectedBatchCode,
        sessionDate,
        sessionSourceType,
        scheduleEventId: selectedScheduleEventId || undefined,
        records: markedRows.map((row) => ({
          learnerId: row.learnerCode,
          status: row.status,
          notes: row.notes.trim() || undefined,
        })),
      });

      toast.success(`Saved ${result.recordsUpdated} attendance records.`);
      setImportFeedback(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save attendance.");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#edf4ff_48%,#fff5eb_100%)]">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.45fr_0.9fr] lg:items-start">
          <div className="space-y-4">
            <div className="inline-flex rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-slate-500 shadow-sm backdrop-blur">
              Attendance Workspace
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-black tracking-tight text-slate-950">Manual Bulk Attendance</h1>
                <Badge variant={canManageAttendance ? "success" : "default"}>{canManageAttendance ? "Manage Access" : "View Only"}</Badge>
              </div>
              <p className="max-w-3xl text-sm font-medium leading-6 text-slate-600">
                Load a batch roster, choose whether the session is manual or schedule-linked, apply bulk status changes, and import CSV updates before saving.
                Same-day classes and assessments stay isolated because attendance is now stored against a first-class session instead of a date-only key.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Selected Batch</p>
                <p className="mt-2 text-base font-black text-slate-900">{selectedBatch?.code ?? "Select a batch"}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{selectedBatch ? `${selectedBatch.name} • ${selectedBatch.programName}` : "Roster loading starts after batch selection."}</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Session Mode</p>
                <p className="mt-2 text-base font-black text-slate-900">{sessionSourceType === "MANUAL" ? "Manual Date" : "Schedule Linked"}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{SESSION_SOURCE_OPTIONS.find((option) => option.value === sessionSourceType)?.helper}</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Saved Marks</p>
                <p className="mt-2 text-base font-black text-slate-900">{workspace?.summary.markedCount ?? 0}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">Existing records for the loaded session snapshot.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 rounded-[28px] border border-slate-200/70 bg-white/90 p-4 shadow-sm backdrop-blur">
            <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <ClipboardCheck className="mt-0.5 h-5 w-5 text-[#0d3b84]" />
              <div>
                <p className="text-sm font-black text-slate-900">Overwrite policy</p>
                <p className="mt-1 text-xs font-medium leading-5 text-slate-500">Existing attendance rows are surfaced before save and require confirmation before the matching learner records are overwritten.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <CalendarDays className="mt-0.5 h-5 w-5 text-[#0d3b84]" />
              <div>
                <p className="text-sm font-black text-slate-900">Schedule-aware selection</p>
                <p className="mt-1 text-xs font-medium leading-5 text-slate-500">Pick a specific scheduled class or assessment when same-day sessions need separate attendance histories.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <Upload className="mt-0.5 h-5 w-5 text-[#0d3b84]" />
              <div>
                <p className="text-sm font-black text-slate-900">CSV assisted edits</p>
                <p className="mt-1 text-xs font-medium leading-5 text-slate-500">Download the active roster template, edit it offline, then upload it back into the table before saving.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <Card className="border-slate-200">
          <CardHeader className="space-y-2">
            <CardTitle>Session Controls</CardTitle>
            <CardDescription>Choose the batch, date, and session source before applying roster changes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Batch</span>
                <select
                  className="flex h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-[#0d3b84]"
                  value={selectedBatchCode}
                  onChange={(event) => setSelectedBatchCode(event.target.value)}
                >
                  {initialBatches.length === 0 ? <option value="">No batches available</option> : null}
                  {initialBatches.map((batch) => (
                    <option key={batch.id} value={batch.code}>
                      {batch.code} • {batch.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Session Date</span>
                <Input type="date" value={sessionDate} onChange={(event) => setSessionDate(event.target.value)} />
              </label>

              <label className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Session Source</span>
                <select
                  className="flex h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-[#0d3b84]"
                  value={sessionSourceType}
                  onChange={(event) => setSessionSourceType(event.target.value as AttendanceSessionSourceValue)}
                >
                  {SESSION_SOURCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Loaded Session</p>
                <p className="text-sm font-black text-slate-900">{workspace?.session?.title ?? (sessionSourceType === "MANUAL" ? "New manual session" : "Choose a scheduled event")}</p>
                <p className="text-xs font-medium text-slate-500">{workspace?.session ? `Last updated ${formatDateTimeLabel(workspace.session.updatedAt)}` : "No saved attendance exists for the current selection yet."}</p>
              </div>
            </div>

            {workspace?.session?.existingRecordCount ? (
              <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <ShieldAlert className="mt-0.5 h-5 w-5" />
                <div className="space-y-1">
                  <p className="font-black">Overwrite warning</p>
                  <p className="font-medium leading-6">
                    This session already contains {workspace.session.existingRecordCount} saved records.
                    Saving again will overwrite the matching learner entries for {formatDateLabel(workspace.session.sessionDate)}.
                  </p>
                </div>
              </div>
            ) : null}

            {workspaceQuery.isError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {workspaceQuery.error instanceof Error ? workspaceQuery.error.message : "Failed to load attendance workspace."}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="space-y-2">
            <CardTitle>Schedule Snapshot</CardTitle>
            <CardDescription>Classes and assessments on the selected date. In schedule-linked mode, pick the exact event you want to attach attendance to.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {workspaceQuery.isLoading ? (
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm font-medium text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading scheduled events and roster context...
              </div>
            ) : null}

            {!workspaceQuery.isLoading && workspace?.scheduledEvents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm font-medium text-slate-500">
                No classes or assessments are scheduled for {formatDateLabel(`${sessionDate}T00:00:00.000Z`)}.
                Manual mode remains available for ad-hoc attendance capture.
              </div>
            ) : null}

            {workspace?.scheduledEvents.map((event) => {
              const isSelected = selectedScheduleEventId === event.id;

              return (
                <button
                  key={event.id}
                  type="button"
                  className={cn(
                    "w-full rounded-2xl border px-4 py-4 text-left transition-colors",
                    isSelected
                      ? "border-[#0d3b84] bg-[#0d3b84]/5 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                  )}
                  onClick={() => setSelectedScheduleEventId(event.id)}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-black text-slate-900">{event.title}</p>
                        <Badge variant={event.type === "CLASS" ? "info" : "accent"}>{event.type === "CLASS" ? "Class" : "Assessment"}</Badge>
                      </div>
                      <p className="mt-1 text-xs font-medium text-slate-500">{formatTimeRange(event.startsAt, event.endsAt)} • {event.classMode ?? "Hybrid"}</p>
                    </div>
                    {sessionSourceType === "SCHEDULE_EVENT" ? (
                      <Badge variant={isSelected ? "success" : "default"}>{isSelected ? "Selected" : "Use Session"}</Badge>
                    ) : (
                      <Badge variant="default">Context</Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="space-y-2">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>Roster Editor</CardTitle>
              <CardDescription>
                Edit learner attendance row-by-row, apply bulk status updates, or import a CSV template. Blank rows are ignored on save and do not clear existing stored marks.
              </CardDescription>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Learners</p>
                <p className="mt-2 text-xl font-black text-slate-900">{draftSummary.totalLearners}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Marked In Draft</p>
                <p className="mt-2 text-xl font-black text-slate-900">{draftSummary.markedCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Present Draft</p>
                <p className="mt-2 text-xl font-black text-emerald-600">{draftSummary.presentCount}</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative max-w-md flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input className="pl-9" placeholder="Search learner name or code" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                {ATTENDANCE_STATUS_OPTIONS.map((option) => (
                  <Button key={option.value} type="button" variant="secondary" size="sm" onClick={() => applyStatusToAll(option.value)} disabled={!canManageAttendance || draftRows.length === 0}>
                    {option.label} All
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={resetToLoadedValues} disabled={draftRows.length === 0}>
                <RefreshCcw className="h-4 w-4" />
                Reset Draft
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={handleDownloadTemplate} disabled={draftRows.length === 0}>
                <Download className="h-4 w-4" />
                Download CSV
              </Button>
              <label className={cn(buttonVariants({ variant: "secondary", size: "sm" }), canManageAttendance ? "cursor-pointer" : "cursor-not-allowed opacity-60")}>
                <Upload className="h-4 w-4" />
                Upload CSV
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvUpload} disabled={!canManageAttendance} />
              </label>
              <Button type="button" size="sm" onClick={() => void handleSave()} disabled={!canManageAttendance || attendanceMutation.isPending || draftRows.length === 0 || workspaceQuery.isLoading}>
                {attendanceMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Save Attendance
              </Button>
            </div>
          </div>

          {importFeedback ? (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">{importFeedback}</div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatusChip label="Present" value={draftSummary.presentCount} variant="success" />
            <StatusChip label="Absent" value={draftSummary.absentCount} variant="danger" />
            <StatusChip label="Late" value={draftSummary.lateCount} variant="warning" />
            <StatusChip label="Excused" value={draftSummary.excusedCount} variant="info" />
            <StatusChip label="Unmarked" value={Math.max(draftSummary.totalLearners - draftSummary.markedCount, 0)} variant="default" />
          </div>

          <div className="rounded-2xl border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Learner</TableHead>
                  <TableHead>Current Saved</TableHead>
                  <TableHead>Draft Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Metrics</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspaceQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="flex items-center justify-center gap-2 py-6 text-sm font-medium text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading roster...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}

                {!workspaceQuery.isLoading && filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="py-8 text-center text-sm font-medium text-slate-500">
                        {draftRows.length === 0 ? "No learners are enrolled in the selected batch." : "No learners matched the current search."}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}

                {!workspaceQuery.isLoading
                  ? filteredRows.map((row) => {
                      const existingStatusMeta = row.existingStatus ? getStatusMeta(row.existingStatus) : null;

                      return (
                        <TableRow key={row.enrollmentId}>
                          <TableCell>
                            <div>
                              <p className="font-black text-slate-900">{row.learnerName}</p>
                              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{row.learnerCode}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {existingStatusMeta ? (
                              <div className="space-y-2">
                                <Badge variant={existingStatusMeta.variant}>{existingStatusMeta.label}</Badge>
                                {row.existingNotes ? <p className="max-w-xs text-xs font-medium leading-5 text-slate-500">{row.existingNotes}</p> : null}
                              </div>
                            ) : (
                              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Not saved</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <select
                              className="flex h-10 min-w-[9rem] rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-[#0d3b84] disabled:cursor-not-allowed disabled:opacity-60"
                              value={row.status}
                              onChange={(event) => updateRow(row.enrollmentId, { status: event.target.value as DraftAttendanceRow["status"] })}
                              disabled={!canManageAttendance}
                            >
                              <option value="">Leave unchanged</option>
                              {ATTENDANCE_STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={row.notes}
                              onChange={(event) => updateRow(row.enrollmentId, { notes: event.target.value })}
                              placeholder="Optional note"
                              disabled={!canManageAttendance}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="space-y-1">
                              <p className="text-sm font-black text-slate-900">{row.attendancePercentage.toFixed(1)}% attendance</p>
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{row.readinessPercentage}% readiness</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusChip({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: "default" | "success" | "warning" | "danger" | "info";
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{label}</p>
        <Badge variant={variant}>{label}</Badge>
      </div>
      <p className="mt-2 text-xl font-black text-slate-900">{value}</p>
    </div>
  );
}