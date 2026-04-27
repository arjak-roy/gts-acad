"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Clock } from "lucide-react";
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

export function TrainerSessionsSection() {
  const [trainerOptions, setTrainerOptions] = useState<TrainerOption[]>([]);
  const [selectedTrainer, setSelectedTrainer] = useState("");
  const [stats, setStats] = useState<TrainerCalendarStats | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<TrainerCalendarEvent[]>([]);
  const [pastEvents, setPastEvents] = useState<TrainerCalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

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
    if (!trainerId) {
      setStats(null);
      setUpcomingEvents([]);
      setPastEvents([]);
      return;
    }
    setLoading(true);
    try {
      const [statsRes, calendarRes] = await Promise.all([
        fetch(`/api/trainers/${trainerId}/calendar/stats`, { cache: "no-store" }),
        fetch(`/api/trainers/${trainerId}/calendar?from=${new Date().toISOString()}&to=${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()}`, { cache: "no-store" }),
      ]);

      if (statsRes.ok) {
        const statsPayload = await statsRes.json();
        setStats(statsPayload.data ?? null);
      }

      if (calendarRes.ok) {
        const calendarPayload = await calendarRes.json();
        const events: TrainerCalendarEvent[] = calendarPayload.data ?? [];
        const now = new Date();
        setUpcomingEvents(events.filter((e) => new Date(e.startsAt) >= now).slice(0, 20));
        setPastEvents(events.filter((e) => new Date(e.startsAt) < now).slice(0, 20));
      }
    } catch {
      toast.error("Failed to load trainer calendar data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTrainer) void loadTrainerData(selectedTrainer);
  }, [selectedTrainer, loadTrainerData]);

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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
