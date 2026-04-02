"use client";

import { useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { upsertRole } from "@/app/super-admin/roles/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const roleEditorSchema = z.object({
  name: z.string().trim().min(2, "Role name is required."),
  description: z.string().trim().optional(),
  permissionKeys: z.array(z.string()).default([]),
});

type RoleEditorValues = z.infer<typeof roleEditorSchema>;

type RoleEditorProps = {
  roleId: string;
  initialName: string;
  initialDescription: string;
  initialPermissionKeys: string[];
  permissions: Array<{
    key: string;
    module: string;
    action: string;
    label: string;
  }>;
};

export function RoleEditor({ roleId, initialName, initialDescription, initialPermissionKeys, permissions }: RoleEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<RoleEditorValues>({
    resolver: zodResolver(roleEditorSchema),
    defaultValues: {
      name: initialName,
      description: initialDescription,
      permissionKeys: initialPermissionKeys,
    },
  });

  const selectedPermissions = form.watch("permissionKeys");
  const groupedPermissions = useMemo(() => {
    const modules = new Map<string, Map<string, { key: string; label: string }>>();

    for (const permission of permissions) {
      if (!modules.has(permission.module)) {
        modules.set(permission.module, new Map());
      }

      modules.get(permission.module)?.set(permission.action, { key: permission.key, label: permission.label });
    }

    return Array.from(modules.entries()).map(([module, actions]) => ({ module, actions }));
  }, [permissions]);

  const actionColumns = useMemo(
    () => Array.from(new Set(permissions.map((permission) => permission.action))).sort(),
    [permissions],
  );

  const togglePermission = (permissionKey: string) => {
    const next = selectedPermissions.includes(permissionKey)
      ? selectedPermissions.filter((key) => key !== permissionKey)
      : [...selectedPermissions, permissionKey];

    form.setValue("permissionKeys", next, { shouldDirty: true, shouldValidate: true });
  };

  const handleSave = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await upsertRole(roleId, values.name, values.description ?? "", values.permissionKeys);
      router.replace(`/super-admin/roles/${result.roleId}`);
      router.refresh();
    });
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{roleId === "new" ? "Create Role" : "Edit Role"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Role Name</label>
              <Input {...form.register("name")} placeholder="operations-manager" />
              <p className="text-xs text-rose-500">{form.formState.errors.name?.message}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Description</label>
              <Input {...form.register("description")} placeholder="Short description of this role" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-900">Permission Matrix</p>
                <p className="text-sm text-slate-500">Rows are modules, columns are actions.</p>
              </div>
              <Badge variant="info">{selectedPermissions.length} selected</Badge>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid bg-slate-50 text-[11px] font-black uppercase tracking-[0.24em] text-slate-400" style={{ gridTemplateColumns: `minmax(160px, 1.4fr) repeat(${actionColumns.length}, minmax(110px, 1fr))` }}>
                <div className="px-4 py-3">Module</div>
                {actionColumns.map((action) => (
                  <div key={action} className="px-4 py-3 text-center">{action}</div>
                ))}
              </div>

              {groupedPermissions.map((group) => (
                <div key={group.module} className="grid border-t border-slate-100" style={{ gridTemplateColumns: `minmax(160px, 1.4fr) repeat(${actionColumns.length}, minmax(110px, 1fr))` }}>
                  <div className="px-4 py-4 font-bold text-slate-900">{group.module.replace(/(^\w|[-:]\w)/g, (value) => value.replace(/[-:]/g, "").toUpperCase())}</div>
                  {actionColumns.map((action) => {
                    const permission = group.actions.get(action);
                    const checked = permission ? selectedPermissions.includes(permission.key) : false;

                    return (
                      <div key={`${group.module}-${action}`} className="flex items-center justify-center px-4 py-4">
                        {permission ? (
                          <button
                            type="button"
                            onClick={() => togglePermission(permission.key)}
                            className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${checked ? "border-[#0d3b84] bg-blue-50 text-[#0d3b84]" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}
                          >
                            <span className="font-semibold">{permission.label}</span>
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${checked ? "bg-[#0d3b84] text-white" : "bg-slate-100 text-slate-500"}`}>
                              {checked ? "On" : "Off"}
                            </span>
                          </button>
                        ) : (
                          <span className="text-sm text-slate-300">-</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {form.formState.errors.root ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{form.formState.errors.root.message}</p> : null}

          <div className="flex items-center justify-end gap-3">
            <Button asChild variant="secondary">
              <Link href="/super-admin/roles">Cancel</Link>
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={isPending}>
              {isPending ? "Saving..." : "Save Role"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}