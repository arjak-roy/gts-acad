"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const DEFAULT_WARNING_SECONDS = 5 * 60;
const AUTH_ROUTES = new Set(["/login", "/forgot-password", "/reset-password", "/activate-account"]);

export const SESSION_EXPIRY_QUERY_KEY = ["auth", "me", "session-expiry"] as const;

class SessionExpiredError extends Error {
  constructor() {
    super("Session expired");
    this.name = "SessionExpiredError";
  }
}

type SessionPayload = {
  expiresAt: string | null;
};

function getWarningThresholdSeconds() {
  const rawValue = Number.parseInt(process.env.NEXT_PUBLIC_AUTH_SESSION_WARNING_SECONDS ?? "", 10);
  if (!Number.isFinite(rawValue) || rawValue < 60) {
    return DEFAULT_WARNING_SECONDS;
  }

  return Math.min(rawValue, 60 * 60);
}

function sanitizeNextPath(candidatePath: string) {
  if (!candidatePath.startsWith("/") || candidatePath.startsWith("//")) {
    return "/dashboard";
  }

  return candidatePath;
}

function formatRemainingTime(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

async function fetchSessionInfo(): Promise<SessionPayload> {
  const response = await fetch("/api/auth/me", { credentials: "include" });

  if (response.status === 401) {
    throw new SessionExpiredError();
  }

  if (!response.ok) {
    throw new Error("Unable to load session details.");
  }

  const payload = (await response.json()) as { data?: { session?: SessionPayload } };
  return payload.data?.session ?? { expiresAt: null };
}

export function SessionExpiryWarning() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const redirectingRef = useRef(false);
  const refetchingExpiredRef = useRef(false);
  const [now, setNow] = useState(() => Date.now());

  const isEnabled = Boolean(pathname) && !AUTH_ROUTES.has(pathname) && !pathname.startsWith("/api/");
  const search = searchParams.toString();
  const currentPath = pathname ? `${pathname}${search ? `?${search}` : ""}` : "/dashboard";

  const sessionQuery = useQuery({
    queryKey: SESSION_EXPIRY_QUERY_KEY,
    queryFn: fetchSessionInfo,
    enabled: isEnabled,
    staleTime: 30_000,
    refetchInterval: isEnabled ? 60_000 : false,
    retry: false,
  });

  useEffect(() => {
    if (!isEnabled || !sessionQuery.data?.expiresAt) {
      return;
    }

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1_000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isEnabled, sessionQuery.data?.expiresAt]);

  // Handle confirmed 401 from /api/auth/me — session is truly gone.
  useEffect(() => {
    if (redirectingRef.current) {
      return;
    }

    if (sessionQuery.error instanceof SessionExpiredError) {
      redirectingRef.current = true;
      router.replace(`/login?reason=session-expired&next=${encodeURIComponent(sanitizeNextPath(currentPath))}`);
      router.refresh();
    }
  }, [currentPath, router, sessionQuery.error]);

  const expiresAtMs = sessionQuery.data?.expiresAt ? Date.parse(sessionQuery.data.expiresAt) : NaN;
  const remainingMs = Number.isFinite(expiresAtMs) ? expiresAtMs - now : Number.NaN;

  // When cached expiresAt says expired, refetch to confirm with server
  // before redirecting. This prevents a redirect loop when the user just
  // re-authenticated and the stale cache still holds the old expiresAt.
  useEffect(() => {
    if (!isEnabled || redirectingRef.current || !Number.isFinite(remainingMs) || remainingMs > 0) {
      refetchingExpiredRef.current = false;
      return;
    }

    if (refetchingExpiredRef.current) {
      // Already triggered a refetch — if we're still here with remainingMs <= 0
      // after the refetch resolved, the session is genuinely expired.
      // But only redirect if the query isn't currently fetching (i.e. refetch completed).
      if (!sessionQuery.isFetching) {
        redirectingRef.current = true;
        router.replace(`/login?reason=session-expired&next=${encodeURIComponent(sanitizeNextPath(currentPath))}`);
        router.refresh();
      }
      return;
    }

    // First time hitting expired on cached data — invalidate and refetch
    // to pick up any new session cookie from a recent re-login.
    refetchingExpiredRef.current = true;
    void queryClient.invalidateQueries({ queryKey: [...SESSION_EXPIRY_QUERY_KEY] });
  }, [currentPath, isEnabled, remainingMs, router, sessionQuery.isFetching, queryClient]);

  if (!isEnabled || !Number.isFinite(remainingMs) || remainingMs <= 0) {
    return null;
  }

  const warningThresholdMs = getWarningThresholdSeconds() * 1_000;
  if (remainingMs > warningThresholdMs) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-full max-w-sm rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-xl shadow-amber-900/10">
      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-700">Session expiring soon</p>
      <h2 className="mt-2 text-lg font-bold text-slate-950">Save any unsaved work</h2>
      <p className="mt-2 text-sm text-slate-600">
        Your current sign-in will expire in {formatRemainingTime(remainingMs)}. Save your changes now and sign in again to continue.
      </p>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (redirectingRef.current) {
              return;
            }

            redirectingRef.current = true;
            router.replace(`/login?reason=session-expired&next=${encodeURIComponent(sanitizeNextPath(currentPath))}`);
            router.refresh();
          }}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-[#0d3b84] px-4 text-sm font-bold text-white transition-colors hover:bg-[#0b326f]"
        >
          Sign in again
        </button>
        <Link href="/sessions" className="text-sm font-bold text-[#0d3b84] hover:underline">
          Review sessions
        </Link>
      </div>
    </div>
  );
}