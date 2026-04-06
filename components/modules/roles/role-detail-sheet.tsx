"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Lock, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { CanAccess } from "@/components/ui/can-access";

type PermissionItem = {
  id: string;
  module: string;
  action: string;
  key: string;
  description: string | null;
};

type PermissionGroup = {
  module: string;
  permissions: PermissionItem[];
};

type RoleDetail = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isSystemRole: boolean;
  isActive: boolean;
  permissions: PermissionItem[];
};

type Props = {
  roleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
};

export function RoleDetailSheet({ roleId, open, onOpenChange, onUpdated }: Props) {
  const router = useRouter();
  const [role, setRole] = useState<RoleDetail | null>(null);
  const [allPermissions, setAllPermissions] = useState<PermissionGroup[]>([]);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", description: "" });
  const [error, setError] = useState<string | null>(null);

  const fetchRoleData = useCallback(async () => {
    if (!roleId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [roleRes, permRes] = await Promise.all([
        fetch(`/api/roles/${roleId}`),
        fetch("/api/permissions"),
      ]);
      if (!roleRes.ok) throw new Error("Failed to fetch role");
      if (!permRes.ok) throw new Error("Failed to fetch permissions");

      const roleJson = await roleRes.json();
      const permJson = await permRes.json();

      const roleData: RoleDetail = roleJson.data;
      setRole(roleData);
      setEditForm({ name: roleData.name, description: roleData.description ?? "" });
      setSelectedPermissionIds(new Set(roleData.permissions.map((p) => p.id)));

      const grouped: Record<string, PermissionItem[]> = permJson.data?.grouped ?? {};
      setAllPermissions(
        Object.entries(grouped).map(([module, perms]) => ({ module, permissions: perms }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [roleId]);

  useEffect(() => {
    if (open && roleId) {
      fetchRoleData();
      setIsEditing(false);
    }
  }, [open, roleId, fetchRoleData]);

  const handlePermissionToggle = (permissionId: string) => {
    setSelectedPermissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(permissionId)) {
        next.delete(permissionId);
      } else {
        next.add(permissionId);
      }
      return next;
    });
  };

  const handleModuleToggleAll = (group: PermissionGroup) => {
    const allSelected = group.permissions.every((p) => selectedPermissionIds.has(p.id));
    setSelectedPermissionIds((prev) => {
      const next = new Set(prev);
      for (const p of group.permissions) {
        if (allSelected) {
          next.delete(p.id);
        } else {
          next.add(p.id);
        }
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!role) return;
    setIsSaving(true);
    setError(null);
    try {
      // Update role details
      const updateRes = await fetch(`/api/roles/${role.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editForm.name, description: editForm.description || null }),
      });
      if (!updateRes.ok) {
        const errJson = await updateRes.json().catch(() => null);
        throw new Error(errJson?.error ?? "Failed to update role");
      }

      // Update permissions
      const permRes = await fetch(`/api/roles/${role.id}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionIds: Array.from(selectedPermissionIds) }),
      });
      if (!permRes.ok) {
        const errJson = await permRes.json().catch(() => null);
        throw new Error(errJson?.error ?? "Failed to update permissions");
      }

      setIsEditing(false);
      onUpdated();
      router.refresh();
      fetchRoleData();
      toast.success("Role updated successfully.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!role || role.isSystemRole) return;
    if (!confirm(`Are you sure you want to delete the role "${role.name}"? This cannot be undone.`)) return;

    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/roles/${role.id}`, { method: "DELETE" });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error ?? "Failed to delete role");
      }
      onOpenChange(false);
      onUpdated();
      router.refresh();
      toast.success("Role deleted successfully.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed";
      setError(message);
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const isSuperAdmin = role?.code === "SUPER_ADMIN";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full max-w-xl flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="flex items-center gap-2">
            {isLoading ? (
              <Skeleton className="h-6 w-48" />
            ) : (
              <>
                {role?.name ?? "Role Details"}
                {role?.isSystemRole && <Lock className="h-4 w-4 text-slate-400" />}
              </>
            )}
          </SheetTitle>
          <SheetDescription>
            {isLoading
              ? "Loading..."
              : isSuperAdmin
                ? "Super Admin has full access to all modules. Permissions cannot be customized."
                : isEditing
                  ? "Edit role details and permission assignments."
                  : "View role details and assigned permissions."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !role ? (
            <p className="text-sm text-slate-500">Role not found.</p>
          ) : (
            <div className="space-y-6">
              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
              )}

              {/* Role Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">{role.code}</code>
                  <Badge variant={role.isActive ? "success" : "default"}>
                    {role.isActive ? "Active" : "Inactive"}
                  </Badge>
                  {role.isSystemRole && (
                    <Badge variant="info">System Role</Badge>
                  )}
                </div>

                {isEditing && !role.isSystemRole ? (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">Name</label>
                      <Input
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">Description</label>
                      <Input
                        value={editForm.description}
                        onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">{role.description ?? "No description."}</p>
                )}

                <div className="text-xs text-slate-400">
                  Role assigned to users
                </div>
              </div>

              {/* Permission Matrix */}
              {!isSuperAdmin && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-700">
                    Permissions ({selectedPermissionIds.size})
                  </h3>

                  {allPermissions.length === 0 ? (
                    <p className="text-sm text-slate-400">No permissions available.</p>
                  ) : (
                    allPermissions.map((group) => {
                      const allChecked = group.permissions.every((p) =>
                        selectedPermissionIds.has(p.id),
                      );
                      const someChecked =
                        !allChecked &&
                        group.permissions.some((p) => selectedPermissionIds.has(p.id));

                      return (
                        <div key={group.module} className="rounded-lg border border-slate-200">
                          <div
                            className="flex cursor-pointer items-center gap-3 bg-slate-50 px-4 py-2.5"
                            onClick={() => isEditing && handleModuleToggleAll(group)}
                          >
                            {isEditing && (
                              <Checkbox
                                checked={allChecked ? true : someChecked ? "indeterminate" : false}
                                onCheckedChange={() => handleModuleToggleAll(group)}
                              />
                            )}
                            <span className="text-sm font-medium capitalize text-slate-700">
                              {group.module.replace("_", " ")}
                            </span>
                            <span className="ml-auto text-xs text-slate-400">
                              {group.permissions.filter((p) => selectedPermissionIds.has(p.id)).length}/{group.permissions.length}
                            </span>
                          </div>
                          <div className="divide-y divide-slate-100 px-4">
                            {group.permissions.map((perm) => {
                              const isChecked = selectedPermissionIds.has(perm.id);
                              return (
                                <div
                                  key={perm.id}
                                  className="flex items-center gap-3 py-2"
                                >
                                  {isEditing ? (
                                    <Checkbox
                                      checked={isChecked}
                                      onCheckedChange={() => handlePermissionToggle(perm.id)}
                                    />
                                  ) : (
                                    <div className={`flex h-4 w-4 items-center justify-center rounded-sm ${isChecked ? "bg-emerald-500 text-white" : "bg-slate-200"}`}>
                                      {isChecked && <Check className="h-3 w-3" />}
                                    </div>
                                  )}
                                  <div className="flex-1">
                                    <span className="text-sm text-slate-700">{perm.description ?? perm.key}</span>
                                  </div>
                                  <code className="text-[10px] text-slate-400">{perm.key}</code>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {isSuperAdmin && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm text-amber-700">
                    Super Admin role has implicit access to all permissions. No permission matrix is needed.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <SheetFooter className="border-t px-6 py-4">
          {isEditing ? (
            <div className="flex w-full items-center justify-between">
              <CanAccess permission="roles.delete">
                {!role?.isSystemRole && (
                  <Button
                    variant="accent"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isDeleting || isSaving}
                  >
                    {isDeleting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Trash2 className="mr-1 h-3 w-3" />}
                    Delete Role
                  </Button>
                )}
              </CanAccess>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => { setIsEditing(false); fetchRoleData(); }}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving || !editForm.name.trim()}>
                  {isSaving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex w-full justify-end gap-2">
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <CanAccess permission="roles.edit">
                {!isSuperAdmin && (
                  <Button onClick={() => setIsEditing(true)}>Edit Role</Button>
                )}
              </CanAccess>
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
