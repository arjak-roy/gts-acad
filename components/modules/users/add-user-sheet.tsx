"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useRbac } from "@/lib/rbac-context";
import { SUPER_ADMIN_ROLE_CODE, isInternalUserRoleCode } from "@/lib/users/constants";

type RoleOption = {
  id: string;
  name: string;
  code: string;
  isSystemRole: boolean;
  isActive: boolean;
};

type Props = {
  onCreated: () => void;
};

export function AddUserSheet({ onCreated }: Props) {
  const { hasRole } = useRbac();
  const [open, setOpen] = useState(false);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAssignSuperAdmin = hasRole(SUPER_ADMIN_ROLE_CODE);
  const availableRoles = roles.filter((role) => isInternalUserRoleCode(role.code) && (canAssignSuperAdmin || role.code !== SUPER_ADMIN_ROLE_CODE));

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    async function loadRoles() {
      setIsLoadingRoles(true);
      setError(null);

      try {
        const response = await fetch("/api/roles");
        const payload = (await response.json().catch(() => null)) as { data?: RoleOption[]; error?: string } | null;

        if (!response.ok) {
          throw new Error(payload?.error || "Unable to load roles.");
        }

        if (!cancelled) {
          setRoles(payload?.data ?? []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load roles.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingRoles(false);
        }
      }
    }

    loadRoles();

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setForm({ name: "", email: "", phone: "" });
      setSelectedRoleIds([]);
      setError(null);
    }
  }, [open]);

  function toggleRole(roleId: string) {
    setSelectedRoleIds((current) => (current.includes(roleId) ? current.filter((value) => value !== roleId) : [...current, roleId]));
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          roleIds: selectedRoleIds,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to create the user.");
      }

      setOpen(false);
      onCreated();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create the user.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Add User
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full max-w-xl flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>Create Internal User</SheetTitle>
          <SheetDescription>Provision an internal account, assign roles, and send a welcome email with temporary credentials.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {error ? <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm font-semibold text-rose-600">{error}</div> : null}

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Full Name</label>
              <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Aisha Sharma" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Email</label>
              <Input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="aisha@gts-academy.app" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Phone</label>
              <Input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Optional phone number" />
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Roles</h3>
              <p className="text-xs text-slate-500">Select one or more internal roles for the new account.</p>
            </div>

            {isLoadingRoles ? (
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 p-4 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading roles...
              </div>
            ) : availableRoles.length === 0 ? (
              <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500">No assignable roles are available.</div>
            ) : (
              <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
                {availableRoles.map((role) => (
                  <label key={role.id} className="flex cursor-pointer items-start gap-3 rounded-xl px-2 py-2 hover:bg-slate-50">
                    <Checkbox checked={selectedRoleIds.includes(role.id)} onCheckedChange={() => toggleRole(role.id)} />
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-900">{role.name}</p>
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">{role.code}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <SheetFooter className="border-t px-6 py-4">
          <div className="flex w-full items-center justify-between gap-3">
            <p className="text-xs font-medium text-slate-500">A temporary password will be generated automatically and emailed to the user.</p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting || !form.name.trim() || !form.email.trim() || selectedRoleIds.length === 0}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Create User
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
