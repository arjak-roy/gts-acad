"use client";

import { useEffect, useMemo, useState } from "react";

import { ASSIGNABLE_STAFF_MODULES, type AssignableStaffModuleKey } from "@/lib/auth/module-access";
import type { ManagedAccessUser } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AccessControlManagerProps = {
  users: ManagedAccessUser[];
};

export function AccessControlManager({ users }: AccessControlManagerProps) {
  const [selectedRole, setSelectedRole] = useState<ManagedAccessUser["role"]>("ADMIN");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [assignedModules, setAssignedModules] = useState<Record<string, AssignableStaffModuleKey[]>>(
    Object.fromEntries(users.map((user) => [user.userId, user.modules as AssignableStaffModuleKey[]])),
  );
  const [savedModules, setSavedModules] = useState<Record<string, AssignableStaffModuleKey[]>>(
    Object.fromEntries(users.map((user) => [user.userId, user.modules as AssignableStaffModuleKey[]])),
  );
  const [submittingUserId, setSubmittingUserId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  const roleUsers = useMemo(() => users.filter((user) => user.role === selectedRole), [selectedRole, users]);

  useEffect(() => {
    if (roleUsers.length === 0) {
      setSelectedUserId("");
      return;
    }

    if (!roleUsers.some((user) => user.userId === selectedUserId)) {
      setSelectedUserId(roleUsers[0]?.userId ?? "");
    }
  }, [roleUsers, selectedUserId]);

  const selectedUser = useMemo(
    () => roleUsers.find((user) => user.userId === selectedUserId) ?? null,
    [roleUsers, selectedUserId],
  );

  const dirtyUserIds = useMemo(
    () =>
      users
        .filter((user) => {
          const current = [...(assignedModules[user.userId] ?? [])].sort().join(",");
          const saved = [...(savedModules[user.userId] ?? [])].sort().join(",");
          return current !== saved;
        })
        .map((user) => user.userId),
    [assignedModules, savedModules, users],
  );

  const toggleModule = (userId: string, moduleKey: AssignableStaffModuleKey) => {
    setAssignedModules((current) => {
      const existing = current[userId] ?? [];
      const nextModules = existing.includes(moduleKey) ? existing.filter((value) => value !== moduleKey) : [...existing, moduleKey];
      return {
        ...current,
        [userId]: nextModules.sort(),
      };
    });
  };

  const saveModules = async (userId: string) => {
    setSubmittingUserId(userId);
    setFeedback((current) => ({ ...current, [userId]: "" }));

    try {
      const response = await fetch(`/api/access-control/users/${userId}/modules`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ modules: assignedModules[userId] ?? [] }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string; data?: ManagedAccessUser } | null;
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error || "Failed to save module access.");
      }

      setAssignedModules((current) => ({ ...current, [userId]: payload.data?.modules as AssignableStaffModuleKey[] }));
      setSavedModules((current) => ({ ...current, [userId]: payload.data?.modules as AssignableStaffModuleKey[] }));
      setFeedback((current) => ({ ...current, [userId]: "Saved. Changes apply on the user's next sign-in." }));
    } catch (error) {
      setFeedback((current) => ({
        ...current,
        [userId]: error instanceof Error ? error.message : "Failed to save module access.",
      }));
    } finally {
      setSubmittingUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Module Access Control</CardTitle>
            <CardDescription>Super Admin can allow only the modules each admin or trainer should see and use.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              Access here is additive and user-specific. Super Admin keeps full access through the global role. Trainers and scoped admins only see modules granted below.
            </p>
            <p className="text-sm text-slate-500">Session tokens cache permissions, so a user should sign out and sign back in after changes.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scope Snapshot</CardTitle>
            <CardDescription>Assignable modules available for staff users.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {ASSIGNABLE_STAFF_MODULES.map((module) => (
              <Badge key={module.key} variant="info">
                {module.label}
              </Badge>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Role To User Access Flow</CardTitle>
          <CardDescription>Select a role first, then choose a user from that role, then configure module permissions below.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Role</label>
              <select
                className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700"
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value as ManagedAccessUser["role"])}
              >
                <option value="ADMIN">Admin</option>
                <option value="TRAINER">Trainer</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{selectedRole === "ADMIN" ? "Admin Name" : "Trainer Name"}</label>
              <select
                className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700"
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
              >
                {roleUsers.length === 0 ? <option value="">No users available</option> : null}
                {roleUsers.map((user) => (
                  <option key={user.userId} value={user.userId}>
                    {user.fullName} - {user.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedUser ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <InfoTile label="User" value={selectedUser.fullName} helper={selectedUser.email} />
                <InfoTile label="Role" value={selectedUser.role} helper={selectedUser.specialization ?? "No specialization"} />
                <InfoTile label="Permission Tab" value="Module Access" helper="Toggle permissions below" />
              </div>

              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {ASSIGNABLE_STAFF_MODULES.map((module) => {
                  const checked = (assignedModules[selectedUser.userId] ?? []).includes(module.key);

                  return (
                    <button
                      key={module.key}
                      type="button"
                      onClick={() => toggleModule(selectedUser.userId, module.key)}
                      className={`rounded-2xl border px-3 py-3 text-left text-sm transition-colors ${checked ? "border-[#0d3b84] bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{module.label}</p>
                          <p className="mt-1 text-xs text-slate-500">{module.description}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${checked ? "bg-[#0d3b84] text-white" : "bg-slate-100 text-slate-500"}`}>
                          {checked ? "On" : "Off"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-sm text-slate-600">{feedback[selectedUser.userId] ?? "Save after changing permissions for the selected user."}</p>
                <Button type="button" onClick={() => void saveModules(selectedUser.userId)} disabled={!dirtyUserIds.includes(selectedUser.userId) || submittingUserId === selectedUser.userId}>
                  {submittingUserId === selectedUser.userId ? "Saving..." : "Save Access"}
                </Button>
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">No users found for the selected role.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoTile({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-2 font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}