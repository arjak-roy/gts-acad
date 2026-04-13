"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, RotateCcw, ShieldCheck, UserCog } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { CanAccess } from "@/components/ui/can-access";
import { useRbac } from "@/lib/rbac-context";
import { SUPER_ADMIN_ROLE_CODE, TRAINER_ROLE_CODE, isInternalUserRoleCode } from "@/lib/users/constants";
import type { InternalUserDetail } from "@/types";

type RoleOption = {
  id: string;
  name: string;
  code: string;
  isSystemRole: boolean;
  isActive: boolean;
};

type Props = {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Never";
  }

  return new Date(value).toLocaleString();
}

function statusVariant(isActive: boolean) {
  return isActive ? "success" : "danger";
}

function onboardingVariant(status: InternalUserDetail["onboardingStatus"]) {
  if (status === "sent") {
    return "success";
  }

  if (status === "failed") {
    return "danger";
  }

  if (status === "pending") {
    return "warning";
  }

  return "default";
}

export function UserDetailSheet({ userId, open, onOpenChange, onUpdated }: Props) {
  const { hasRole } = useRbac();
  const [user, setUser] = useState<InternalUserDetail | null>(null);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAssignSuperAdmin = hasRole(SUPER_ADMIN_ROLE_CODE);
  const isTrainerAccount = Boolean(user?.roles.some((role) => role.code === TRAINER_ROLE_CODE));
  const availableRoles = roles.filter(
    (role) => isInternalUserRoleCode(role.code)
      && (canAssignSuperAdmin || role.code !== SUPER_ADMIN_ROLE_CODE)
      && (role.code !== TRAINER_ROLE_CODE || isTrainerAccount),
  );

  useEffect(() => {
    if (!open || !userId) {
      return;
    }

    let cancelled = false;

    async function loadUser() {
      setIsLoading(true);
      setError(null);

      try {
        const [userResponse, rolesResponse] = await Promise.all([fetch(`/api/users/${userId}`), fetch("/api/roles")]);

        const userPayload = (await userResponse.json().catch(() => null)) as { data?: InternalUserDetail; error?: string } | null;
        const rolesPayload = (await rolesResponse.json().catch(() => null)) as { data?: RoleOption[]; error?: string } | null;

        if (!userResponse.ok) {
          throw new Error(userPayload?.error || "Unable to load the user.");
        }

        if (!rolesResponse.ok) {
          throw new Error(rolesPayload?.error || "Unable to load role options.");
        }

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
          setError(loadError instanceof Error ? loadError.message : "Unable to load the user.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadUser();

    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  useEffect(() => {
    if (!open) {
      setIsEditing(false);
      setError(null);
    }
  }, [open]);

  function toggleRole(roleId: string) {
    const selectedRole = availableRoles.find((role) => role.id === roleId);
    if (selectedRole?.code === TRAINER_ROLE_CODE) {
      return;
    }

    setSelectedRoleIds((current) => (current.includes(roleId) ? current.filter((value) => value !== roleId) : [...current, roleId]));
  }

  async function handleSave() {
    if (!user) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const [userResponse, rolesResponse] = await Promise.all([
        fetch(`/api/users/${user.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            phone: form.phone,
          }),
        }),
        fetch(`/api/users/${user.id}/roles`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            roleIds: selectedRoleIds,
          }),
        }),
      ]);

      const userPayload = (await userResponse.json().catch(() => null)) as { data?: InternalUserDetail; error?: string } | null;
      const rolesPayload = (await rolesResponse.json().catch(() => null)) as { data?: InternalUserDetail; error?: string } | null;

      if (!userResponse.ok) {
        throw new Error(userPayload?.error || "Unable to update the user.");
      }

      if (!rolesResponse.ok) {
        throw new Error(rolesPayload?.error || "Unable to update user roles.");
      }

      const nextUser = rolesPayload?.data ?? userPayload?.data ?? null;
      if (nextUser) {
        setUser(nextUser);
        setForm({
          name: nextUser.name,
          email: nextUser.email,
          phone: nextUser.phone ?? "",
        });
        setSelectedRoleIds(nextUser.roles.map((role) => role.id));
      }

      setIsEditing(false);
      onUpdated();
      toast.success("User updated successfully.");
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Unable to update the user.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLifecycleAction(action: "toggle-status" | "welcome" | "password-reset") {
    if (!user) {
      return;
    }

    setIsActionLoading(true);
    setError(null);

    try {
      let response: Response;

      if (action === "toggle-status") {
        response = await fetch(`/api/users/${user.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            isActive: !user.isActive,
          }),
        });
      } else if (action === "welcome") {
        response = await fetch(`/api/users/${user.id}/welcome`, {
          method: "POST",
        });
      } else {
        response = await fetch(`/api/users/${user.id}/password-reset`, {
          method: "POST",
        });
      }

      const payload = (await response.json().catch(() => null)) as { data?: InternalUserDetail; error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to complete the action.");
      }

      if (payload?.data) {
        setUser(payload.data);
      }

      onUpdated();
      toast.success(action === "toggle-status" ? (user.isActive ? "User deactivated." : "User activated.") : action === "welcome" ? "Welcome email sent." : "Password reset email sent.");
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : "Unable to complete the action.";
      setError(message);
      toast.error(message);
    } finally {
      setIsActionLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full max-w-xl flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{isLoading ? <Skeleton className="h-6 w-48" /> : user?.name ?? "User Details"}</SheetTitle>
          <SheetDescription>
            {isLoading ? "Loading user details..." : "Manage internal account details, role assignment, and onboarding actions."}
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
            <p className="text-sm text-slate-500">User not found.</p>
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
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Last Login</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{formatDate(user.lastLoginAt)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Created</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{formatDate(user.createdAt)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Phone</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{user.phone || "Not set"}</p>
                </div>
              </div>

              {isEditing ? (
                <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Full Name</label>
                    <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Email</label>
                    <Input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Phone</label>
                    <Input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
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
                    {availableRoles.map((role) => {
                      const trainerRoleManagedFromRegistry = role.code === TRAINER_ROLE_CODE;

                      return (
                        <label key={role.id} className="flex cursor-pointer items-start gap-3 rounded-xl px-2 py-2 hover:bg-slate-50">
                          <Checkbox
                            checked={selectedRoleIds.includes(role.id)}
                            disabled={trainerRoleManagedFromRegistry}
                            onCheckedChange={() => toggleRole(role.id)}
                          />
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{role.name}</p>
                            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">{role.code}</p>
                            {trainerRoleManagedFromRegistry ? <p className="text-xs text-slate-500">Trainer role is managed from the Trainer Registry.</p> : null}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {user.roles.length > 0 ? user.roles.map((role) => <Badge key={role.id} variant="info">{role.name}</Badge>) : <p className="text-sm text-slate-500">No internal roles assigned.</p>}
                  </div>
                )}
              </div>

              <CanAccess permission="staff_users.edit">
                <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2">
                    <UserCog className="h-4 w-4 text-slate-400" />
                    <h3 className="text-sm font-semibold text-slate-900">Account Actions</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => handleLifecycleAction("toggle-status")} disabled={isActionLoading}>
                      {isActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {user.isActive ? "Deactivate User" : "Activate User"}
                    </Button>
                    <Button variant="secondary" onClick={() => handleLifecycleAction("welcome")} disabled={isActionLoading || !user.isActive}>
                      <RotateCcw className="h-4 w-4" />
                      Resend Welcome
                    </Button>
                    <Button variant="secondary" onClick={() => handleLifecycleAction("password-reset")} disabled={isActionLoading || !user.isActive}>
                      <Mail className="h-4 w-4" />
                      Send Reset Link
                    </Button>
                  </div>
                </div>
              </CanAccess>
            </>
          )}
        </div>

        <SheetFooter className="border-t px-6 py-4">
          {isEditing ? (
            <div className="flex w-full justify-end gap-2">
              <Button variant="secondary" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving || !form.name.trim() || !form.email.trim() || selectedRoleIds.length === 0}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save Changes
              </Button>
            </div>
          ) : (
            <div className="flex w-full justify-end gap-2">
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <CanAccess permission="staff_users.edit">
                <Button onClick={() => setIsEditing(true)} disabled={!user}>
                  Edit User
                </Button>
              </CanAccess>
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
