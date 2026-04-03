import { AccessControlManager } from "@/components/modules/settings/access-control-manager";
import { requireCurrentSuperAdminSession } from "@/lib/auth/access";
import { listManagedAccessUsers } from "@/services/access-control-service";

export default async function SettingsPage() {
  await requireCurrentSuperAdminSession();
  const users = await listManagedAccessUsers();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.28em] text-accent">Super Admin Controls</p>
        <h1 className="mt-1 text-3xl font-extrabold text-slate-950">Access Management</h1>
        <p className="mt-2 max-w-3xl text-sm font-medium text-slate-500">
          Grant module access to admin and trainer accounts. The sidebar, pages, and APIs all respect these assignments.
        </p>
      </div>

      <AccessControlManager users={users} />
    </div>
  );
}