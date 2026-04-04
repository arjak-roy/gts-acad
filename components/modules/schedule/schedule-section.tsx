"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type ViewMode = "month" | "week" | "day" | "list";
type EventType = "CLASS" | "TEST" | "QUIZ" | "CONTEST";
type EventStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "RESCHEDULED";
type ClassMode = "ONLINE" | "OFFLINE";
type RecurrenceFrequency = "DAILY" | "WEEKLY" | "MONTHLY";

type ScheduleEvent = {
  id: string;
  batchId: string;
  batchCode: string;
  batchName: string;
  title: string;
  description: string | null;
  type: EventType;
  classMode: ClassMode | null;
  status: EventStatus;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  meetingUrl: string | null;
  linkedAssessmentId: string | null;
  seriesId: string | null;
  occurrenceIndex: number;
  isRecurring: boolean;
};

type BatchOption = {
  id: string;
  code: string;
  name: string;
};

type ScheduleResponse = {
  data: {
    items: ScheduleEvent[];
    totalCount: number;
    page: number;
    pageSize: number;
    pageCount: number;
  };
};

type BatchesResponse = {
  data: BatchOption[];
};

type EventFormState = {
  batchId: string;
  title: string;
  description: string;
  type: EventType;
  classMode: ClassMode;
  status: EventStatus;
  startsAt: string;
  endsAt: string;
  location: string;
  meetingUrl: string;
  isRecurring: boolean;
  frequency: RecurrenceFrequency;
  interval: number;
  count: number;
  until: string;
  weekdays: number[];
};

const DEFAULT_FORM: EventFormState = {
  batchId: "",
  title: "",
  description: "",
  type: "CLASS",
  classMode: "OFFLINE",
  status: "SCHEDULED",
  startsAt: "",
  endsAt: "",
  location: "",
  meetingUrl: "",
  isRecurring: false,
  frequency: "WEEKLY",
  interval: 1,
  count: 8,
  until: "",
  weekdays: [],
};

const WEEKDAY_OPTIONS = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
}

function endOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999);
}

function toLocalDateTimeInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRangeForView(baseDate: Date, viewMode: ViewMode) {
  if (viewMode === "day") {
    return {
      from: startOfDay(baseDate),
      to: endOfDay(baseDate),
      label: baseDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
    };
  }

  if (viewMode === "week") {
    const day = baseDate.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const from = startOfDay(new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + diff));
    const to = endOfDay(new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6));

    return {
      from,
      to,
      label: `${from.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} - ${to.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })}`,
    };
  }

  if (viewMode === "list") {
    const from = startOfDay(new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - 14));
    const to = endOfDay(new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + 60));

    return {
      from,
      to,
      label: "Rolling list window",
    };
  }

  const from = startOfDay(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1));
  const to = endOfDay(new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0));

  return {
    from,
    to,
    label: baseDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
  };
}

function shiftDate(baseDate: Date, viewMode: ViewMode, direction: "prev" | "next") {
  const multiplier = direction === "next" ? 1 : -1;

  if (viewMode === "day") {
    return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + multiplier);
  }

  if (viewMode === "week") {
    return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + multiplier * 7);
  }

  if (viewMode === "list") {
    return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + multiplier * 14);
  }

  return new Date(baseDate.getFullYear(), baseDate.getMonth() + multiplier, baseDate.getDate());
}

function buildEventPayload(form: EventFormState) {
  const payload: Record<string, unknown> = {
    batchId: form.batchId,
    title: form.title,
    description: form.description,
    type: form.type,
    status: form.status,
    startsAt: new Date(form.startsAt).toISOString(),
    endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
    location: form.location,
    meetingUrl: form.meetingUrl,
  };

  if (form.type === "CLASS") {
    payload.classMode = form.classMode;
  }

  if (form.isRecurring) {
    payload.recurrence = {
      frequency: form.frequency,
      interval: form.interval,
      count: form.count,
      until: form.until ? new Date(form.until).toISOString() : undefined,
      byWeekdays: form.frequency === "WEEKLY" ? form.weekdays : [],
    };
  }

  return payload;
}

export function ScheduleSection({ title, description }: { title: string; description: string }) {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [baseDate, setBaseDate] = useState(new Date());
  const [batchFilter, setBatchFilter] = useState<string>("");
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<EventFormState>(() => ({
    ...DEFAULT_FORM,
    startsAt: toLocalDateTimeInput(new Date(Date.now() + 60 * 60 * 1000)),
    endsAt: toLocalDateTimeInput(new Date(Date.now() + 2 * 60 * 60 * 1000)),
  }));

  const range = useMemo(() => getRangeForView(baseDate, viewMode), [baseDate, viewMode]);

  const groupedEvents = useMemo(() => {
    const groups = new Map<string, ScheduleEvent[]>();

    for (const event of events) {
      const dateLabel = new Date(event.startsAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      const bucket = groups.get(dateLabel) ?? [];
      bucket.push(event);
      groups.set(dateLabel, bucket);
    }

    return Array.from(groups.entries()).map(([label, items]) => ({
      label,
      items: [...items].sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()),
    }));
  }, [events]);

  const loadBatches = async () => {
    try {
      const response = await fetch("/api/batches", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load batches.");
      }

      const payload = (await response.json()) as BatchesResponse;
      setBatches(payload.data ?? []);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Failed to load batches.";
      setError(message);
    }
  };

  const loadEvents = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        page: "1",
        pageSize: "300",
      });

      if (batchFilter) {
        params.set("batchId", batchFilter);
      }

      const response = await fetch(`/api/schedule?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load schedule events.");
      }

      const payload = (await response.json()) as ScheduleResponse;
      setEvents(payload.data.items ?? []);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Failed to load schedule events.";
      setError(message);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBatches();
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [range.from.getTime(), range.to.getTime(), batchFilter]);

  const resetForm = (batchId?: string) => {
    const nextStart = new Date(Date.now() + 60 * 60 * 1000);
    const nextEnd = new Date(Date.now() + 2 * 60 * 60 * 1000);

    setForm({
      ...DEFAULT_FORM,
      batchId: batchId ?? batchFilter,
      startsAt: toLocalDateTimeInput(nextStart),
      endsAt: toLocalDateTimeInput(nextEnd),
    });
    setFormError(null);
  };

  const openCreate = () => {
    resetForm();
    setEditingEvent(null);
    setIsCreateOpen(true);
  };

  const openEdit = (event: ScheduleEvent) => {
    setEditingEvent(event);
    setForm({
      batchId: event.batchId,
      title: event.title,
      description: event.description ?? "",
      type: event.type,
      classMode: event.classMode ?? "OFFLINE",
      status: event.status,
      startsAt: toLocalDateTimeInput(new Date(event.startsAt)),
      endsAt: event.endsAt ? toLocalDateTimeInput(new Date(event.endsAt)) : "",
      location: event.location ?? "",
      meetingUrl: event.meetingUrl ?? "",
      isRecurring: false,
      frequency: "WEEKLY",
      interval: 1,
      count: 8,
      until: "",
      weekdays: [],
    });
    setFormError(null);
    setIsCreateOpen(true);
  };

  const submitCreateOrEdit = async () => {
    setSubmitting(true);
    setFormError(null);

    try {
      if (!form.batchId) {
        throw new Error("Batch is required.");
      }

      if (!form.title.trim()) {
        throw new Error("Title is required.");
      }

      if (!form.startsAt) {
        throw new Error("Start time is required.");
      }

      if (form.type === "CLASS" && !form.classMode) {
        throw new Error("Class mode is required for class events.");
      }

      const payload = buildEventPayload(form);

      const response = await fetch(editingEvent ? `/api/schedule/${editingEvent.id}` : "/api/schedule", {
        method: editingEvent ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const payloadError = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payloadError?.error ?? "Failed to save schedule event.");
      }

      setIsCreateOpen(false);
      setEditingEvent(null);
      await loadEvents();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to save schedule event.";
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const cancelEvent = async (event: ScheduleEvent) => {
    const shouldCancel = window.confirm(`Cancel ${event.title}?`);
    if (!shouldCancel) {
      return;
    }

    try {
      const response = await fetch(`/api/schedule/${event.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payloadError = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payloadError?.error ?? "Failed to cancel event.");
      }

      await loadEvents();
    } catch (cancelError) {
      const message = cancelError instanceof Error ? cancelError.message : "Failed to cancel event.";
      setError(message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm font-medium text-slate-500">{description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(["month", "week", "day", "list"] as ViewMode[]).map((mode) => (
            <Button key={mode} type="button" variant={viewMode === mode ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode(mode)}>
              {mode.toUpperCase()}
            </Button>
          ))}

          <Button type="button" variant="secondary" size="sm" onClick={() => setBaseDate(new Date())}>
            Today
          </Button>

          <Button type="button" variant="ghost" size="sm" onClick={() => setBaseDate((current) => shiftDate(current, viewMode, "prev"))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setBaseDate((current) => shiftDate(current, viewMode, "next"))}>
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Badge variant="accent">{range.label}</Badge>

          <Button type="button" onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" />
            Create Event
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Schedule Calendar
          </CardTitle>
          <CardDescription>Manage classes, tests, quizzes, and contests with recurring support.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Batch Filter</label>
            <select
              value={batchFilter}
              onChange={(event) => setBatchFilter(event.target.value)}
              className="h-10 rounded-xl border border-[#dde1e6] bg-white px-3 text-sm text-slate-900 shadow-sm"
            >
              <option value="">All Batches</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.code} - {batch.name}
                </option>
              ))}
            </select>
          </div>

          {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p> : null}

          {loading ? (
            <p className="text-sm text-slate-500">Loading schedule...</p>
          ) : viewMode === "list" ? (
            <div className="overflow-hidden rounded-2xl border border-slate-100">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow>
                    <TableHead>Batch</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.length > 0 ? (
                    events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>{event.batchCode}</TableCell>
                        <TableCell className="font-semibold">{event.title}</TableCell>
                        <TableCell>{event.type}</TableCell>
                        <TableCell>{event.classMode ?? "-"}</TableCell>
                        <TableCell>{formatDateTime(event.startsAt)}</TableCell>
                        <TableCell>{event.status}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(event)}>
                              Edit
                            </Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => void cancelEvent(event)}>
                              Cancel
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-slate-500">
                        No schedule events in this range.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          ) : groupedEvents.length > 0 ? (
            <div className="space-y-4">
              {groupedEvents.map((group) => (
                <div key={group.label} className="rounded-2xl border border-slate-100 bg-white p-4">
                  <p className="mb-3 text-sm font-black uppercase tracking-[0.12em] text-slate-500">{group.label}</p>
                  <div className="space-y-2">
                    {group.items.map((event) => (
                      <button
                        type="button"
                        key={event.id}
                        onClick={() => openEdit(event)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-slate-300 hover:bg-white"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-slate-900">{event.title}</p>
                          <Badge variant="info">{event.type}</Badge>
                        </div>
                        <p className="text-sm text-slate-600">
                          {event.batchCode} | {formatDateTime(event.startsAt)} | {event.classMode ?? "-"}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No schedule events in this range.</p>
          )}
        </CardContent>
      </Card>

      <Sheet
        open={isCreateOpen}
        onOpenChange={(nextOpen) => {
          setIsCreateOpen(nextOpen);
          if (!nextOpen) {
            setEditingEvent(null);
          }
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editingEvent ? "Edit Schedule Event" : "Create Schedule Event"}</SheetTitle>
            <SheetDescription>Configure calendar events for classes, tests, quizzes, and contests.</SheetDescription>
          </SheetHeader>

          <div className="space-y-4 p-6">
            {formError ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{formError}</p> : null}

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Batch</label>
              <select
                value={form.batchId}
                onChange={(event) => setForm((current) => ({ ...current, batchId: event.target.value }))}
                className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm text-slate-900 shadow-sm"
                disabled={Boolean(editingEvent)}
              >
                <option value="">Select batch</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.code} - {batch.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Title</label>
              <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Type</label>
                <select
                  value={form.type}
                  onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as EventType }))}
                  className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm text-slate-900 shadow-sm"
                >
                  <option value="CLASS">CLASS</option>
                  <option value="TEST">TEST</option>
                  <option value="QUIZ">QUIZ</option>
                  <option value="CONTEST">CONTEST</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Status</label>
                <select
                  value={form.status}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as EventStatus }))}
                  className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm text-slate-900 shadow-sm"
                >
                  <option value="SCHEDULED">SCHEDULED</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="CANCELLED">CANCELLED</option>
                  <option value="RESCHEDULED">RESCHEDULED</option>
                </select>
              </div>
            </div>

            {form.type === "CLASS" ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Class Mode</label>
                <select
                  value={form.classMode}
                  onChange={(event) => setForm((current) => ({ ...current, classMode: event.target.value as ClassMode }))}
                  className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm text-slate-900 shadow-sm"
                >
                  <option value="ONLINE">ONLINE</option>
                  <option value="OFFLINE">OFFLINE</option>
                </select>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Starts At</label>
                <Input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Ends At</label>
                <Input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Location</label>
              <Input value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Meeting URL</label>
              <Input value={form.meetingUrl} onChange={(event) => setForm((current) => ({ ...current, meetingUrl: event.target.value }))} />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Description</label>
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                className="min-h-24 w-full rounded-xl border border-[#dde1e6] bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-[#0d3b84]"
              />
            </div>

            {!editingEvent ? (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.isRecurring}
                    onChange={(event) => setForm((current) => ({ ...current, isRecurring: event.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Recurring event
                </label>

                {form.isRecurring ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <select
                        value={form.frequency}
                        onChange={(event) => setForm((current) => ({ ...current, frequency: event.target.value as RecurrenceFrequency }))}
                        className="h-10 rounded-xl border border-[#dde1e6] bg-white px-3 text-sm text-slate-900 shadow-sm"
                      >
                        <option value="DAILY">DAILY</option>
                        <option value="WEEKLY">WEEKLY</option>
                        <option value="MONTHLY">MONTHLY</option>
                      </select>

                      <Input
                        type="number"
                        min={1}
                        max={12}
                        value={form.interval}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            interval: Math.max(1, Number.parseInt(event.target.value || "1", 10)),
                          }))
                        }
                      />

                      <Input
                        type="number"
                        min={1}
                        max={180}
                        value={form.count}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            count: Math.max(1, Number.parseInt(event.target.value || "1", 10)),
                          }))
                        }
                      />
                    </div>

                    <Input
                      type="datetime-local"
                      value={form.until}
                      onChange={(event) => setForm((current) => ({ ...current, until: event.target.value }))}
                      placeholder="Optional recurrence end"
                    />

                    {form.frequency === "WEEKLY" ? (
                      <div className="flex flex-wrap gap-2">
                        {WEEKDAY_OPTIONS.map((weekday) => {
                          const selected = form.weekdays.includes(weekday.value);
                          return (
                            <button
                              type="button"
                              key={weekday.value}
                              className={cn(
                                "rounded-full border px-3 py-1 text-xs font-semibold",
                                selected ? "border-primary bg-primary/10 text-primary" : "border-slate-300 text-slate-600",
                              )}
                              onClick={() =>
                                setForm((current) => ({
                                  ...current,
                                  weekdays: selected
                                    ? current.weekdays.filter((value) => value !== weekday.value)
                                    : [...current.weekdays, weekday.value],
                                }))
                              }
                            >
                              {weekday.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          <SheetFooter>
            <Button type="button" variant="secondary" onClick={() => setIsCreateOpen(false)} disabled={submitting}>
              Close
            </Button>
            <Button type="button" onClick={() => void submitCreateOrEdit()} disabled={submitting}>
              {submitting ? "Saving..." : editingEvent ? "Save Changes" : "Create Event"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
