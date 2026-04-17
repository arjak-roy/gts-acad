"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Clock, MapPin, MoreHorizontal, Plus, Video } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { CanAccess } from "@/components/ui/can-access";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { sortByAccessor, type ActiveSortDirection } from "@/lib/table-sorting";
import { cn } from "@/lib/utils";
import { useRbac } from "@/lib/rbac-context";

type ViewMode = "month" | "week" | "day" | "list";
type EventType = "CLASS" | "TEST";
type EventStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "RESCHEDULED";
type ClassMode = "ONLINE" | "OFFLINE";
type RecurrenceFrequency = "DAILY" | "WEEKLY" | "MONTHLY";
type ScheduleContextType = "batch" | "learner" | "trainer";

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
  linkedAssessmentPoolId: string | null;
  linkedAssessmentPoolCode: string | null;
  linkedAssessmentPoolTitle: string | null;
  seriesId: string | null;
  occurrenceIndex: number;
  isRecurring: boolean;
};

type BatchOption = {
  id: string;
  code: string;
  name: string;
};

type AssignedBatchAssessment = {
  assessmentPoolId: string;
  assessmentTitle: string;
  assessmentCode: string;
  questionType: string;
  difficultyLevel: string;
  totalMarks: number;
  questionCount: number;
  scheduledAt: string | null;
};

type AvailableBatchAssessment = {
  id: string;
  code: string;
  title: string;
  questionType: string;
  difficultyLevel: string;
  totalMarks: number;
  questionCount: number;
};

type AssessmentOptionsResponse<T> = {
  data?: T[];
  error?: string;
};

type ScheduleAssessmentOption = {
  id: string;
  code: string;
  title: string;
  questionType: string;
  difficultyLevel: string;
  totalMarks: number;
  questionCount: number;
  scheduledAt: string | null;
  source: "assigned" | "available";
};

type ScheduleListSortKey = "batchCode" | "title" | "type" | "classMode" | "startsAt" | "status";

const scheduleListSortAccessors: Record<ScheduleListSortKey, (event: ScheduleEvent) => string> = {
  batchCode: (event) => event.batchCode,
  title: (event) => event.title,
  type: (event) => event.type,
  classMode: (event) => event.classMode ?? "",
  startsAt: (event) => event.startsAt,
  status: (event) => event.status,
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

type ScheduleContextOption = {
  id: string;
  label: string;
  meta: string | null;
};

type ScheduleContextOptionsResponse = {
  data: ScheduleContextOption[];
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
  linkedAssessmentPoolId: string;
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
  linkedAssessmentPoolId: "",
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
    linkedAssessmentPoolId: eventTypeSupportsCourseBuilderAssessment(form.type) ? form.linkedAssessmentPoolId || null : null,
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

function eventTypeSupportsCourseBuilderAssessment(type: EventType) {
  return type === "TEST";
}

function getEventTypeLabel(type: EventType) {
  return type === "TEST" ? "Assessment" : "Class";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function makeDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function getEventTypeStyle(type: EventType) {
  const styles = {
    CLASS:   { bg: "bg-blue-50",    text: "text-blue-700",   border: "border-blue-200",   dot: "bg-blue-500"    },
    TEST:    { bg: "bg-amber-50",   text: "text-amber-700",  border: "border-amber-200",  dot: "bg-amber-500"   },
  } satisfies Record<EventType, { bg: string; text: string; border: string; dot: string }>;
  return styles[type] ?? styles.CLASS;
}

function getStatusBadgeVariant(status: EventStatus) {
  switch (status) {
    case "IN_PROGRESS": return "warning" as const;
    case "COMPLETED":   return "success" as const;
    case "CANCELLED":   return "danger"  as const;
    case "RESCHEDULED": return "accent"  as const;
    default:            return "info"    as const;
  }
}

// ── Calendar Legend ───────────────────────────────────────────────────────────

function CalendarLegend() {
  const entries = [
    { type: "CLASS"   as EventType, label: "Class"   },
    { type: "TEST"    as EventType, label: "Assessment" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-4">
      {entries.map(({ type, label }) => {
        const style = getEventTypeStyle(type);
        return (
          <div key={type} className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", style.dot)} />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Month Calendar ────────────────────────────────────────────────────────────

const DOW_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function MonthCalendarView({
  events,
  baseDate,
  onEventClick,
  onDayClick,
}: {
  events: ScheduleEvent[];
  baseDate: Date;
  onEventClick?: (event: ScheduleEvent) => void;
  onDayClick?: (date: Date) => void;
}) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const today = new Date();
  const todayKey = makeDayKey(today);

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Array<{ date: Date; isCurrentMonth: boolean }> = [];
  for (let i = 0; i < firstDow; i++) {
    cells.push({ date: new Date(year, month, i - firstDow + 1), isCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), isCurrentMonth: true });
  }
  while (cells.length < 42) {
    cells.push({ date: new Date(year, month + 1, cells.length - firstDow - daysInMonth + 1), isCurrentMonth: false });
  }

  const eventsByDay = new Map<string, ScheduleEvent[]>();
  for (const event of events) {
    const key = makeDayKey(new Date(event.startsAt));
    if (!eventsByDay.has(key)) eventsByDay.set(key, []);
    eventsByDay.get(key)!.push(event);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {DOW_HEADERS.map((dow) => (
          <div key={dow} className="py-2.5 text-center text-[11px] font-bold uppercase tracking-widest text-slate-400">
            {dow}
          </div>
        ))}
      </div>

      {/* Grid cells */}
      <div className="grid grid-cols-7">
        {cells.map(({ date, isCurrentMonth }, index) => {
          const key = makeDayKey(date);
          const dayEvents = [...(eventsByDay.get(key) ?? [])].sort(
            (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
          );
          const isToday = key === todayKey;
          const overflow = Math.max(0, dayEvents.length - 3);

          return (
            <div
              key={index}
              className={cn(
                "group relative min-h-[100px] p-2 transition-colors",
                onDayClick && "cursor-pointer hover:bg-blue-50/30",
                index % 7 !== 6 && "border-r border-slate-100",
                index < 35 && "border-b border-slate-100",
                !isCurrentMonth && "bg-slate-50/40",
              )}
              onClick={onDayClick ? () => onDayClick(date) : undefined}
            >
              <div className="mb-1.5">
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-colors",
                    isToday
                      ? "bg-[#0d3b84] text-white"
                      : isCurrentMonth
                        ? "text-slate-700 group-hover:text-[#0d3b84]"
                        : "text-slate-300",
                  )}
                >
                  {date.getDate()}
                </span>
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((event) => {
                  const style = getEventTypeStyle(event.type);
                  return (
                    <button
                      type="button"
                      key={event.id}
                      onClick={onEventClick ? (e) => { e.stopPropagation(); onEventClick(event); } : (e) => e.stopPropagation()}
                      className={cn(
                        "block w-full truncate rounded px-1 py-[2px] text-left text-[10px] font-semibold leading-[14px] transition-opacity",
                        onEventClick ? "hover:opacity-75" : "cursor-default",
                        style.bg,
                        style.text,
                        event.status === "CANCELLED" && "line-through opacity-40",
                      )}
                    >
                      <span className="mr-0.5 opacity-60">{formatTime(event.startsAt)}</span>
                      {event.title}
                    </button>
                  );
                })}
                {overflow > 0 && (
                  <p className="pl-1 text-[10px] font-semibold text-slate-400">+{overflow} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Week Calendar ─────────────────────────────────────────────────────────────

function WeekCalendarView({
  events,
  baseDate,
  onEventClick,
  onDayClick,
}: {
  events: ScheduleEvent[];
  baseDate: Date;
  onEventClick?: (event: ScheduleEvent) => void;
  onDayClick?: (date: Date) => void;
}) {
  const today = new Date();
  const dow = baseDate.getDay();
  const monday = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate() - dow + (dow === 0 ? -6 : 1),
  );
  const days = Array.from({ length: 7 }, (_, i) =>
    new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i),
  );

  const eventsByDay = new Map<string, ScheduleEvent[]>();
  for (const event of events) {
    const key = makeDayKey(new Date(event.startsAt));
    if (!eventsByDay.has(key)) eventsByDay.set(key, []);
    eventsByDay.get(key)!.push(event);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {days.map((day, i) => {
          const isToday = isSameDay(day, today);
          return (
            <div key={i} className={cn("p-2.5 text-center", isToday && "bg-blue-50")}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {day.toLocaleDateString("en-IN", { weekday: "short" })}
              </p>
              <span
                className={cn(
                  "mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold",
                  isToday ? "bg-[#0d3b84] text-white" : "text-slate-700",
                )}
              >
                {day.getDate()}
              </span>
              <p className="mt-0.5 text-[10px] text-slate-400">
                {day.toLocaleDateString("en-IN", { month: "short" })}
              </p>
            </div>
          );
        })}
      </div>

      {/* Day columns */}
      <div className="grid min-h-[360px] grid-cols-7 divide-x divide-slate-100">
        {days.map((day, i) => {
          const key = makeDayKey(day);
          const dayEvents = [...(eventsByDay.get(key) ?? [])].sort(
            (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
          );
          const isToday = isSameDay(day, today);
          return (
            <div
              key={i}
              className={cn(
                "p-1.5 transition-colors",
                onDayClick && "cursor-pointer hover:bg-blue-50/20",
                isToday && "bg-blue-50/20",
              )}
              onClick={onDayClick ? () => onDayClick(day) : undefined}
            >
              {dayEvents.length === 0 ? (
                <div className="mt-8 text-center text-[11px] text-slate-300">No events</div>
              ) : (
                <div className="space-y-1">
                  {dayEvents.map((event) => {
                    const style = getEventTypeStyle(event.type);
                    return (
                      <button
                        type="button"
                        key={event.id}
                        onClick={onEventClick ? (e) => { e.stopPropagation(); onEventClick(event); } : (e) => e.stopPropagation()}
                        className={cn(
                          "w-full rounded-lg border p-1.5 text-left transition-all",
                          onEventClick && "hover:shadow-sm",
                          style.bg,
                          style.border,
                          event.status === "CANCELLED" && "opacity-40",
                        )}
                      >
                        <p className={cn("truncate text-[11px] font-bold leading-snug", style.text)}>
                          {event.title}
                        </p>
                        <p className={cn("mt-0.5 text-[10px] font-medium opacity-60", style.text)}>
                          {formatTime(event.startsAt)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Day Calendar ──────────────────────────────────────────────────────────────

const DAY_HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06:00 – 23:00

function DayCalendarView({
  events,
  baseDate,
  onEventClick,
  onCreateAtTime,
}: {
  events: ScheduleEvent[];
  baseDate: Date;
  onEventClick?: (event: ScheduleEvent) => void;
  onCreateAtTime?: (date: Date, hour: number) => void;
}) {
  const today = new Date();
  const isToday = isSameDay(baseDate, today);
  const currentHour = today.getHours();

  const dayEvents = events
    .filter((e) => isSameDay(new Date(e.startsAt), baseDate))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const eventsByHour = new Map<number, ScheduleEvent[]>();
  for (const event of dayEvents) {
    const hour = new Date(event.startsAt).getHours();
    if (!eventsByHour.has(hour)) eventsByHour.set(hour, []);
    eventsByHour.get(hour)!.push(event);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      {/* Day header */}
      <div className={cn("border-b border-slate-200 px-4 py-3", isToday ? "bg-blue-50" : "bg-slate-50")}>
        <div className="flex items-center gap-3">
          {isToday && (
            <span className="rounded-full bg-[#0d3b84] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              Today
            </span>
          )}
          <p className={cn("font-bold text-sm", isToday ? "text-[#0d3b84]" : "text-slate-800")}>
            {baseDate.toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          <span className="ml-auto text-[11px] font-medium text-slate-400">
            {dayEvents.length} {dayEvents.length === 1 ? "event" : "events"}
          </span>
        </div>
      </div>

      {/* Hourly rows */}
      <div className="divide-y divide-slate-100">
        {DAY_HOURS.map((hour) => {
          const hourEvents = eventsByHour.get(hour) ?? [];
          const timeLabel = `${String(hour).padStart(2, "0")}:00`;
          const isCurrentHour = isToday && currentHour === hour;

          return (
            <div
              key={hour}
              className={cn(
                "flex min-h-[52px] gap-0",
                hourEvents.length === 0 && onCreateAtTime && "cursor-pointer hover:bg-blue-50/20",
                isCurrentHour && "bg-amber-50/40",
              )}
              onClick={hourEvents.length === 0 && onCreateAtTime ? () => onCreateAtTime(baseDate, hour) : undefined}
            >
              {/* Time label */}
              <div
                className={cn(
                  "flex w-16 shrink-0 items-start justify-end pr-3 pt-3 text-[11px] font-semibold",
                  isCurrentHour ? "text-amber-600" : "text-slate-400",
                )}
              >
                {timeLabel}
              </div>

              {/* Vertical divider */}
              <div className={cn("w-px shrink-0", isCurrentHour ? "bg-amber-300" : "bg-slate-100")} />

              {/* Events */}
              <div className="flex-1 space-y-1.5 px-3 py-2">
                {hourEvents.map((event) => {
                  const style = getEventTypeStyle(event.type);
                  return (
                    <button
                      type="button"
                      key={event.id}
                      onClick={onEventClick ? (e) => { e.stopPropagation(); onEventClick(event); } : (e) => e.stopPropagation()}
                      className={cn(
                        "w-full rounded-xl border px-4 py-2.5 text-left transition-all",
                        onEventClick && "hover:shadow-md",
                        style.bg,
                        style.border,
                        event.status === "CANCELLED" && "opacity-40",
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className={cn("truncate font-bold text-sm", style.text)}>{event.title}</p>
                          <div className={cn("mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-medium opacity-70", style.text)}>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTime(event.startsAt)}
                              {event.endsAt ? ` – ${formatTime(event.endsAt)}` : ""}
                            </span>
                            {event.batchCode && <span>· {event.batchCode}</span>}
                            {event.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {event.location}
                              </span>
                            )}
                            {event.meetingUrl && (
                              <span className="flex items-center gap-1">
                                <Video className="h-3 w-3" />
                                Online
                              </span>
                            )}
                            {event.linkedAssessmentPoolCode || event.linkedAssessmentPoolTitle ? (
                              <span className="flex items-center gap-1">
                                <ClipboardList className="h-3 w-3" />
                                {event.linkedAssessmentPoolCode ?? event.linkedAssessmentPoolTitle}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide", style.bg, style.text)}>
                            {getEventTypeLabel(event.type)}
                          </span>
                          <span className="text-[10px] font-medium text-slate-400">
                            {event.status.replace("_", " ")}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ScheduleSection({ title, description }: { title: string; description: string }) {
  const { can } = useRbac();
  const canCreate = can("schedule.create");
  const canEdit   = can("schedule.edit");
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [baseDate, setBaseDate] = useState(new Date());
  const [scheduleContext, setScheduleContext] = useState<ScheduleContextType>("batch");
  const [batchFilter, setBatchFilter] = useState<string>("");
  const [learnerFilter, setLearnerFilter] = useState<string>("");
  const [trainerFilter, setTrainerFilter] = useState<string>("");
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [learnerOptions, setLearnerOptions] = useState<ScheduleContextOption[]>([]);
  const [trainerOptions, setTrainerOptions] = useState<ScheduleContextOption[]>([]);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contextOptionsLoading, setContextOptionsLoading] = useState(false);
  const [contextOptionsError, setContextOptionsError] = useState<string | null>(null);
  const [listSortState, setListSortState] = useState<{ column: ScheduleListSortKey; direction: ActiveSortDirection }>({
    column: "startsAt",
    direction: "asc",
  });
  const [assessmentOptions, setAssessmentOptions] = useState<ScheduleAssessmentOption[]>([]);
  const [assessmentOptionsLoading, setAssessmentOptionsLoading] = useState(false);
  const [assessmentOptionsError, setAssessmentOptionsError] = useState<string | null>(null);
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
  const rangeFromTime = range.from.getTime();
  const rangeToTime = range.to.getTime();
  const supportsAssessmentPool = eventTypeSupportsCourseBuilderAssessment(form.type);
  const selectedContextId = scheduleContext === "batch" ? batchFilter : scheduleContext === "learner" ? learnerFilter : trainerFilter;
  const contextSelectionRequired = scheduleContext !== "batch" && !selectedContextId;
  const canCreateInCurrentView = canCreate && scheduleContext === "batch";
  const sortedEvents = useMemo(
    () => sortByAccessor(events, listSortState.direction, scheduleListSortAccessors[listSortState.column]),
    [events, listSortState],
  );

  const handleListSort = (columnKey: string, direction: "asc" | "desc") => {
    setListSortState({ column: columnKey as ScheduleListSortKey, direction });
  };

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

  const loadContextOptions = useCallback(async () => {
    setContextOptionsLoading(true);
    setContextOptionsError(null);

    const fetchOptions = async (url: string, errorMessage: string) => {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(errorMessage);
      }

      const payload = (await response.json()) as ScheduleContextOptionsResponse;
      return payload.data ?? [];
    };

    const [learnerResult, trainerResult] = await Promise.allSettled([
      fetchOptions("/api/schedule/learners", "Failed to load learners."),
      fetchOptions("/api/schedule/trainers", "Failed to load trainers."),
    ]);

    const nextErrors: string[] = [];

    if (learnerResult.status === "fulfilled") {
      setLearnerOptions(learnerResult.value);
    } else {
      setLearnerOptions([]);
      nextErrors.push(learnerResult.reason instanceof Error ? learnerResult.reason.message : "Failed to load learners.");
    }

    if (trainerResult.status === "fulfilled") {
      setTrainerOptions(trainerResult.value);
    } else {
      setTrainerOptions([]);
      nextErrors.push(trainerResult.reason instanceof Error ? trainerResult.reason.message : "Failed to load trainers.");
    }

    setContextOptionsError(nextErrors[0] ?? null);
    setContextOptionsLoading(false);
  }, []);

  const loadEvents = useCallback(async () => {
    if (scheduleContext === "learner" && !learnerFilter) {
      setEvents([]);
      setLoading(false);
      setError(null);
      return;
    }

    if (scheduleContext === "trainer" && !trainerFilter) {
      setEvents([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        contextType: scheduleContext,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        page: "1",
        pageSize: "300",
      });

      if (scheduleContext === "batch" && batchFilter) {
        params.set("batchId", batchFilter);
      }

      if (scheduleContext === "learner") {
        params.set("learnerId", learnerFilter);
      }

      if (scheduleContext === "trainer") {
        params.set("trainerId", trainerFilter);
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
  }, [batchFilter, learnerFilter, range.from, range.to, scheduleContext, trainerFilter]);

  const loadAssessmentOptions = async (batchId: string) => {
    if (!batchId) {
      setAssessmentOptions([]);
      setAssessmentOptionsError(null);
      return;
    }

    setAssessmentOptionsLoading(true);
    setAssessmentOptionsError(null);

    try {
      const [assignedResponse, availableResponse] = await Promise.all([
        fetch(`/api/batch-content?batchId=${batchId}&type=assessment`, { cache: "no-store" }),
        fetch(`/api/batch-content?batchId=${batchId}&type=assessment&available=true`, { cache: "no-store" }),
      ]);

      if (!assignedResponse.ok || !availableResponse.ok) {
        throw new Error("Failed to load assessments for the selected batch.");
      }

      const assignedPayload = (await assignedResponse.json()) as AssessmentOptionsResponse<AssignedBatchAssessment>;
      const availablePayload = (await availableResponse.json()) as AssessmentOptionsResponse<AvailableBatchAssessment>;
      const merged = new Map<string, ScheduleAssessmentOption>();

      for (const assessment of assignedPayload.data ?? []) {
        merged.set(assessment.assessmentPoolId, {
          id: assessment.assessmentPoolId,
          code: assessment.assessmentCode,
          title: assessment.assessmentTitle,
          questionType: assessment.questionType,
          difficultyLevel: assessment.difficultyLevel,
          totalMarks: assessment.totalMarks,
          questionCount: assessment.questionCount,
          scheduledAt: assessment.scheduledAt,
          source: "assigned",
        });
      }

      for (const assessment of availablePayload.data ?? []) {
        if (merged.has(assessment.id)) {
          continue;
        }

        merged.set(assessment.id, {
          id: assessment.id,
          code: assessment.code,
          title: assessment.title,
          questionType: assessment.questionType,
          difficultyLevel: assessment.difficultyLevel,
          totalMarks: assessment.totalMarks,
          questionCount: assessment.questionCount,
          scheduledAt: null,
          source: "available",
        });
      }

      const nextOptions = Array.from(merged.values()).sort((left, right) => left.title.localeCompare(right.title));
      setAssessmentOptions(nextOptions);
      setForm((current) => (
        current.linkedAssessmentPoolId && !nextOptions.some((option) => option.id === current.linkedAssessmentPoolId)
          ? { ...current, linkedAssessmentPoolId: "" }
          : current
      ));
    } catch (loadError) {
      setAssessmentOptions([]);
      setAssessmentOptionsError(loadError instanceof Error ? loadError.message : "Failed to load assessments for the selected batch.");
    } finally {
      setAssessmentOptionsLoading(false);
    }
  };

  useEffect(() => {
    void loadBatches();
    void loadContextOptions();
  }, [loadContextOptions]);

  useEffect(() => {
    void loadEvents();
  }, [rangeFromTime, rangeToTime, batchFilter, loadEvents]);

  useEffect(() => {
    if (!isCreateOpen || !supportsAssessmentPool || !form.batchId) {
      setAssessmentOptions([]);
      setAssessmentOptionsError(null);
      return;
    }

    void loadAssessmentOptions(form.batchId);
  }, [form.batchId, isCreateOpen, supportsAssessmentPool]);

  const openCreate = (prefillDate?: Date, prefillHour?: number) => {
    const nextStart = prefillDate
      ? new Date(prefillDate.getFullYear(), prefillDate.getMonth(), prefillDate.getDate(), prefillHour ?? 9, 0, 0)
      : new Date(Date.now() + 60 * 60 * 1000);
    const nextEnd = new Date(nextStart.getTime() + 60 * 60 * 1000);

    setForm({
      ...DEFAULT_FORM,
      batchId: scheduleContext === "batch" ? batchFilter : "",
      startsAt: toLocalDateTimeInput(nextStart),
      endsAt: toLocalDateTimeInput(nextEnd),
    });
    setFormError(null);
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
      linkedAssessmentPoolId: event.linkedAssessmentPoolId ?? "",
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
      toast.success(editingEvent ? "Schedule event updated." : "Schedule event created.");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to save schedule event.";
      setFormError(message);
      toast.error(message);
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
      toast.success("Event cancelled.");
    } catch (cancelError) {
      const message = cancelError instanceof Error ? cancelError.message : "Failed to cancel event.";
      setError(message);
      toast.error(message);
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

          <CanAccess permission="schedule.create">
            <Button type="button" onClick={() => openCreate()} disabled={!canCreateInCurrentView}>
              <Plus className="mr-1 h-4 w-4" />
              Create Event
            </Button>
          </CanAccess>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Schedule Calendar
          </CardTitle>
          <CardDescription>Manage classes and assessments with batch, learner, and trainer schedule views.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">View</label>
              <div className="flex flex-wrap items-center gap-2">
                {([
                  { id: "batch", label: "Batch" },
                  { id: "learner", label: "Learner" },
                  { id: "trainer", label: "Trainer" },
                ] as Array<{ id: ScheduleContextType; label: string }>).map((contextOption) => (
                  <Button
                    key={contextOption.id}
                    type="button"
                    variant={scheduleContext === contextOption.id ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setScheduleContext(contextOption.id)}
                  >
                    {contextOption.label}
                  </Button>
                ))}
              </div>

              {scheduleContext === "batch" ? (
                <>
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Batch</label>
                  <select
                    value={batchFilter}
                    onChange={(event) => setBatchFilter(event.target.value)}
                    className="h-9 rounded-xl border border-[#dde1e6] bg-white px-3 text-sm text-slate-900 shadow-sm"
                  >
                    <option value="">All Batches</option>
                    {batches.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.code} – {batch.name}
                      </option>
                    ))}
                  </select>
                </>
              ) : null}

              {scheduleContext === "learner" ? (
                <>
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Learner</label>
                  <select
                    value={learnerFilter}
                    onChange={(event) => setLearnerFilter(event.target.value)}
                    className="h-9 min-w-[280px] rounded-xl border border-[#dde1e6] bg-white px-3 text-sm text-slate-900 shadow-sm"
                    disabled={contextOptionsLoading}
                  >
                    <option value="">Select learner</option>
                    {learnerOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.meta ? `${option.label} - ${option.meta}` : option.label}
                      </option>
                    ))}
                  </select>
                </>
              ) : null}

              {scheduleContext === "trainer" ? (
                <>
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Trainer</label>
                  <select
                    value={trainerFilter}
                    onChange={(event) => setTrainerFilter(event.target.value)}
                    className="h-9 min-w-[280px] rounded-xl border border-[#dde1e6] bg-white px-3 text-sm text-slate-900 shadow-sm"
                    disabled={contextOptionsLoading}
                  >
                    <option value="">Select trainer</option>
                    {trainerOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.meta ? `${option.label} - ${option.meta}` : option.label}
                      </option>
                    ))}
                  </select>
                </>
              ) : null}
            </div>
            {viewMode !== "list" && <CalendarLegend />}
          </div>

          {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p> : null}
          {contextOptionsError ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">{contextOptionsError}</p> : null}

          {contextSelectionRequired ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center">
              <p className="text-sm font-semibold text-slate-700">
                {scheduleContext === "learner"
                  ? "Select a learner to load events from every assigned batch."
                  : "Select a trainer to load events from every assigned batch."}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Aggregated schedule views keep the underlying batch events intact and bring them together in one calendar.
              </p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#0d3b84]" />
                Loading schedule...
              </div>
            </div>
          ) : viewMode === "month" ? (
            <MonthCalendarView
              events={events}
              baseDate={baseDate}
              onEventClick={canEdit ? openEdit : undefined}
              onDayClick={canCreateInCurrentView ? (date) => openCreate(date) : undefined}
            />
          ) : viewMode === "week" ? (
            <WeekCalendarView
              events={events}
              baseDate={baseDate}
              onEventClick={canEdit ? openEdit : undefined}
              onDayClick={canCreateInCurrentView ? (date) => openCreate(date) : undefined}
            />
          ) : viewMode === "day" ? (
            <DayCalendarView
              events={events}
              baseDate={baseDate}
              onEventClick={canEdit ? openEdit : undefined}
              onCreateAtTime={canCreateInCurrentView ? (date, hour) => openCreate(date, hour) : undefined}
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-100">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow>
                    <SortableTableHead label="Batch" columnKey="batchCode" activeSort={listSortState.column} activeDirection={listSortState.direction} onSort={handleListSort} />
                    <SortableTableHead label="Title" columnKey="title" activeSort={listSortState.column} activeDirection={listSortState.direction} onSort={handleListSort} />
                    <SortableTableHead label="Type" columnKey="type" activeSort={listSortState.column} activeDirection={listSortState.direction} onSort={handleListSort} />
                    <SortableTableHead label="Mode" columnKey="classMode" activeSort={listSortState.column} activeDirection={listSortState.direction} onSort={handleListSort} />
                    <SortableTableHead label="Start" columnKey="startsAt" activeSort={listSortState.column} activeDirection={listSortState.direction} onSort={handleListSort} />
                    <SortableTableHead label="Status" columnKey="status" activeSort={listSortState.column} activeDirection={listSortState.direction} onSort={handleListSort} />
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedEvents.length > 0 ? (
                    sortedEvents.map((event) => {
                      const style = getEventTypeStyle(event.type);
                      return (
                        <TableRow key={event.id} className={event.status === "CANCELLED" ? "opacity-50" : ""}>
                          <TableCell className="font-mono text-xs text-slate-500">{event.batchCode}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-semibold text-slate-900">{event.title}</p>
                              {event.isRecurring && <p className="text-[10px] text-slate-400">Recurring</p>}
                                {event.linkedAssessmentPoolCode || event.linkedAssessmentPoolTitle ? (
                                  <p className="text-[10px] text-slate-500">
                                    Assessment: {event.linkedAssessmentPoolCode ?? event.linkedAssessmentPoolTitle}
                                  </p>
                                ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold",
                                style.bg,
                                style.text,
                              )}
                            >
                              <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
                              {getEventTypeLabel(event.type)}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-slate-500">{event.classMode ?? "—"}</TableCell>
                          <TableCell className="text-xs text-slate-600">{formatDateTime(event.startsAt)}</TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(event.status)}>
                              {event.status.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9">
                                    <MoreHorizontal className="h-5 w-5" />
                                    <span className="sr-only">Open actions</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <CanAccess permission="schedule.edit">
                                    <DropdownMenuItem onSelect={() => openEdit(event)}>Edit</DropdownMenuItem>
                                  </CanAccess>
                                  {event.status !== "CANCELLED" ? (
                                    <CanAccess permission="schedule.delete">
                                      <DropdownMenuItem onSelect={() => void cancelEvent(event)}>Cancel</DropdownMenuItem>
                                    </CanAccess>
                                  ) : null}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center text-sm text-slate-400">
                        No schedule events in this range.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
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
            <SheetDescription>Configure calendar events for classes and assessments.</SheetDescription>
          </SheetHeader>

          <div className="space-y-4 p-6">
            {formError ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{formError}</p> : null}

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Batch</label>
              <select
                value={form.batchId}
                onChange={(event) => setForm((current) => ({ ...current, batchId: event.target.value, linkedAssessmentPoolId: "" }))}
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
                  onChange={(event) => {
                    const nextType = event.target.value as EventType;
                    setForm((current) => ({
                      ...current,
                      type: nextType,
                      linkedAssessmentPoolId: eventTypeSupportsCourseBuilderAssessment(nextType) ? current.linkedAssessmentPoolId : "",
                    }));
                  }}
                  className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm text-slate-900 shadow-sm"
                >
                  <option value="CLASS">CLASS</option>
                  <option value="TEST">ASSESSMENT</option>
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

            {supportsAssessmentPool ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Linked Assessment</label>
                <select
                  value={form.linkedAssessmentPoolId}
                  onChange={(event) => setForm((current) => ({ ...current, linkedAssessmentPoolId: event.target.value }))}
                  className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm text-slate-900 shadow-sm"
                  disabled={!form.batchId || assessmentOptionsLoading}
                >
                  <option value="">No linked assessment</option>
                  {assessmentOptions.map((assessment) => (
                    <option key={assessment.id} value={assessment.id}>
                      {`${assessment.code} - ${assessment.title}`}
                    </option>
                  ))}
                </select>
                <p className="text-xs leading-5 text-slate-500">
                  Choose a published assessment for this batch. If it is not already assigned, it will be added automatically.
                </p>
                {assessmentOptionsLoading ? <p className="text-xs text-slate-500">Loading batch assessment options...</p> : null}
                {assessmentOptionsError ? <p className="text-xs text-rose-600">{assessmentOptionsError}</p> : null}
                {!assessmentOptionsLoading && !assessmentOptionsError && form.batchId && assessmentOptions.length === 0 ? (
                  <p className="text-xs text-slate-500">No published assessments are available for this batch yet.</p>
                ) : null}
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
