"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";

import { CanAccess } from "@/components/ui/can-access";
import { sortByAccessor, type ActiveSortDirection } from "@/lib/table-sorting";

type SessionRecord = {
  id: string;
  device: string | null;
  browser: string | null;
  ipAddress: string | null;
  rememberMe: boolean;
  loginTime: string;
  lastActivityAt: string;
  expiresAt: string;
  isCurrent: boolean;
  status: "CURRENT" | "ACTIVE";
};

type SessionsPayload = {
  items: SessionRecord[];
  currentSessionId: string | null;
};

type SessionSortKey = "device" | "browser" | "loginTime" | "ipAddress" | "status";

const sessionSortAccessors: Record<SessionSortKey, (session: SessionRecord) => string> = {
  device: (session) => session.device ?? "",
  browser: (session) => session.browser ?? "",
  loginTime: (session) => session.loginTime,
  ipAddress: (session) => session.ipAddress ?? "",
  status: (session) => (session.isCurrent ? "Current" : session.status),
};

async function fetchSessions(): Promise<SessionsPayload> {
  const response = await fetch("/api/auth/sessions", { credentials: "include" });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "Unable to load active sessions.");
  }

  const payload = (await response.json()) as { data?: SessionsPayload };
  return payload.data ?? { items: [], currentSessionId: null };
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function SessionTableHeader({
  label,
  columnKey,
  activeSort,
  activeDirection,
  onSort,
}: {
  label: string;
  columnKey: SessionSortKey;
  activeSort: SessionSortKey;
  activeDirection: ActiveSortDirection;
  onSort: (columnKey: SessionSortKey, direction: ActiveSortDirection) => void;
}) {
  const isActive = activeSort === columnKey;
  const nextDirection = isActive && activeDirection === "asc" ? "desc" : "asc";

  return (
    <th className="px-6 py-4">
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-slate-600"
        onClick={() => onSort(columnKey, nextDirection)}
      >
        {label}
        {isActive && activeDirection === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : isActive && activeDirection === "desc" ? (
          <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  );
}

export default function SessionsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [sortState, setSortState] = useState<{ column: SessionSortKey; direction: ActiveSortDirection }>({
    column: "loginTime",
    direction: "desc",
  });

  const sessionsQuery = useQuery({
    queryKey: ["auth", "sessions"],
    queryFn: fetchSessions,
    staleTime: 30_000,
  });

  const terminateSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch(`/api/auth/sessions/${sessionId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to terminate that session right now.");
      }

      return sessionId;
    },
    onMutate: async (sessionId) => {
      setPendingSessionId(sessionId);
    },
    onSuccess: (sessionId) => {
      if (sessionId === sessionsQuery.data?.currentSessionId) {
        toast.success("Current session terminated. Redirecting to login.");
        router.replace("/login");
        router.refresh();
        return;
      }

      toast.success("Session terminated successfully.");
      queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] });
    },
    onSettled: () => {
      setPendingSessionId(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to terminate session.");
    },
  });

  const logoutAllMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/auth/logout-all", {
        method: "POST",
        credentials: "include",
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to logout from all devices right now.");
      }
    },
    onSuccess: () => {
      toast.success("Logged out from all devices.");
      router.replace("/login");
      router.refresh();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to logout from all devices.");
    },
  });

  const sessions = useMemo(() => sessionsQuery.data?.items ?? [], [sessionsQuery.data?.items]);
  const sortedSessions = useMemo(
    () => sortByAccessor(sessions, sortState.direction, sessionSortAccessors[sortState.column]),
    [sessions, sortState],
  );

  const handleSort = (columnKey: SessionSortKey, direction: ActiveSortDirection) => {
    setSortState({ column: columnKey, direction });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-3xl border border-[#dde1e6] bg-white p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-[#0d3b84]">Security</p>
          <h1 className="text-3xl font-bold text-slate-950">Session Management</h1>
          <p className="max-w-2xl text-sm text-slate-500">
            Review where your account is currently signed in, terminate stale sessions, and logout from all devices if you suspect unauthorized access.
          </p>
        </div>
        <CanAccess permission="sessions.manage">
          <button
            type="button"
            onClick={() => logoutAllMutation.mutate()}
            disabled={logoutAllMutation.isPending}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-rose-600 px-5 text-sm font-bold text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
          >
            {logoutAllMutation.isPending ? "Logging out..." : "Logout from all devices"}
          </button>
        </CanAccess>
      </div>

      <div className="rounded-3xl border border-[#dde1e6] bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-bold text-slate-950">Active Sessions</h2>
          <p className="mt-1 text-sm text-slate-500">Current device and any other active sign-ins are listed below.</p>
        </div>

        {sessionsQuery.isLoading ? (
          <div className="space-y-3 px-6 py-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : sessionsQuery.isError ? (
          <div className="px-6 py-8 text-sm font-semibold text-rose-600">
            {sessionsQuery.error instanceof Error ? sessionsQuery.error.message : "Unable to load active sessions."}
          </div>
        ) : sessions.length === 0 ? (
          <div className="px-6 py-10 text-sm text-slate-500">No active sessions were found for this account.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                  <SessionTableHeader label="Device" columnKey="device" activeSort={sortState.column} activeDirection={sortState.direction} onSort={handleSort} />
                  <SessionTableHeader label="Browser" columnKey="browser" activeSort={sortState.column} activeDirection={sortState.direction} onSort={handleSort} />
                  <SessionTableHeader label="Login Time" columnKey="loginTime" activeSort={sortState.column} activeDirection={sortState.direction} onSort={handleSort} />
                  <SessionTableHeader label="IP Address" columnKey="ipAddress" activeSort={sortState.column} activeDirection={sortState.direction} onSort={handleSort} />
                  <SessionTableHeader label="Status" columnKey="status" activeSort={sortState.column} activeDirection={sortState.direction} onSort={handleSort} />
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedSessions.map((session) => {
                  const isPendingAction = terminateSessionMutation.isPending && pendingSessionId === session.id;

                  return (
                    <tr key={session.id} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-6 py-5 align-top">
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-900">{session.device ?? "Unknown device"}</p>
                          <p className="text-xs text-slate-400">{session.rememberMe ? "Remembered session" : "Standard session"}</p>
                        </div>
                      </td>
                      <td className="px-6 py-5 align-top text-sm text-slate-600">{session.browser ?? "Unknown browser"}</td>
                      <td className="px-6 py-5 align-top">
                        <div className="space-y-1 text-sm text-slate-600">
                          <p>{formatDateTime(session.loginTime)}</p>
                          <p className="text-xs text-slate-400">Last active {formatDateTime(session.lastActivityAt)}</p>
                        </div>
                      </td>
                      <td className="px-6 py-5 align-top text-sm text-slate-600">{session.ipAddress ?? "Unknown"}</td>
                      <td className="px-6 py-5 align-top">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                            session.isCurrent ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {session.isCurrent ? "Current" : session.status}
                        </span>
                      </td>
                      <td className="px-6 py-5 align-top text-right">
                        <CanAccess permission="sessions.manage">
                          <button
                            type="button"
                            onClick={() => terminateSessionMutation.mutate(session.id)}
                            disabled={isPendingAction}
                            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition-colors hover:border-rose-200 hover:text-rose-600 disabled:opacity-50"
                          >
                            {isPendingAction ? "Terminating..." : session.isCurrent ? "End this session" : "Terminate"}
                          </button>
                        </CanAccess>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}