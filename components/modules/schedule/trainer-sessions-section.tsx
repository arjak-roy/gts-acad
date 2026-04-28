"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type TrainerCalendarEvent = {
  id: string;
  title: string;
  status: string;
  startsAt: string;
  endsAt: string | null;
  batchCode: string | null;
  batchName: string | null;
  location: string | null;
  sessionType: string | null;
  role: string;
};

type TrainerCalendarStats = {
  upcomingSessions: number;
  completedSessions: number;
  cancelledSessions: number;
  totalHours: number;
  currentWeek: { sessions: number; hours: number };
};

type TrainerCalendarStatsApi = {
  upcomingSessions?: number;
  completedSessions?: number;
  cancelledSessions?: number;
  totalHours?: number;
  currentWeek?: { sessions?: number; hours?: number };
  upcomingCount?: number;
  completedCount?: number;
  cancelledCount?: number;
  totalScheduledHours?: number;
  currentWeekSessions?: number;
  currentWeekHours?: number;
};

type TrainerOption = {
  id: string;
  label: string;
  meta: string | null;
};

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function getStatusColor(status: string) {
  switch (status) {
    case "COMPLETED": return "success" as const;
    case "CANCELLED": return "danger" as const;
    case "RESCHEDULED": return "accent" as const;
    case "IN_PROGRESS": return "warning" as const;
    default: return "info" as const;
  }
}

function normalizeTrainerStats(input: unknown): TrainerCalendarStats | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const source = input as TrainerCalendarStatsApi;

  const toFinite = (value: unknown, fallback = 0) => {
    const num = typeof value === "number" ? value : Number(value);
    return Number.isFinite(num) ? num : fallback;
  };

  return {
    upcomingSessions: toFinite(source.upcomingSessions ?? source.upcomingCount),
    completedSessions: toFinite(source.completedSessions ?? source.completedCount),
    cancelledSessions: toFinite(source.cancelledSessions ?? source.cancelledCount),
    totalHours: toFinite(source.totalHours ?? source.totalScheduledHours),
    currentWeek: {
      sessions: toFinite(source.currentWeek?.sessions ?? source.currentWeekSessions),
      hours: toFinite(source.currentWeek?.hours ?? source.currentWeekHours),
    },
  };
}

// ── Calendar helpers ──────────────────────────────────────────────────────────

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function calMakeDayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function calFormatTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function calIsSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getRoleStyle(role: string) {
  switch (role) {
    case "PRIMARY":    return { dot: "bg-blue-500",   text: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200" };
    case "CO_TRAINER": return { dot: "bg-amber-500",  text: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200" };
    case "REVIEWER":   return { dot: "bg-purple-500", text: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200" };
    default:           return { dot: "bg-slate-400",  text: "text-slate-700",  bg: "bg-slate-50",  border: "border-slate-200" };
  }
}

function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

// ── Month calendar ────────────────────────────────────────────────────────────

function TrainerMonthCalendarView({ events, baseDate }: { events: TrainerCalendarEvent[]; baseDate: Date }) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const today = new Date();
  const todayKey = calMakeDayKey(today);

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

  const eventsByDay = new Map<string, TrainerCalendarEvent[]>();
  for (const event of events) {
    const key = calMakeDayKey(new Date(event.startsAt));
    if (!eventsByDay.has(key)) eventsByDay.set(key, []);
    eventsByDay.get(key)!.push(event);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {DOW.map((d) => (
          <div key={d} className="py-2.5 text-center text-[11px] font-bold uppercase tracking-widest text-slate-400">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map(({ date, isCurrentMonth }, idx) => {
          const key = calMakeDayKey(date);
          const dayEvents = [...(eventsByDay.get(key) ?? [])].sort(
            (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
          );
          const isToday = key === todayKey;
          const overflow = Math.max(0, dayEvents.length - 3);

          return (
            <div
              key={idx}
              className={cn(
                "relative min-h-[90px] p-1.5",
                idx % 7 !== 6 && "border-r border-slate-100",
                idx < 35 && "border-b border-slate-100",
                !isCurrentMonth && "bg-slate-50/40",
              )}
            >
              <div className="mb-1">
                <span
                  className={cn(
                    "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold",
                    isToday ? "bg-[#0d3b84] text-white" : isCurrentMonth ? "text-slate-700" : "text-slate-300",
                  )}
                >
                  {date.getDate()}
                </span>
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((event) => {
                  const s = getRoleStyle(event.role);
                  return (
                    <div
                      key={event.id}
                      className={cn(
                        "flex w-full items-center gap-1 rounded px-1 py-[2px]",
                        s.bg,
                        event.status === "CANCELLED" && "line-through opacity-40",
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", s.dot)} />
                      <span className={cn("min-w-0 flex-1 truncate text-[10px] font-semibold", s.text)}>
                        <span className="mr-0.5 opacity-60">{calFormatTime(event.startsAt)}</span>
                        {event.title}
                      </span>
                    </div>
                  );
                })}
                {overflow > 0 && <p className="pl-1 text-[10px] font-semibold text-slate-400">+{overflow} more</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Week calendar ─────────────────────────────────────────────────────────────

function TrainerWeekCalendarView({ events, baseDate }: { events: TrainerCalendarEvent[]; baseDate: Date }) {
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

  const eventsByDay = new Map<string, TrainerCalendarEvent[]>();
  for (const event of events) {
    const key = calMakeDayKey(new Date(event.startsAt));
    if (!eventsByDay.has(key)) eventsByDay.set(key, []);
    eventsByDay.get(key)!.push(event);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {days.map((day, i) => {
          const isToday = calIsSameDay(day, today);
          return (
            <div key={i} className={cn("p-2 text-center", isToday && "bg-blue-50")}>
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
            </div>
          );
        })}
      </div>
      <div className="grid min-h-[300px] grid-cols-7 divide-x divide-slate-100">
        {days.map((day, i) => {
          const key = calMakeDayKey(day);
          const dayEvents = [...(eventsByDay.get(key) ?? [])].sort(
            (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
          );
          const isToday = calIsSameDay(day, today);
          return (
            <div key={i} className={cn("space-y-1 p-1.5", isToday && "bg-blue-50/20")}>
              {dayEvents.length === 0 ? (
                <div className="mt-8 text-center text-[11px] text-slate-300">—</div>
              ) : (
                dayEvents.map((event) => {
                  const s = getRoleStyle(event.role);
                  return (
                    <div
                      key={event.id}
                      className={cn(
                        "rounded-lg border p-1.5",
                        s.bg, s.border,
                        event.status === "CANCELLED" && "opacity-40",
                      )}
                    >
                      <p className={cn("truncate text-[11px] font-bold leading-snug", s.text)}>{event.title}</p>
                      <p className={cn("mt-0.5 text-[10px] font-medium opacity-60", s.text)}>
                        {calFormatTime(event.startsAt)}
                      </p>
                      {event.batchCode ? (
                        <p className={cn("mt-0.5 text-[9px] font-medium opacity-50", s.text)}>{event.batchCode}</p>
                      ) : null}
                      <div className="mt-1">
                        <Badge variant={getStatusColor(event.status)} className="text-[9px] px-1 py-0">
                          {event.role.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main section ──────────────────────────────────────────────────────────────

export function TrainerSessionsSection() {
  const [trainerOptions, setTrainerOptions] = useState<TrainerOption[]>([]);
  const [selectedTrainer, setSelectedTrainer] = useState("");
  const [stats, setStats] = useState<TrainerCalendarStats | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<TrainerCalendarEvent[]>([]);
  const [pastEvents, setPastEvents] = useState<TrainerCalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [calendarSubView, setCalendarSubView] = useState<"month" | "week">("month");
  const activeRequestRef = useRef(0);
  const activeControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/schedule/trainers", { cache: "no-store" });
        if (!response.ok) throw new Error();
        const payload = await response.json();
        setTrainerOptions(payload.data ?? []);
      } catch {
        toast.error("Failed to load trainers.");
      }
    })();
  }, []);

  const loadTrainerData = useCallback(async (trainerId: string) => {
    activeControllerRef.current?.abort();

    if (!trainerId) {
      activeRequestRef.current += 1;
      setStats(null);
      setUpcomingEvents([]);
      setPastEvents([]);
      setLoading(false);
      return;
    }

    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;
    const controller = new AbortController();
    activeControllerRef.current = controller;

    setLoading(true);

    try {
      const now = Date.now();
      const rangeStart = new Date(now - 120 * 24 * 60 * 60 * 1000).toISOString();
      const rangeEnd = new Date(now + 120 * 24 * 60 * 60 * 1000).toISOString();

      const [statsRes, calendarRes] = await Promise.all([
        fetch(`/api/trainers/${trainerId}/calendar/stats`, { cache: "no-store", signal: controller.signal }),
        fetch(`/api/trainers/${trainerId}/calendar?from=${rangeStart}&to=${rangeEnd}`, { cache: "no-store", signal: controller.signal }),
      ]);

      if (requestId !== activeRequestRef.current) {
        return;
      }

      if (statsRes.ok) {
        const statsPayload = await statsRes.json();
        if (requestId !== activeRequestRef.current) {
          return;
        }
        setStats(normalizeTrainerStats(statsPayload.data));
      } else {
        setStats(null);
      }

      if (calendarRes.ok) {
        const calendarPayload = await calendarRes.json();
        if (requestId !== activeRequestRef.current) {
          return;
        }
        const events: TrainerCalendarEvent[] = calendarPayload.data ?? [];
        const now = new Date();
        setUpcomingEvents(events.filter((e) => new Date(e.startsAt) >= now).slice(0, 20));
        setPastEvents(events.filter((e) => new Date(e.startsAt) < now).slice(0, 20));
      } else {
        setUpcomingEvents([]);
        setPastEvents([]);
      }

      if (!statsRes.ok || !calendarRes.ok) {
        toast.error("Failed to load complete trainer calendar data.");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      if (requestId === activeRequestRef.current) {
        setStats(null);
        setUpcomingEvents([]);
        setPastEvents([]);
      }
      toast.error("Failed to load trainer calendar data.");
    } finally {
      if (requestId === activeRequestRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadTrainerData(selectedTrainer);
  }, [selectedTrainer, loadTrainerData]);

  useEffect(() => () => {
    activeControllerRef.current?.abort();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">Trainer Sessions</h1>
        <p className="mt-2 max-w-3xl text-sm font-medium text-slate-500">
          View trainer session assignments, calendar stats, and upcoming/past sessions.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Trainer Calendar
          </CardTitle>
          <CardDescription>Select a trainer to view their session allocation and calendar stats.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Trainer</label>
            <select
              value={selectedTrainer}
              onChange={(e) => setSelectedTrainer(e.target.value)}
              className="h-9 min-w-[300px] rounded-xl border border-[#dde1e6] bg-white px-3 text-sm text-slate-900 shadow-sm"
            >
              <option value="">Select trainer</option>
              {trainerOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.meta ? `${opt.label} - ${opt.meta}` : opt.label}
                </option>
              ))}
            </select>
          </div>

          {!selectedTrainer ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center">
              <p className="text-sm font-semibold text-slate-700">Select a trainer to view their session calendar and stats.</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#0d3b84]" />
                Loading trainer data...
              </div>
            </div>
          ) : (
            <>
              {stats ? (
                <div className="grid gap-3 sm:grid-cols-5">
                  {[
                    { label: "Upcoming", value: stats.upcomingSessions, color: "text-blue-700" },
                    { label: "Completed", value: stats.completedSessions, color: "text-emerald-700" },
                    { label: "Cancelled", value: stats.cancelledSessions, color: "text-rose-700" },
                    { label: "Total Hours", value: `${stats.totalHours.toFixed(1)}h`, color: "text-slate-700" },
                    { label: "This Week", value: `${stats.currentWeek.sessions} sessions`, color: "text-amber-700" },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-2xl border border-slate-100 bg-white p-4 text-center shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">{stat.label}</p>
                      <p className={`mt-1 text-2xl font-extrabold ${stat.color}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* View mode toggle */}
              <div className="flex items-center gap-2">
                {(["list", "calendar"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
                      viewMode === mode
                        ? "bg-[#0d3b84] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                    )}
                  >
                    {mode === "list" ? "List" : "Calendar"}
                  </button>
                ))}
              </div>

              {viewMode === "list" ? (
                <>
                  {upcomingEvents.length > 0 ? (
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Upcoming Sessions</h3>
                      <div className="mt-2 space-y-2">
                        {upcomingEvents.map((event) => (
                          <div key={event.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold text-slate-900">{event.title}</p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDateTime(event.startsAt)}
                                </span>
                                {event.batchCode ? <span>{event.batchCode}</span> : null}
                                {event.sessionType ? <span>{event.sessionType.replaceAll("_", " ")}</span> : null}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <Badge variant="info">{event.role.replaceAll("_", " ")}</Badge>
                              <Badge variant={getStatusColor(event.status)}>{event.status.replaceAll("_", " ")}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {pastEvents.length > 0 ? (
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Past Sessions</h3>
                      <div className="mt-2 space-y-2">
                        {pastEvents.map((event) => (
                          <div key={event.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3 opacity-70 shadow-sm">
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold text-slate-900">{event.title}</p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDateTime(event.startsAt)}
                                </span>
                                {event.batchCode ? <span>{event.batchCode}</span> : null}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <Badge variant="info">{event.role.replaceAll("_", " ")}</Badge>
                              <Badge variant={getStatusColor(event.status)}>{event.status.replaceAll("_", " ")}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {upcomingEvents.length === 0 && pastEvents.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center">
                      <p className="text-sm text-slate-500">No session assignments found for this trainer.</p>
                    </div>
                  ) : null}
                </>
              ) : (
                /* ── Calendar view ── */
                <div className="space-y-3">
                  {/* Calendar toolbar */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setCalendarDate((prev) => {
                            const d = new Date(prev);
                            if (calendarSubView === "month") { d.setMonth(d.getMonth() - 1); } else { d.setDate(d.getDate() - 7); }
                            return d;
                          });
                        }}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCalendarDate(new Date())}
                        className="rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCalendarDate((prev) => {
                            const d = new Date(prev);
                            if (calendarSubView === "month") { d.setMonth(d.getMonth() + 1); } else { d.setDate(d.getDate() + 7); }
                            return d;
                          });
                        }}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <span className="ml-2 text-sm font-bold text-slate-800">
                        {calendarSubView === "month"
                          ? calendarDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" })
                          : (() => {
                              const dow = calendarDate.getDay();
                              const mon = new Date(calendarDate);
                              mon.setDate(mon.getDate() - dow + (dow === 0 ? -6 : 1));
                              const sun = new Date(mon);
                              sun.setDate(sun.getDate() + 6);
                              return `${mon.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${sun.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
                            })()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {(["month", "week"] as const).map((sub) => (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => setCalendarSubView(sub)}
                          className={cn(
                            "rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition-colors",
                            calendarSubView === sub
                              ? "bg-[#eef2ff] text-[#0d3b84]"
                              : "text-slate-500 hover:bg-slate-100",
                          )}
                        >
                          {sub === "month" ? "Month" : "Week"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Role legend */}
                  <div className="flex items-center gap-4 text-[11px] font-medium text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500" />Primary</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />Co-Trainer</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-purple-500" />Reviewer</span>
                    <span className="flex items-center gap-1.5 ml-auto"><Users className="h-3 w-3" />{upcomingEvents.length + pastEvents.length} total sessions</span>
                  </div>

                  {calendarSubView === "month" ? (
                    <TrainerMonthCalendarView
                      events={[...upcomingEvents, ...pastEvents]}
                      baseDate={calendarDate}
                    />
                  ) : (
                    <TrainerWeekCalendarView
                      events={[...upcomingEvents, ...pastEvents]}
                      baseDate={calendarDate}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
