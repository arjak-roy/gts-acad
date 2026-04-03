"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { assignRoleToUser } from "@/app/super-admin/roles/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatRoleLabel } from "@/lib/utils";
import type { StaffRoleAssignmentUser, StaffRoleOption } from "@/types";

const staffRoleManagerSchema = z.object({
  query: z.string().default(""),
  selectedRoles: z.record(z.string()).default({}),
  quickAssignUserId: z.string().default(""),
  quickAssignRoleId: z.string().default(""),
});

type StaffRoleManagerValues = z.infer<typeof staffRoleManagerSchema>;

type StaffRoleManagerProps = {
  users: StaffRoleAssignmentUser[];
  roles: StaffRoleOption[];
};

export function StaffRoleManager({ users, roles }: StaffRoleManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [expandedUserId, setExpandedUserId] = useState<string | null>(users[0]?.userId ?? null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const form = useForm<StaffRoleManagerValues>({
    resolver: zodResolver(staffRoleManagerSchema),
    defaultValues: {
      query: "",
      selectedRoles: Object.fromEntries(users.map((user) => [user.userId, user.currentRoleId ?? ""])),
    },
  });

  const query = form.watch("query");
  const selectedRoles = form.watch("selectedRoles");
  const quickAssignUserId = form.watch("quickAssignUserId");
  const quickAssignRoleId = form.watch("quickAssignRoleId");

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return users.filter((user) => {
      if (!normalizedQuery) {
        return true;
      }

      return [user.fullName, user.email, user.accountType, user.currentRoleName ?? "", user.specialization ?? ""]
        .some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [query, users]);

  const saveAssignment = (userId: string) => {
    const selectedRoleId = selectedRoles[userId];
    if (!selectedRoleId) {
      setFeedback((current) => ({ ...current, [userId]: "Select a role before saving." }));
      return;
    }

    setSavingUserId(userId);
    setFeedback((current) => ({ ...current, [userId]: "" }));

    startTransition(async () => {
      try {
        await assignRoleToUser(userId, selectedRoleId);
        const roleName = formatRoleLabel(roles.find((role) => role.id === selectedRoleId)?.name) || "assigned";
        setFeedback((current) => ({ ...current, [userId]: `Saved. ${roleName} is now assigned.` }));
      } catch (error) {
        setFeedback((current) => ({
          ...current,
          [userId]: error instanceof Error ? error.message : "Failed to assign role.",
        }));
      } finally {
        setSavingUserId(null);
      }
    });
  };

  const handleQuickAssign = () => {
    if (!quickAssignUserId || !quickAssignRoleId) {
      setFeedback((current) => ({ ...current, quickAssign: "Select both a user and a role before saving." }));
      return;
    }

    setSavingUserId(quickAssignUserId);
    setFeedback((current) => ({ ...current, quickAssign: "" }));

    startTransition(async () => {
      try {
        await assignRoleToUser(quickAssignUserId, quickAssignRoleId);
        const roleName = formatRoleLabel(roles.find((role) => role.id === quickAssignRoleId)?.name) || "assigned";
        const userName = users.find((user) => user.userId === quickAssignUserId)?.fullName ?? "User";

        form.setValue(`selectedRoles.${quickAssignUserId}`, quickAssignRoleId, { shouldDirty: true });
        setExpandedUserId(quickAssignUserId);
        setFeedback((current) => ({
          ...current,
          quickAssign: `${userName} is now assigned to ${roleName}.`,
          [quickAssignUserId]: `Saved. ${roleName} is now assigned.`,
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to assign role.";
        setFeedback((current) => ({ ...current, quickAssign: message }));
      } finally {
        setSavingUserId(null);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Staff Role Assignment</CardTitle>
            <CardDescription>Assign one role per staff account. Role permissions are applied at sign-in through the staff session token.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-slate-600">Selecting a role updates the user’s permission source of truth. Existing direct module permissions remain available for legacy settings pages, but the assigned role drives the new middleware and SuperAdmin access model.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Available Roles</CardTitle>
            <CardDescription>System and custom roles currently available for assignment.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {roles.map((role) => (
              <Badge key={role.id} variant={role.isSystem ? "accent" : "info"}>
                {formatRoleLabel(role.name)} · {role.permissionsCount}
              </Badge>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Role Assignment</CardTitle>
          <CardDescription>Use two dropdowns to pick a user and assign a role directly. The user dropdown shows both name and email.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_auto] lg:items-end">
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">User</label>
              <select
                className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700"
                value={quickAssignUserId}
                onChange={(event) => form.setValue("quickAssignUserId", event.target.value, { shouldDirty: true })}
              >
                <option value="">Select user</option>
                {users.map((user) => (
                  <option key={user.userId} value={user.userId}>
                    {user.fullName} - {user.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Role</label>
              <select
                className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700"
                value={quickAssignRoleId}
                onChange={(event) => form.setValue("quickAssignRoleId", event.target.value, { shouldDirty: true })}
              >
                <option value="">Select role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {formatRoleLabel(role.name)} {role.isSystem ? "(system)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <Button type="button" disabled={!quickAssignUserId || !quickAssignRoleId || isPending || savingUserId === quickAssignUserId} onClick={handleQuickAssign}>
              {savingUserId === quickAssignUserId ? "Saving..." : "Assign Role"}
            </Button>
          </div>

          <p className="text-sm text-slate-600">{feedback.quickAssign ?? "Choose a user by name and email, then pick the target role."}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <CardTitle>Users</CardTitle>
            <CardDescription>Open a user card to view the current role and change role assignment from a dropdown.</CardDescription>
          </div>
          <Input
            value={query}
            onChange={(event) => form.setValue("query", event.target.value, { shouldDirty: true })}
            placeholder="Search by name, email, type, current role, or specialization"
            className="max-w-sm"
          />
        </CardHeader>
        <CardContent className="space-y-4">
          {filteredUsers.map((user) => {
            const selectedRoleId = selectedRoles[user.userId] ?? "";
            const hasChanged = selectedRoleId !== (user.currentRoleId ?? "");
            const isExpanded = expandedUserId === user.userId;

            return (
              <div key={user.userId} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => setExpandedUserId((current) => (current === user.userId ? null : user.userId))}
                  className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">{user.fullName}</p>
                      <Badge variant={user.accountType === "ADMIN" ? "default" : "info"}>{user.accountType}</Badge>
                      <Badge variant={user.isActive ? "success" : "default"}>{user.isActive ? "Active" : "Inactive"}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{user.email}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      Current role: {formatRoleLabel(user.currentRoleName) || "No role assigned"}{user.specialization ? ` • ${user.specialization}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-slate-400">{isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}</div>
                </button>

                {isExpanded ? (
                  <div className="border-t border-slate-100 px-4 py-4">
                    <div className="mb-4 grid gap-3 sm:grid-cols-3">
                      <InfoTile label="User" value={user.fullName} helper={user.email} />
                      <InfoTile label="Role" value={formatRoleLabel(user.currentRoleName) || "Unassigned"} helper="Select a new role below" />
                      <InfoTile label="Account Type" value={user.accountType} helper={user.specialization ?? "No specialization"} />
                    </div>

                    <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                      <div>
                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Assign Role</label>
                        <select
                          className="h-10 w-full rounded-xl border border-[#dde1e6] bg-white px-3 text-sm font-medium text-slate-700"
                          value={selectedRoleId}
                          onChange={(event) => form.setValue(`selectedRoles.${user.userId}`, event.target.value, { shouldDirty: true })}
                        >
                          <option value="">Select role</option>
                          {roles.map((role) => (
                            <option key={role.id} value={role.id}>
                              {formatRoleLabel(role.name)} {role.isSystem ? "(system)" : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Button type="button" disabled={!hasChanged || isPending || savingUserId === user.userId} onClick={() => saveAssignment(user.userId)}>
                        {savingUserId === user.userId ? "Saving..." : "Assign Role"}
                      </Button>
                    </div>

                    <p className="mt-3 text-sm text-slate-600">{feedback[user.userId] ?? "Save after selecting the new role for this user."}</p>
                  </div>
                ) : null}
              </div>
            );
          })}
          {filteredUsers.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No matching staff users found.</p> : null}
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