"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, ChevronDown, ChevronRight, Globe, Loader2, LogIn, Mail, Monitor, RotateCcw, Send, ShieldCheck, UserCog } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { CanAccess } from "@/components/ui/can-access";
import { useRbac } from "@/lib/rbac-context";
import type { CandidateUserDetail } from "@/types";

type RoleOption = {
  id: string;
  name: string;
  code: string;
  isSystemRole: boolean;
  isActive: boolean;
};

type ActivityLogItem = {
  id: string;
  activityType: string;
  ipAddress: string | null;
  device: string | null;
  browser: string | null;
  sessionId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

type ActivityResponse = {
  items: ActivityLogItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

type SessionHistoryItem = {
  id: string;
  device: string | null;
  browser: string | null;
  ipAddress: string | null;
  loginAt: string;
  lastActivityAt: string;
  expiresAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
  isActive: boolean;
};

type SessionHistoryResponse = {
  items: SessionHistoryItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

type CandidatePushReadinessSummary = {
  userId: string;
  activeDeviceCount: number;
  latestRegisteredAt: string | null;
  preferences: {
    pushNotificationsEnabled: boolean;
    batchAnnouncementsEnabled: boolean;
    assessmentAlertsEnabled: boolean;
  };
};

type PushDispatchSummary = {
  dispatchId: string;
  attemptedCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  failureMessages: string[];
};

type Props = {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
};

function formatDate(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

function statusVariant(isActive: boolean) {
  return isActive ? "success" : "danger";
}

function onboardingVariant(status: CandidateUserDetail["onboardingStatus"]) {
  if (status === "sent") return "success";
  if (status === "failed") return "danger";
  if (status === "pending") return "warning";
  return "default";
}

const ACTIVITY_LABELS: Record<string, string> = {
  LOGIN: "Login",
  LOGOUT: "Logout",
  LOGIN_FAILED: "Login Failed",
  SESSION_EXPIRED: "Session Expired",
  PAGE_VIEW: "Page View",
  FORCED_LOGOUT: "Forced Logout",
  PASSWORD_CHANGE: "Password Changed",
  ACCOUNT_ACTIVATED: "Account Activated",
  ACCOUNT_DEACTIVATED: "Account Deactivated",
};

const candidatePushDestinations = [
  { value: "NOTIFICATION_CENTER", label: "Notification Center" },
  { value: "DASHBOARD", label: "Dashboard" },
  { value: "ASSESSMENTS", label: "Assessments" },
  { value: "SUPPORT", label: "Support" },
] as const;

function getActivityLabel(type: string) {
  return ACTIVITY_LABELS[type] ?? type.replace(/_/g, " ");
}

function getActivityBadgeVariant(type: string): "success" | "danger" | "warning" | "info" | "default" {
  if (type === "LOGIN" || type === "ACCOUNT_ACTIVATED") return "success";
  if (type === "LOGIN_FAILED" || type === "FORCED_LOGOUT" || type === "ACCOUNT_DEACTIVATED") return "danger";
  if (type === "SESSION_EXPIRED" || type === "LOGOUT") return "warning";
  if (type === "PAGE_VIEW") return "info";
  return "default";
}

export function CandidateUserDetailSheet({ userId, open, onOpenChange, onUpdated }: Props) {
  const { can } = useRbac();
  const canViewPushReadiness = can("notifications.view") || can("notifications.send");
  const canSendPush = can("notifications.send");
  const [user, setUser] = useState<CandidateUserDetail | null>(null);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [mailForm, setMailForm] = useState({ subject: "", body: "" });
  const [pushForm, setPushForm] = useState({ title: "", body: "", destination: "NOTIFICATION_CENTER" as (typeof candidatePushDestinations)[number]["value"] });
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isSendingMail, setIsSendingMail] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(false);
  const [isSendingPush, setIsSendingPush] = useState(false);
  const [showMailForm, setShowMailForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushReadiness, setPushReadiness] = useState<CandidatePushReadinessSummary | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);

  const [activityExpanded, setActivityExpanded] = useState(false);
  const [activityData, setActivityData] = useState<ActivityResponse | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityPage, setActivityPage] = useState(1);

  const [sessionsExpanded, setSessionsExpanded] = useState(false);
  const [sessionsData, setSessionsData] = useState<SessionHistoryResponse | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsPage, setSessionsPage] = useState(1);

  useEffect(() => {
    if (!open || !userId) return;

    let cancelled = false;

    async function loadUser() {
      setIsLoading(true);
      setError(null);

      try {
        const [userResponse, rolesResponse] = await Promise.all([
          fetch(`/api/users/candidates/${userId}`),
          fetch("/api/roles"),
        ]);

        const userPayload = (await userResponse.json().catch(() => null)) as { data?: CandidateUserDetail; error?: string } | null;
        const rolesPayload = (await rolesResponse.json().catch(() => null)) as { data?: RoleOption[]; error?: string } | null;

        if (!userResponse.ok) throw new Error(userPayload?.error || "Unable to load the candidate.");
        if (!rolesResponse.ok) throw new Error(rolesPayload?.error || "Unable to load role options.");

        if (!cancelled) {
          const detail = userPayload?.data ?? null;
          setUser(detail);
          setRoles(rolesPayload?.data ?? []);
          setSelectedRoleIds(detail?.roles.map((role) => role.id) ?? []);
          setForm({
            name: detail?.name ?? "",
            email: detail?.email ?? "",
            phone: detail?.phone ?? "",
          });
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load the candidate.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadUser();
    return () => { cancelled = true; };
  }, [open, userId]);

  useEffect(() => {
    if (!open) {
      setIsEditing(false);
      setShowMailForm(false);
      setMailForm({ subject: "", body: "" });
      setPushForm({ title: "", body: "", destination: "NOTIFICATION_CENTER" });
      setError(null);
      setPushError(null);
      setPushReadiness(null);
      setActivityExpanded(false);
      setActivityData(null);
      setActivityPage(1);
      setSessionsExpanded(false);
      setSessionsData(null);
      setSessionsPage(1);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !userId || !canViewPushReadiness) {
      setPushReadiness(null);
      setPushError(null);
      setIsPushLoading(false);
      return;
    }

    let cancelled = false;

    async function loadPushReadiness() {
      setIsPushLoading(true);
      setPushError(null);

      try {
        const response = await fetch(`/api/users/candidates/${userId}/push`, { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as { data?: CandidatePushReadinessSummary; error?: string } | null;

        if (!response.ok) {
          throw new Error(payload?.error || "Unable to load push readiness.");
        }

        if (!cancelled) {
          setPushReadiness(payload?.data ?? null);
        }
      } catch (readinessError) {
        if (!cancelled) {
          setPushError(readinessError instanceof Error ? readinessError.message : "Unable to load push readiness.");
        }
      } finally {
        if (!cancelled) {
          setIsPushLoading(false);
        }
      }
    }

    void loadPushReadiness();

    return () => {
      cancelled = true;
    };
  }, [canViewPushReadiness, open, userId]);

  const loadActivity = useCallback(async (targetUserId: string, page: number) => {
    setActivityLoading(true);
    try {
      const response = await fetch(`/api/users/candidates/${targetUserId}/activity?page=${page}&pageSize=10`);
      const payload = (await response.json().catch(() => null)) as { data?: ActivityResponse } | null;
      if (response.ok && payload?.data) {
        setActivityData(payload.data);
      }
    } catch {
      // Silently handle — activity is supplementary.
    } finally {
      setActivityLoading(false);
    }
  }, []);

  const loadSessions = useCallback(async (targetUserId: string, page: number) => {
    setSessionsLoading(true);
    try {
      const response = await fetch(`/api/users/candidates/${targetUserId}/sessions?page=${page}&pageSize=10`);
      const payload = (await response.json().catch(() => null)) as { data?: SessionHistoryResponse } | null;
      if (response.ok && payload?.data) {
        setSessionsData(payload.data);
      }
    } catch {
      // Silently handle — sessions are supplementary.
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activityExpanded && userId) {
      loadActivity(userId, activityPage);
    }
  }, [activityExpanded, activityPage, userId, loadActivity]);

  useEffect(() => {
    if (sessionsExpanded && userId) {
      loadSessions(userId, sessionsPage);
    }
  }, [sessionsExpanded, sessionsPage, userId, loadSessions]);

  function toggleRole(roleId: string) {
    setSelectedRoleIds((current) =>
      current.includes(roleId) ? current.filter((v) => v !== roleId) : [...current, roleId],
    );
  }

  async function handleSave() {
    if (!user) return;

    setIsSaving(true);
    setError(null);

    try {
      const [userResponse, rolesResponse] = await Promise.all([
        fetch(`/api/users/candidates/${user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: form.name, email: form.email, phone: form.phone }),
        }),
        fetch(`/api/users/candidates/${user.id}/roles`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roleIds: selectedRoleIds }),
        }),
      ]);

      const userPayload = (await userResponse.json().catch(() => null)) as { data?: CandidateUserDetail; error?: string } | null;
      const rolesPayload = (await rolesResponse.json().catch(() => null)) as { data?: CandidateUserDetail; error?: string } | null;

      if (!userResponse.ok) throw new Error(userPayload?.error || "Unable to update the candidate.");
      if (!rolesResponse.ok) throw new Error(rolesPayload?.error || "Unable to update candidate roles.");

      const nextUser = rolesPayload?.data ?? userPayload?.data ?? null;
      if (nextUser) {
        setUser(nextUser);
        setForm({ name: nextUser.name, email: nextUser.email, phone: nextUser.phone ?? "" });
        setSelectedRoleIds(nextUser.roles.map((r) => r.id));
      }

      setIsEditing(false);
      onUpdated();
      toast.success("Candidate updated successfully.");
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Unable to update the candidate.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLifecycleAction(action: "toggle-status" | "welcome" | "password-reset") {
    if (!user) return;

    setIsActionLoading(true);
    setError(null);

    try {
      let response: Response;

      if (action === "toggle-status") {
        response = await fetch(`/api/users/candidates/${user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !user.isActive }),
        });
      } else if (action === "welcome") {
        response = await fetch(`/api/users/candidates/${user.id}/welcome`, { method: "POST" });
      } else {
        response = await fetch(`/api/users/candidates/${user.id}/password-reset`, { method: "POST" });
      }

      const payload = (await response.json().catch(() => null)) as { data?: CandidateUserDetail; error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Unable to complete the action.");

      if (payload?.data) setUser(payload.data);

      onUpdated();
      toast.success(
        action === "toggle-status"
          ? user.isActive ? "Candidate deactivated." : "Candidate activated."
          : action === "welcome"
            ? "Welcome email sent."
            : "Password reset email sent.",
      );
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : "Unable to complete the action.";
      setError(message);
      toast.error(message);
    } finally {
      setIsActionLoading(false);
    }
  }

  async function handleSendCustomMail() {
    if (!user) return;

    setIsSendingMail(true);
    setError(null);

    try {
      const response = await fetch(`/api/users/candidates/${user.id}/custom-mail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mailForm),
      });

      const payload = (await response.json().catch(() => null)) as { data?: { deliveryStatus?: "PENDING" | "SENT" }; error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Unable to send the email.");

      setShowMailForm(false);
      setMailForm({ subject: "", body: "" });
      toast.success(payload?.data?.deliveryStatus === "SENT" ? "Custom email sent successfully." : "Custom email queued successfully.");
    } catch (mailError) {
      const message = mailError instanceof Error ? mailError.message : "Unable to send the email.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSendingMail(false);
    }
  }

  async function handleSendPush() {
    if (!user) return;

    setIsSendingPush(true);
    setPushError(null);

    try {
      const response = await fetch(`/api/users/candidates/${user.id}/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pushForm),
      });

      const payload = (await response.json().catch(() => null)) as { data?: PushDispatchSummary; error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Unable to send the push notification.");

      const summary = payload?.data;
      setPushForm({ title: "", body: "", destination: "NOTIFICATION_CENTER" });

      if (canViewPushReadiness) {
        const readinessResponse = await fetch(`/api/users/candidates/${user.id}/push`, { cache: "no-store" });
        const readinessPayload = (await readinessResponse.json().catch(() => null)) as { data?: CandidatePushReadinessSummary } | null;

        if (readinessResponse.ok) {
          setPushReadiness(readinessPayload?.data ?? null);
        }
      }

      if ((summary?.sentCount ?? 0) > 0) {
        toast.success("Push notification sent successfully.");
      } else if ((summary?.skippedCount ?? 0) > 0 && (summary?.failedCount ?? 0) === 0) {
        toast.success("Notification saved to the candidate inbox. No active push device was available.");
      } else {
        toast.success("Push notification dispatched.");
      }
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : "Unable to send the push notification.";
      setPushError(message);
      toast.error(message);
    } finally {
      setIsSendingPush(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full max-w-xl flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{isLoading ? <Skeleton className="h-6 w-48" /> : user?.name ?? "Candidate Details"}</SheetTitle>
          <SheetDescription>
            {isLoading ? "Loading candidate details..." : "Manage candidate profile, role assignment, onboarding, and communication."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {error ? <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm font-semibold text-rose-600">{error}</div> : null}

          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : !user ? (
            <p className="text-sm text-slate-500">Candidate not found.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant(user.isActive)}>{user.isActive ? "Active" : "Inactive"}</Badge>
                <Badge variant={onboardingVariant(user.onboardingStatus)}>{user.onboardingStatus.replace("_", " ")}</Badge>
                {user.requiresPasswordReset ? <Badge variant="warning">Password Reset Required</Badge> : <Badge variant="info">Password Ready</Badge>}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Email</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{user.email}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Learner Code</p>
                  <p className="mt-2 font-mono text-sm font-semibold text-slate-900">{user.learnerCode ?? "—"}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Program</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{user.programName ?? "—"}</p>
                  {user.batchCode ? <p className="text-xs text-slate-500">{user.batchCode}</p> : null}
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Phone</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{user.phone || "Not set"}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Last Login</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{formatDate(user.lastLoginAt)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Created</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{formatDate(user.createdAt)}</p>
                </div>
              </div>

              {isEditing ? (
                <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Full Name</label>
                    <Input value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Email</label>
                    <Input type="email" value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Phone</label>
                    <Input value={form.phone} onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))} />
                  </div>
                </div>
              ) : null}

              <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-900">Role Assignment</h3>
                </div>
                {isEditing ? (
                  <div className="space-y-2">
                    {roles.filter((r) => r.isActive).map((role) => (
                      <label key={role.id} className="flex cursor-pointer items-start gap-3 rounded-xl px-2 py-2 hover:bg-slate-50">
                        <Checkbox checked={selectedRoleIds.includes(role.id)} onCheckedChange={() => toggleRole(role.id)} />
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{role.name}</p>
                          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">{role.code}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {user.roles.length > 0
                      ? user.roles.map((role) => <Badge key={role.id} variant="info">{role.name}</Badge>)
                      : <p className="text-sm text-slate-500">No roles assigned.</p>}
                  </div>
                )}
              </div>

              <CanAccess permission="candidate_users.edit">
                <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2">
                    <UserCog className="h-4 w-4 text-slate-400" />
                    <h3 className="text-sm font-semibold text-slate-900">Account Actions</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => handleLifecycleAction("toggle-status")} disabled={isActionLoading}>
                      {isActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {user.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button variant="secondary" onClick={() => handleLifecycleAction("welcome")} disabled={isActionLoading || !user.isActive}>
                      <RotateCcw className="h-4 w-4" />
                      Resend Welcome
                    </Button>
                    <Button variant="secondary" onClick={() => handleLifecycleAction("password-reset")} disabled={isActionLoading || !user.isActive}>
                      <Mail className="h-4 w-4" />
                      Send Reset Link
                    </Button>
                    <Button variant="secondary" onClick={() => setShowMailForm(!showMailForm)} disabled={isActionLoading || !user.isActive}>
                      <Send className="h-4 w-4" />
                      Custom Mail
                    </Button>
                  </div>
                </div>

                {showMailForm ? (
                  <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
                    <h3 className="text-sm font-semibold text-slate-900">Send Custom Email</h3>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">Subject</label>
                      <Input
                        value={mailForm.subject}
                        onChange={(e) => setMailForm((c) => ({ ...c, subject: e.target.value }))}
                        placeholder="Email subject..."
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">Body</label>
                      <textarea
                        className="min-h-[120px] w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        value={mailForm.body}
                        onChange={(e) => setMailForm((c) => ({ ...c, body: e.target.value }))}
                        placeholder="Write your message..."
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" onClick={() => setShowMailForm(false)}>Cancel</Button>
                      <Button
                        onClick={handleSendCustomMail}
                        disabled={isSendingMail || !mailForm.subject.trim() || mailForm.body.trim().length < 10}
                      >
                        {isSendingMail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        Send Email
                      </Button>
                    </div>
                  </div>
                ) : null}
              </CanAccess>

              {canViewPushReadiness ? (
                <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2">
                    <Send className="h-4 w-4 text-slate-400" />
                    <h3 className="text-sm font-semibold text-slate-900">Push Notifications</h3>
                  </div>

                  {pushError ? <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm font-medium text-amber-700">{pushError}</div> : null}

                  {isPushLoading ? (
                    <div className="grid gap-3 md:grid-cols-3">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <Skeleton key={index} className="h-20 w-full" />
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-slate-200 p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Active Devices</p>
                          <p className="mt-2 text-lg font-semibold text-slate-900">{pushReadiness?.activeDeviceCount ?? 0}</p>
                          <p className="mt-1 text-xs text-slate-500">Messages still create inbox history even when no active device is registered.</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Push State</p>
                          <p className="mt-2 text-lg font-semibold text-slate-900">{pushReadiness?.preferences.pushNotificationsEnabled ? "Enabled" : "Muted"}</p>
                          <p className="mt-1 text-xs text-slate-500">Assessment alerts: {pushReadiness?.preferences.assessmentAlertsEnabled ? "on" : "off"}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Last Registration</p>
                          <p className="mt-2 text-sm font-semibold text-slate-900">{formatDate(pushReadiness?.latestRegisteredAt ?? null)}</p>
                          <p className="mt-1 text-xs text-slate-500">Latest successful mobile token registration for this candidate.</p>
                        </div>
                      </div>

                      {canSendPush ? (
                        <div className="space-y-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4">
                          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-slate-500">Title</label>
                              <Input
                                value={pushForm.title}
                                onChange={(event) => setPushForm((current) => ({ ...current, title: event.target.value }))}
                                placeholder="Notification title..."
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-slate-500">Destination</label>
                              <select
                                value={pushForm.destination}
                                onChange={(event) => setPushForm((current) => ({ ...current, destination: event.target.value as (typeof candidatePushDestinations)[number]["value"] }))}
                                className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d3b84]"
                              >
                                {candidatePushDestinations.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-500">Message</label>
                            <textarea
                              className="min-h-[120px] w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
                              value={pushForm.body}
                              onChange={(event) => setPushForm((current) => ({ ...current, body: event.target.value }))}
                              placeholder="Write the push notification message..."
                            />
                          </div>

                          <p className="text-xs leading-5 text-slate-500">
                            {pushReadiness?.activeDeviceCount
                              ? "If the candidate has an active Expo token, the message will be sent as a push and stored in the in-app notification center."
                              : "This candidate has no active device token right now. The message will still be stored in the in-app notification center for the next sign-in."}
                          </p>

                          <div className="flex justify-end">
                            <Button
                              onClick={handleSendPush}
                              disabled={
                                isSendingPush ||
                                !user.isActive ||
                                !pushForm.title.trim() ||
                                pushForm.body.trim().length < 4
                              }
                            >
                              {isSendingPush ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                              Send Push
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">You can review device readiness here, but only notification senders can dispatch manual push messages.</p>
                      )}
                    </>
                  )}
                </div>
              ) : null}

              {/* Activity Log Section */}
              <div className="rounded-2xl border border-slate-200">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 p-4 text-left hover:bg-slate-50"
                  onClick={() => setActivityExpanded(!activityExpanded)}
                >
                  {activityExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                  <Activity className="h-4 w-4 text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-900">Activity Log</h3>
                  {activityData ? (
                    <span className="ml-auto text-xs text-slate-400">{activityData.totalCount} events</span>
                  ) : null}
                </button>

                {activityExpanded ? (
                  <div className="border-t px-4 pb-4">
                    {activityLoading && !activityData ? (
                      <div className="space-y-2 pt-3">
                        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                      </div>
                    ) : activityData && activityData.items.length > 0 ? (
                      <>
                        <div className="divide-y divide-slate-100">
                          {activityData.items.map((item) => (
                            <div key={item.id} className="flex items-start gap-3 py-3">
                              <div className="mt-0.5">
                                {item.activityType === "LOGIN" ? (
                                  <LogIn className="h-4 w-4 text-emerald-500" />
                                ) : item.activityType === "ACCOUNT_DEACTIVATED" || item.activityType === "FORCED_LOGOUT" ? (
                                  <Monitor className="h-4 w-4 text-rose-500" />
                                ) : (
                                  <Globe className="h-4 w-4 text-slate-400" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant={getActivityBadgeVariant(item.activityType)}>
                                    {getActivityLabel(item.activityType)}
                                  </Badge>
                                  <span className="text-[11px] text-slate-400">
                                    {new Date(item.createdAt).toLocaleString()}
                                  </span>
                                </div>
                                <div className="mt-1 flex gap-3 text-[11px] text-slate-400">
                                  {item.device ? <span>{item.device}</span> : null}
                                  {item.browser ? <span>{item.browser}</span> : null}
                                  {item.ipAddress ? <span>{item.ipAddress}</span> : null}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {activityData.pageCount > 1 ? (
                          <div className="flex items-center justify-between pt-2">
                            <span className="text-[11px] text-slate-400">
                              Page {activityData.page} of {activityData.pageCount}
                            </span>
                            <div className="flex gap-1">
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={activityPage <= 1 || activityLoading}
                                onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
                              >
                                Prev
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={activityPage >= activityData.pageCount || activityLoading}
                                onClick={() => setActivityPage((p) => p + 1)}
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <p className="pt-3 text-sm text-slate-500">No activity recorded yet.</p>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Session History Section */}
              <div className="rounded-2xl border border-slate-200">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 p-4 text-left hover:bg-slate-50"
                  onClick={() => setSessionsExpanded(!sessionsExpanded)}
                >
                  {sessionsExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                  <Monitor className="h-4 w-4 text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-900">Session History</h3>
                  {sessionsData ? (
                    <span className="ml-auto text-xs text-slate-400">{sessionsData.totalCount} sessions</span>
                  ) : null}
                </button>

                {sessionsExpanded ? (
                  <div className="border-t px-4 pb-4">
                    {sessionsLoading && !sessionsData ? (
                      <div className="space-y-2 pt-3">
                        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                      </div>
                    ) : sessionsData && sessionsData.items.length > 0 ? (
                      <>
                        <div className="divide-y divide-slate-100">
                          {sessionsData.items.map((item) => (
                            <div key={item.id} className="flex items-start gap-3 py-3">
                              <div className="mt-0.5">
                                <Monitor className={`h-4 w-4 ${item.isActive ? "text-emerald-500" : "text-slate-300"}`} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant={item.isActive ? "success" : item.revokedAt ? "danger" : "default"}>
                                    {item.isActive ? "Active" : item.revokedAt ? "Revoked" : "Expired"}
                                  </Badge>
                                  {item.revokedReason ? (
                                    <span className="text-[11px] text-slate-400">{item.revokedReason}</span>
                                  ) : null}
                                </div>
                                <div className="mt-1 flex gap-3 text-[11px] text-slate-400">
                                  {item.device ? <span>{item.device}</span> : null}
                                  {item.browser ? <span>{item.browser}</span> : null}
                                  {item.ipAddress ? <span>{item.ipAddress}</span> : null}
                                </div>
                                <div className="mt-0.5 text-[11px] text-slate-400">
                                  Login: {new Date(item.loginAt).toLocaleString()}
                                  {" · "}
                                  Last active: {new Date(item.lastActivityAt).toLocaleString()}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {sessionsData.pageCount > 1 ? (
                          <div className="flex items-center justify-between pt-2">
                            <span className="text-[11px] text-slate-400">
                              Page {sessionsData.page} of {sessionsData.pageCount}
                            </span>
                            <div className="flex gap-1">
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={sessionsPage <= 1 || sessionsLoading}
                                onClick={() => setSessionsPage((p) => Math.max(1, p - 1))}
                              >
                                Prev
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={sessionsPage >= sessionsData.pageCount || sessionsLoading}
                                onClick={() => setSessionsPage((p) => p + 1)}
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <p className="pt-3 text-sm text-slate-500">No session history available.</p>
                    )}
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>

        <SheetFooter className="border-t px-6 py-4">
          {isEditing ? (
            <div className="flex w-full justify-end gap-2">
              <Button variant="secondary" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={isSaving || !form.name.trim() || !form.email.trim() || selectedRoleIds.length === 0}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save Changes
              </Button>
            </div>
          ) : (
            <div className="flex w-full justify-end gap-2">
              <Button variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
              <CanAccess permission="candidate_users.edit">
                <Button onClick={() => setIsEditing(true)} disabled={!user}>Edit Candidate</Button>
              </CanAccess>
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
