import { AccessControlManager } from "@/components/modules/settings/access-control-manager";
import { StaffRoleManager } from "@/components/modules/settings/staff-role-manager";
import { listManagedAccessUsers } from "@/services/access-control-service";
import { getStaffRoleAssignmentDataService } from "@/services/roles-service";

export default async function SuperAdminUsersPage() {
  const [{ users, roles }, managedUsers] = await Promise.all([
    getStaffRoleAssignmentDataService(),
    listManagedAccessUsers(),
  ]);

  return (
    <div className="space-y-6">
      <StaffRoleManager users={users} roles={roles} />
      <AccessControlManager users={managedUsers} />
    </div>
  );
}