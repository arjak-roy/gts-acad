"use client";

import { type ChangeEvent, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Download, Loader2, RefreshCcw, Search, ShieldAlert, Upload } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  initialSelection?: AttendanceWorkspaceInitialSelection;
};

type AttendanceWorkspaceInitialSelection = {
  batchCode?: string;
  sessionDate?: string;
  sessionSourceType?: AttendanceSessionSourceValue;
  scheduleEventId?: string;
};

type DraftAttendanceRow = AttendanceWorkspaceRow & {
  status: AttendanceStatusValue | "";
  notes: string;
};

type CsvImportFeedback = {
  appliedCount: number;
  duplicateLearnerCodes: string[];
  invalidStatuses: string[];
  missingLearnerCodes: string[];
  errorMessage?: string;
};

const ATTENDANCE_STATUS_OPTIONS: Array<{ value: AttendanceStatusValue; label: string; variant: "success" | "danger" | "warning" | "info" }> = [
  { value: "PRESENT", label: "Present", variant: "success" },
  { value: "ABSENT", label: "Absent", variant: "danger" },
  { value: "LATE", label: "Late", variant: "warning" },
  { value: "EXCUSED", label: "Excused", variant: "info" },
];

const SESSION_SOURCE_OPTIONS: Array<{ value: AttendanceSessionSourceValue; label: string; helper: string }> = [
  { value: "MANUAL", label: "Manual", helper: "Use the selected batch and date." },
  { value: "SCHEDULE_EVENT", label: "Scheduled", helper: "Attach attendance to a class or assessment." },
];

const statusValueSet = new Set<AttendanceStatusValue>(ATTENDANCE_STATUS_OPTIONS.map((option) => option.value));

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function isValidAttendanceDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()));
}

function resolveInitialBatchCode(value: string | undefined, batches: AttendanceWorkspaceBatchOption[]) {
  const normalizedValue = value?.trim();

  if (normalizedValue && batches.some((batch) => batch.code === normalizedValue)) {
    return normalizedValue;
  }

  return batches[0]?.code ?? "";
}

function resolveInitialSessionDate(value: string | undefined) {
  return isValidAttendanceDate(value) ? value : todayInputValue();
}

function resolveInitialSessionSourceType(value: AttendanceSessionSourceValue | undefined): AttendanceSessionSourceValue {
  return value === "SCHEDULE_EVENT" ? value : "MANUAL";
}

function parseDateValue(value: string) {
  return new Date(value.length === 10 ? `${value}T00:00:00` : value);
}

function formatDateLabel(value: string) {
  const date = parseDateValue(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTimeLabel(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
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

function normalizeNotes(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function hasRowChanged(row: DraftAttendanceRow) {
  return row.status !== (row.existingStatus ?? "") || normalizeNotes(row.notes) !== normalizeNotes(row.existingNotes);
}

function parseAttendanceCsv(text: string) {
  const rawLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (rawLines.length === 0) {
    return {
      rows: [] as Array<{ learnerCode: string; status: AttendanceStatusValue; notes: string }>,
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
  const parsedRows = new Map<string, { learnerCode: string; status: AttendanceStatusValue; notes: string }>();

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

export function AttendanceWorkspace({ initialBatches, initialSelection }: AttendanceWorkspaceProps) {
  const { can } = useRbac();
  const canManageAttendance = can("attendance.manage");
  const attendanceMutation = useMarkAttendance();
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [selectedBatchCode, setSelectedBatchCode] = useState(() => resolveInitialBatchCode(initialSelection?.batchCode, initialBatches));
  const [sessionDate, setSessionDate] = useState(() => resolveInitialSessionDate(initialSelection?.sessionDate));
  const [sessionSourceType, setSessionSourceType] = useState<AttendanceSessionSourceValue>(() => resolveInitialSessionSourceType(initialSelection?.sessionSourceType));
  const [selectedScheduleEventId, setSelectedScheduleEventId] = useState(() =>
    resolveInitialSessionSourceType(initialSelection?.sessionSourceType) === "SCHEDULE_EVENT" ? initialSelection?.scheduleEventId?.trim() ?? "" : "",
  );
  const [search, setSearch] = useState("");
  const [draftRows, setDraftRows] = useState<DraftAttendanceRow[]>([]);
  const [isOverwriteDialogOpen, setIsOverwriteDialogOpen] = useState(false);
  const [isCsvDialogOpen, setIsCsvDialogOpen] = useState(false);
  const [csvImportFeedback, setCsvImportFeedback] = useState<CsvImportFeedback | null>(null);
  const deferredSearch = useDeferredValue(search);

  const activeScheduleEventId = sessionSourceType === "SCHEDULE_EVENT" ? selectedScheduleEventId || undefined : undefined;

  const workspaceQuery = useQuery({
    queryKey: ["attendance-workspace", selectedBatchCode, sessionDate, sessionSourceType, activeScheduleEventId ?? ""],
    queryFn: () => fetchWorkspace(selectedBatchCode, sessionDate, sessionSourceType, activeScheduleEventId),
    enabled: Boolean(selectedBatchCode && sessionDate),
    staleTime: 15_000,
  });

  const workspace = workspaceQuery.data ?? null;
  const isWorkspaceLoading = workspaceQuery.isLoading || workspaceQuery.isFetching;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);

    if (selectedBatchCode) {
      params.set("batchCode", selectedBatchCode);
    } else {
      params.delete("batchCode");
    }

    if (sessionDate) {
      params.set("sessionDate", sessionDate);
    } else {
      params.delete("sessionDate");
    }

    if (sessionSourceType === "SCHEDULE_EVENT") {
      params.set("sessionSourceType", sessionSourceType);
    } else {
      params.delete("sessionSourceType");
    }

    if (sessionSourceType === "SCHEDULE_EVENT" && activeScheduleEventId) {
      params.set("scheduleEventId", activeScheduleEventId);
    } else {
      params.delete("scheduleEventId");
    }

    const nextSearch = params.toString();
    const nextUrl = nextSearch ? `${window.location.pathname}?${nextSearch}${window.location.hash}` : `${window.location.pathname}${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (nextUrl !== currentUrl) {
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, [activeScheduleEventId, selectedBatchCode, sessionDate, sessionSourceType]);

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
    setCsvImportFeedback(null);
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
      return;
    }

    setSelectedScheduleEventId("");
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
  const dirtyRowCount = useMemo(() => draftRows.filter((row) => hasRowChanged(row)).length, [draftRows]);
  const selectedBatch = useMemo(() => initialBatches.find((batch) => batch.code === selectedBatchCode) ?? null, [initialBatches, selectedBatchCode]);
  const selectedScheduleEvent = useMemo(
    () => workspace?.scheduledEvents.find((event) => event.id === selectedScheduleEventId) ?? null,
    [selectedScheduleEventId, workspace?.scheduledEvents],
  );
  const rowsToSave = useMemo(
    () => draftRows.filter((row): row is DraftAttendanceRow & { status: AttendanceStatusValue } => Boolean(row.status)),
    [draftRows],
  );

  const activeSessionTitle = useMemo(() => {
    if (workspace?.session?.title) {
      return workspace.session.title;
    }

    if (selectedScheduleEvent) {
      return selectedScheduleEvent.title;
    }

    if (sessionSourceType === "MANUAL") {
      return `Manual attendance for ${formatDateLabel(sessionDate)}`;
    }

    return "Choose a scheduled event";
  }, [selectedScheduleEvent, sessionDate, sessionSourceType, workspace?.session?.title]);

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
    setCsvImportFeedback(null);
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
    anchor.download = `${(selectedBatch?.code ?? selectedBatchCode).toLowerCase()}-${sessionDate}-attendance-template.csv`;
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
      const rosterCodes = new Set(draftRows.map((row) => row.learnerCode.toUpperCase()));
      const missingLearnerCodes = Array.from(csvRowMap.keys()).filter((learnerCode) => !rosterCodes.has(learnerCode));
      let appliedCount = 0;

      const nextRows = draftRows.map((row) => {
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
      });

      setDraftRows(nextRows);
      setCsvImportFeedback({
        appliedCount,
        duplicateLearnerCodes,
        invalidStatuses,
        missingLearnerCodes,
      });
      toast.success(`Applied ${appliedCount} CSV row${appliedCount === 1 ? "" : "s"} to the attendance draft.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to import the attendance CSV.";
      setCsvImportFeedback({
        appliedCount: 0,
        duplicateLearnerCodes: [],
        invalidStatuses: [],
        missingLearnerCodes: [],
        errorMessage: message,
      });
      toast.error(message);
    }
  };

  const saveAttendance = async () => {
    if (rowsToSave.length === 0) {
      toast.error("Choose at least one learner attendance status before saving.");
      return;
    }

    if (sessionSourceType === "SCHEDULE_EVENT" && !selectedScheduleEventId) {
      toast.error("Select the scheduled class or assessment to continue.");
      return;
    }

    try {
      const result = await attendanceMutation.mutateAsync({
        batchCode: selectedBatchCode,
        sessionDate,
        sessionSourceType,
        scheduleEventId: activeScheduleEventId,
        records: rowsToSave.map((row) => ({
          learnerId: row.learnerCode,
          status: row.status,
          notes: row.notes,
        })),
      });

      setIsOverwriteDialogOpen(false);
      toast.success(`Saved ${result.recordsUpdated} attendance records.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save attendance.");
    }
  };

  const handleSave = async () => {
    if (rowsToSave.length === 0) {
      toast.error("Choose at least one learner attendance status before saving.");
      return;
    }

    if (sessionSourceType === "SCHEDULE_EVENT" && !selectedScheduleEventId) {
      toast.error("Select the scheduled class or assessment to continue.");
      return;
    }

    if (workspace?.session?.existingRecordCount) {
      setIsOverwriteDialogOpen(true);
      return;
    }

    await saveAttendance();
  };

  if (initialBatches.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">Attendance</h1>
          <p className="mt-2 text-sm font-medium text-slate-500">No active batches are available for attendance.</p>
        </div>

        <Card className="border-slate-200">
          <CardContent className="px-6 py-10 text-center text-sm font-medium text-slate-500">
            Create or activate a batch first, then come back to mark attendance.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">Attendance</h1>
            <p className="mt-2 text-sm font-medium text-slate-500">Pick a session, mark learners, and save.</p>
          </div>
          <Badge variant={canManageAttendance ? "success" : "default"}>{canManageAttendance ? "Manage Access" : "View Only"}</Badge>
        </div>

        <Card className="border-slate-200">
          <CardHeader className="space-y-2">
            <CardTitle>Session Setup</CardTitle>
            <CardDescription>Choose the batch, date, and attendance session you want to edit.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_220px_280px]">
              <label className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Batch</span>
                <select
                  className="flex h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-[#0d3b84]"
                  value={selectedBatchCode}
                  onChange={(event) => setSelectedBatchCode(event.target.value)}
                >
                  {initialBatches.map((batch) => (
                    <option key={batch.id} value={batch.code}>
                      {batch.code} • {batch.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Date</span>
                <Input type="date" value={sessionDate} onChange={(event) => setSessionDate(event.target.value)} />
              </label>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Current session</p>
                <p className="mt-2 text-sm font-black text-slate-900">{activeSessionTitle}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  {workspace?.session
                    ? `${workspace.session.existingRecordCount} saved marks • updated ${formatDateTimeLabel(workspace.session.updatedAt)}`
                    : "No saved marks for this selection yet."}
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {SESSION_SOURCE_OPTIONS.map((option) => {
                const isSelected = option.value === sessionSourceType;

                return (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      "rounded-2xl border px-4 py-4 text-left transition-colors",
                      isSelected
                        ? "border-[#0d3b84] bg-[#0d3b84]/5 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                    )}
                    aria-pressed={isSelected}
                    onClick={() => setSessionSourceType(option.value)}
                  >
                    <p className="text-sm font-black text-slate-900">{option.label}</p>
                    <p className="mt-1 text-xs font-medium text-slate-500">{option.helper}</p>
                  </button>
                );
              })}
            </div>

            {sessionSourceType === "SCHEDULE_EVENT" ? (
              <div className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50/60 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-[#0d3b84]">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900">Scheduled event</p>
                    <p className="text-xs font-medium text-slate-500">Choose the class or assessment for {formatDateLabel(sessionDate)}.</p>
                  </div>
                </div>

                {isWorkspaceLoading ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm font-medium text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading available sessions...
                  </div>
                ) : workspace?.scheduledEvents.length ? (
                  <div className="grid gap-3">
                    {workspace.scheduledEvents.map((event) => {
                      const isSelected = selectedScheduleEventId === event.id;

                      return (
                        <button
                          key={event.id}
                          type="button"
                          className={cn(
                            "w-full rounded-2xl border bg-white px-4 py-4 text-left transition-colors",
                            isSelected
                              ? "border-[#0d3b84] bg-[#0d3b84]/5 shadow-sm"
                              : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                          )}
                          onClick={() => setSelectedScheduleEventId(event.id)}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-black text-slate-900">{event.title}</p>
                                <Badge variant={event.type === "CLASS" ? "info" : "accent"}>{event.type === "CLASS" ? "Class" : "Assessment"}</Badge>
                              </div>
                              <p className="mt-1 text-xs font-medium text-slate-500">{formatTimeRange(event.startsAt, event.endsAt)}</p>
                            </div>
                            <Badge variant={isSelected ? "success" : "default"}>{isSelected ? "Selected" : "Select"}</Badge>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm font-medium text-slate-500">
                    No scheduled classes or assessments were found for this date.
                  </div>
                )}
              </div>
            ) : null}

            {workspace?.session?.existingRecordCount ? (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-black">Overwrite warning</p>
                  <p className="mt-1 font-medium">
                    This session already has {workspace.session.existingRecordCount} saved marks for {formatDateLabel(workspace.session.sessionDate)}.
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
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <CardTitle>Roster</CardTitle>
                <CardDescription>Mark the learners you want to update. Existing saved values stay visible for reference.</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="default">{draftSummary.totalLearners} learners</Badge>
                <Badge variant={dirtyRowCount > 0 ? "info" : "default"}>{dirtyRowCount} unsaved changes</Badge>
                <Badge variant="success">{draftSummary.markedCount} marked</Badge>
              </div>
            </div>

            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative w-full xl:max-w-md">
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
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-slate-500">
                {rowsToSave.length === 0
                  ? "No learners are marked yet. Blank rows stay untouched."
                  : `${rowsToSave.length} learner${rowsToSave.length === 1 ? "" : "s"} will be included in this save.`}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="secondary" onClick={resetToLoadedValues} disabled={draftRows.length === 0}>
                  <RefreshCcw className="h-4 w-4" />
                  Reset Draft
                </Button>
                <Button type="button" variant="secondary" onClick={() => setIsCsvDialogOpen(true)} disabled={!canManageAttendance || draftRows.length === 0}>
                  <Upload className="h-4 w-4" />
                  Bulk Upload CSV
                </Button>
                <Button type="button" onClick={() => void handleSave()} disabled={!canManageAttendance || attendanceMutation.isPending || draftRows.length === 0 || isWorkspaceLoading}>
                  {attendanceMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Save Attendance
                </Button>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[260px]">Learner</TableHead>
                    <TableHead className="w-[220px]">Mark Now</TableHead>
                    <TableHead className="w-[220px]">Saved</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isWorkspaceLoading ? (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <div className="flex items-center justify-center gap-2 py-8 text-sm font-medium text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading roster...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}

                  {!isWorkspaceLoading && filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <div className="py-8 text-center text-sm font-medium text-slate-500">
                          {draftRows.length === 0 ? "No learners are enrolled in the selected batch." : "No learners matched the current search."}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}

                  {!isWorkspaceLoading
                    ? filteredRows.map((row) => {
                        const existingStatusMeta = row.existingStatus ? getStatusMeta(row.existingStatus) : null;
                        const selectedStatusMeta = row.status ? getStatusMeta(row.status) : null;
                        const rowChanged = hasRowChanged(row);

                        return (
                          <TableRow key={row.enrollmentId} className={cn(rowChanged && "bg-blue-50/40")}>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-black text-slate-900">{row.learnerName}</p>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{row.learnerCode}</p>
                                {rowChanged ? <p className="text-xs font-semibold text-[#0d3b84]">Unsaved change</p> : null}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-2">
                                <select
                                  className="flex h-10 w-full min-w-[10rem] rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-[#0d3b84] disabled:cursor-not-allowed disabled:opacity-60"
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
                                {selectedStatusMeta ? <Badge variant={selectedStatusMeta.variant}>{selectedStatusMeta.label}</Badge> : null}
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
                              <Input
                                value={row.notes}
                                onChange={(event) => updateRow(row.enrollmentId, { notes: event.target.value })}
                                placeholder="Optional note"
                                disabled={!canManageAttendance}
                              />
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

      <Dialog open={isOverwriteDialogOpen} onOpenChange={setIsOverwriteDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Overwrite saved attendance?</DialogTitle>
            <DialogDescription>Saving now will replace the matching learner marks in this session.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-black">{activeSessionTitle}</p>
                <p className="mt-1 font-medium">
                  {workspace?.session?.existingRecordCount ?? 0} saved marks already exist for {workspace?.session ? formatDateLabel(workspace.session.sessionDate) : formatDateLabel(sessionDate)}.
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-600">Continue only if you want to replace the saved values with the current draft.</p>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setIsOverwriteDialogOpen(false)} disabled={attendanceMutation.isPending}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveAttendance()} disabled={attendanceMutation.isPending}>
              {attendanceMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Overwrite and Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCsvDialogOpen} onOpenChange={setIsCsvDialogOpen}>
        <DialogContent size="default">
          <DialogHeader>
            <DialogTitle>Bulk Upload CSV</DialogTitle>
            <DialogDescription>Upload learnerCode,status,notes rows to update the current attendance draft.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvUpload} />

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-sm font-black text-slate-900">Current target</p>
              <p className="mt-1 text-sm font-medium text-slate-600">
                {(selectedBatch?.code ?? selectedBatchCode) || "Batch not selected"} • {formatDateLabel(sessionDate)}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500">{activeSessionTitle}</p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Format</p>
              <p className="mt-1 rounded-xl bg-white px-3 py-2 font-mono text-xs text-slate-600">learnerCode,status,notes</p>
            </div>

            {csvImportFeedback ? (
              <div
                className={cn(
                  "rounded-2xl border px-4 py-4",
                  csvImportFeedback.errorMessage ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-slate-50",
                )}
              >
                <p className={cn("text-sm font-black", csvImportFeedback.errorMessage ? "text-rose-700" : "text-slate-900")}>Import results</p>
                {csvImportFeedback.errorMessage ? (
                  <p className="mt-2 text-sm font-medium text-rose-700">{csvImportFeedback.errorMessage}</p>
                ) : (
                  <div className="mt-3 space-y-2 text-sm">
                    <p className="font-medium text-emerald-700">Applied {csvImportFeedback.appliedCount} row{csvImportFeedback.appliedCount === 1 ? "" : "s"} to the current draft.</p>
                    {csvImportFeedback.duplicateLearnerCodes.length > 0 ? (
                      <p className="font-medium text-amber-700">Duplicate learner codes kept the last row: {csvImportFeedback.duplicateLearnerCodes.join(", ")}</p>
                    ) : null}
                    {csvImportFeedback.invalidStatuses.length > 0 ? (
                      <p className="font-medium text-amber-700">Ignored invalid statuses: {csvImportFeedback.invalidStatuses.join(", ")}</p>
                    ) : null}
                    {csvImportFeedback.missingLearnerCodes.length > 0 ? (
                      <p className="font-medium text-amber-700">Ignored learners not found in this roster: {csvImportFeedback.missingLearnerCodes.join(", ")}</p>
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setIsCsvDialogOpen(false)}>
              Close
            </Button>
            <Button type="button" variant="secondary" onClick={handleDownloadTemplate} disabled={draftRows.length === 0}>
              <Download className="h-4 w-4" />
              Download Template
            </Button>
            <Button type="button" onClick={() => csvInputRef.current?.click()} disabled={!canManageAttendance || draftRows.length === 0}>
              <Upload className="h-4 w-4" />
              Upload CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}