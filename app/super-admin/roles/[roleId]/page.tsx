import { notFound } from "next/navigation";

import { RoleEditor } from "@/components/modules/settings/role-editor";
import { getRoleEditorDataService } from "@/services/roles-service";

type RoleEditorPageProps = {
  params: {
    roleId: string;
  };
};

export default async function RoleEditorPage({ params }: RoleEditorPageProps) {
  const { permissions, role } = await getRoleEditorDataService(params.roleId);

  if (params.roleId !== "new" && !role) {
    notFound();
  }

  return (
    <RoleEditor
      roleId={params.roleId}
      initialName={role?.name ?? ""}
      initialDescription={role?.description ?? ""}
      initialPermissionKeys={role?.permissions.map((entry) => entry.permission.key) ?? []}
      permissions={permissions}
    />
  );
}