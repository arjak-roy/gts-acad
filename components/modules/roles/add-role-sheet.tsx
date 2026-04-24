"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

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

type Props = {
  onCreated: () => void;
};

const formSchema = z.object({
  name: z.string().min(1, "Role Name is required"),
  code: z.string().min(1, "Code is required").regex(/^[A-Z0-9_]+$/, "Code can only contain uppercase letters, numbers, and underscores"),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function AddRoleSheet({ onCreated }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [allPermissions, setAllPermissions] = useState<PermissionGroup[]>([]);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", code: "", description: "" },
  });

  const nameValue = watch("name");

  const fetchPermissions = useCallback(async () => {
    try {
      const res = await fetch("/api/permissions");
      if (!res.ok) return;
      const json = await res.json();
      const grouped: Record<string, Array<{ id: string; module: string; action: string; key: string; description: string | null }>> = json.data?.grouped ?? {};
      setAllPermissions(
        Object.entries(grouped).map(([module, perms]) => ({ module, permissions: perms }))
      );
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchPermissions();
      reset();
      setSelectedPermissionIds(new Set());
      setError(null);
    }
  }, [open, fetchPermissions, reset]);

  // Auto-generate code from name
  useEffect(() => {
    if (!nameValue) return;
    const nextCode = nameValue
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 50);
    setValue("code", nextCode, { shouldValidate: true });
  }, [nameValue, setValue]);

  const handlePermissionToggle = (permId: string) => {
    setSelectedPermissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
  };

  const handleModuleToggleAll = (group: PermissionGroup) => {
    const allSelected = group.permissions.every((p) => selectedPermissionIds.has(p.id));
    setSelectedPermissionIds((prev) => {
      const next = new Set(prev);
      for (const p of group.permissions) {
        if (allSelected) next.delete(p.id);
        else next.add(p.id);
      }
      return next;
    });
  };

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name.trim(),
          code: values.code.trim(),
          description: values.description?.trim() || null,
          permissionIds: Array.from(selectedPermissionIds),
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error ?? "Failed to create role");
      }
      setOpen(false);
      onCreated();
      router.refresh();
      toast.success("Role created successfully.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Create failed";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" />
          Add Role
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full max-w-xl flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>Create New Role</SheetTitle>
          <SheetDescription>Define a new role with specific permissions.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
            )}

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Role Name</label>
                <Input
                  placeholder="e.g. Regional Manager"
                  {...register("name")}
                />
                {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Code</label>
                <Input
                  placeholder="AUTO_GENERATED"
                  {...register("code")}
                  onChange={(e) => setValue("code", e.target.value.toUpperCase(), { shouldValidate: true })}
                />
                {errors.code && <p className="mt-1 text-xs text-red-500">{errors.code.message}</p>}
                <p className="mt-1 text-[10px] text-slate-400">
                  Auto-generated from name. Must be unique and alphanumeric with underscores.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Description</label>
                <Input
                  placeholder="Optional description"
                  {...register("description")}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700">
                Permissions ({selectedPermissionIds.size})
              </h3>
              {allPermissions.map((group) => {
                const allChecked = group.permissions.every((p) => selectedPermissionIds.has(p.id));
                const someChecked = !allChecked && group.permissions.some((p) => selectedPermissionIds.has(p.id));

                return (
                  <div key={group.module} className="rounded-lg border border-slate-200">
                    <div
                      className="flex cursor-pointer items-center gap-3 bg-slate-50 px-4 py-2.5"
                      onClick={() => handleModuleToggleAll(group)}
                    >
                      <Checkbox
                        checked={allChecked ? true : someChecked ? "indeterminate" : false}
                        onCheckedChange={() => handleModuleToggleAll(group)}
                      />
                      <span className="text-sm font-medium capitalize text-slate-700">
                        {group.module.replace("_", " ")}
                      </span>
                      <span className="ml-auto text-xs text-slate-400">
                        {group.permissions.filter((p) => selectedPermissionIds.has(p.id)).length}/{group.permissions.length}
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100 px-4">
                      {group.permissions.map((perm) => (
                        <div key={perm.id} className="flex items-center gap-3 py-2">
                          <Checkbox
                            checked={selectedPermissionIds.has(perm.id)}
                            onCheckedChange={() => handlePermissionToggle(perm.id)}
                          />
                          <span className="flex-1 text-sm text-slate-700">{perm.description ?? perm.key}</span>
                          <code className="text-[10px] text-slate-400">{perm.key}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <SheetFooter className="border-t px-6 py-4">
          <div className="flex w-full justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Create Role
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
