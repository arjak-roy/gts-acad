"use client";

import { useMemo, useState } from "react";

import { ASSIGNABLE_STAFF_MODULES, type AssignableStaffModuleKey } from "@/lib/auth/module-access";
import type { ManagedAccessUser } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AccessControlManagerProps = {
  users: ManagedAccessUser[];
};

export function AccessControlManager({ users }: AccessControlManagerProps) {
  const [query, setQuery] = useState("");
  const [assignedModules, setAssignedModules] = useState<Record<string, AssignableStaffModuleKey[]>>(
    Object.fromEntries(users.map((user) => [user.userId, user.modules as AssignableStaffModuleKey[]])),
  );
  const [savedModules, setSavedModules] = useState<Record<string, AssignableStaffModuleKey[]>>(
    Object.fromEntries(users.map((user) => [user.userId, user.modules as AssignableStaffModuleKey[]])),
  );
  const [submittingUserId, setSubmittingUserId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return users.filter((user) => {
      if (!normalizedQuery) {
        return true;
      }

      return [user.fullName, user.email, user.role, user.specialization ?? ""].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [query, users]);

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
        <CardHeader className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <CardTitle>Admins and Trainers</CardTitle>
            <CardDescription>Only admin and trainer accounts are manageable here.</CardDescription>
          </div>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, email, role, or specialization" className="max-w-sm" />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Module Access</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => {
                const currentModules = assignedModules[user.userId] ?? [];
                const isDirty = dirtyUserIds.includes(user.userId);

                return (
                  <TableRow key={user.userId}>
                    <TableCell>
                      <div>
                        <p className="font-semibold text-slate-900">{user.fullName}</p>
                        <p className="text-sm text-slate-500">{user.email}</p>
                        {user.specialization ? <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{user.specialization}</p> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <Badge variant={user.role === "ADMIN" ? "default" : "info"}>{user.role}</Badge>
                        <p className="text-xs text-slate-500">{user.isActive ? "Active account" : "Inactive account"}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {ASSIGNABLE_STAFF_MODULES.map((module) => {
                          const checked = currentModules.includes(module.key);

                          return (
                            <label key={module.key} className={`rounded-2xl border px-3 py-3 text-sm transition-colors ${checked ? "border-[#0d3b84] bg-blue-50" : "border-slate-200 bg-white"}`}>
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                                  checked={checked}
                                  onChange={() => toggleModule(user.userId, module.key)}
                                />
                                <div>
                                  <p className="font-semibold text-slate-900">{module.label}</p>
                                  <p className="mt-1 text-xs text-slate-500">{module.description}</p>
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                      {feedback[user.userId] ? <p className="mt-3 text-sm text-slate-600">{feedback[user.userId]}</p> : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button type="button" onClick={() => void saveModules(user.userId)} disabled={!isDirty || submittingUserId === user.userId}>
                        {submittingUserId === user.userId ? "Saving..." : "Save Access"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {filteredUsers.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No matching staff users found.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}