"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, ShieldCheck, UserCog, Users } from "lucide-react";

import { AddUserSheet } from "@/components/modules/users/add-user-sheet";
import { UserDetailSheet } from "@/components/modules/users/user-detail-sheet";
import { UsersTable } from "@/components/modules/users/users-table";
import { CandidateUsersTable } from "@/components/modules/users/candidate-users-table";
import { CandidateUserDetailSheet } from "@/components/modules/users/candidate-user-detail-sheet";
import { OnboardCandidateSheet } from "@/components/modules/users/onboard-candidate-sheet";
import { CanAccess } from "@/components/ui/can-access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { InternalUsersResponse, CandidateUsersResponse } from "@/types";

const EMPTY_RESPONSE: InternalUsersResponse = {
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: 10,
  pageCount: 1,
};

const EMPTY_CANDIDATE_RESPONSE: CandidateUsersResponse = {
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: 10,
  pageCount: 1,
};

type UserTab = "internal" | "candidates";

export default function UsersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<UserTab>((searchParams.get("tab") as UserTab) || "internal");
  const [response, setResponse] = useState<InternalUsersResponse>(EMPTY_RESPONSE);
  const [candidateResponse, setCandidateResponse] = useState<CandidateUsersResponse>(EMPTY_CANDIDATE_RESPONSE);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const searchParamsKey = searchParams.toString();

  const selectedUserId = searchParams.get("id");
  const search = searchParams.get("search") ?? "";
  const status = (searchParams.get("status") as "ALL" | "ACTIVE" | "INACTIVE" | null) ?? "ALL";

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams(searchParamsKey);
        params.delete("id");
        params.delete("tab");

        const endpoint = tab === "candidates" ? "/api/users/candidates" : "/api/users";
        const fetchResponse = await fetch(`${endpoint}?${params.toString()}`);
        const payload = (await fetchResponse.json().catch(() => null)) as { data?: InternalUsersResponse & CandidateUsersResponse; error?: string } | null;

        if (!fetchResponse.ok) {
          throw new Error(payload?.error || "Unable to load users.");
        }

        if (!cancelled) {
          if (tab === "candidates") {
            setCandidateResponse(payload?.data ?? EMPTY_CANDIDATE_RESPONSE);
          } else {
            setResponse(payload?.data ?? EMPTY_RESPONSE);
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load users.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadUsers();

    return () => {
      cancelled = true;
    };
  }, [searchParamsKey, refreshNonce, tab]);

  function refreshUsers() {
    setRefreshNonce((current) => current + 1);
  }

  function handleCloseSheet() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("id");
    router.replace(`/users?${params.toString()}`, { scroll: false });
  }

  function handleTabChange(nextTab: UserTab) {
    setTab(nextTab);
    const params = new URLSearchParams();
    if (nextTab !== "internal") params.set("tab", nextTab);
    router.replace(`/users?${params.toString()}`, { scroll: false });
  }

  const currentItems = tab === "candidates" ? candidateResponse.items : response.items;
  const currentTotalCount = tab === "candidates" ? candidateResponse.totalCount : response.totalCount;
  const activeUsersOnPage = currentItems.filter((user) => user.isActive).length;
  const resetRequiredOnPage = currentItems.filter((user) => user.requiresPasswordReset).length;
  const deliveredOnPage = currentItems.filter((user) => user.onboardingStatus === "sent").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">User Management</h1>
          <p className="mt-2 text-sm font-medium text-slate-500">
            {tab === "candidates"
              ? "Manage candidate accounts, onboarding, and communications."
              : "Create staff accounts, assign roles, and control onboarding from one place."}
          </p>
        </div>
        {tab === "internal" ? (
          <CanAccess permission="staff_users.create">
            <AddUserSheet onCreated={refreshUsers} />
          </CanAccess>
        ) : (
          <CanAccess permission="candidate_users.create">
            <OnboardCandidateSheet onCreated={refreshUsers} />
          </CanAccess>
        )}
      </div>

      <div className="flex gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
        <button
          type="button"
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${tab === "internal" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          onClick={() => handleTabChange("internal")}
        >
          <UserCog className="h-4 w-4" />
          Internal Users
        </button>
        <button
          type="button"
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${tab === "candidates" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          onClick={() => handleTabChange("candidates")}
        >
          <Users className="h-4 w-4" />
          Candidates
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">{tab === "candidates" ? "Candidate Users" : "Internal Users"}</CardTitle>
            <UserCog className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{isLoading ? "—" : currentTotalCount}</div>
            <p className="text-xs text-slate-500">Total matching the current filter set</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Active On Page</CardTitle>
            <ShieldCheck className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{isLoading ? "—" : activeUsersOnPage}</div>
            <p className="text-xs text-slate-500">Visible users with active access</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Onboarding Signals</CardTitle>
            <KeyRound className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{isLoading ? "—" : resetRequiredOnPage}</div>
            <p className="text-xs text-slate-500">Reset required · {isLoading ? "—" : deliveredOnPage} welcome emails delivered</p>
          </CardContent>
        </Card>
      </div>

      {error ? <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-600">{error}</div> : null}

      {isLoading ? (
        <UsersPageSkeleton />
      ) : tab === "candidates" ? (
        <CandidateUsersTable
          response={candidateResponse}
          filters={{ search, status }}
        />
      ) : (
        <UsersTable
          response={response}
          filters={{ search, status }}
        />
      )}

      {tab === "internal" ? (
        <UserDetailSheet userId={selectedUserId} open={Boolean(selectedUserId)} onOpenChange={(open) => !open && handleCloseSheet()} onUpdated={refreshUsers} />
      ) : (
        <CandidateUserDetailSheet userId={selectedUserId} open={Boolean(selectedUserId)} onOpenChange={(open) => !open && handleCloseSheet()} onUpdated={refreshUsers} />
      )}
    </div>
  );
}

function UsersPageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="space-y-3 p-6">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-36" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="space-y-4 p-4">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}