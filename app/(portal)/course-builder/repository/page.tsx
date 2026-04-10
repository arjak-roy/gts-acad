import { ResourceRepositoryWorkspace } from "@/components/modules/course-builder/resource-repository-workspace";
import { EMPTY_LEARNING_RESOURCE_LOOKUPS } from "@/components/modules/course-builder/learning-resource-client";
import { requireServerAnyPermission } from "@/lib/auth/server-page-guards";
import { listLearningResourceLookupsService } from "@/services/learning-resource-service";
import { getUserPermissions } from "@/services/rbac-service";

const repositoryPermissions = ["course_content.view", "learning_resources.view"];

export default async function ResourceRepositoryPage() {
  const session = await requireServerAnyPermission(repositoryPermissions);
  const { permissions, roleCodes } = await getUserPermissions(session.userId);
  const canViewResources = roleCodes.includes("SUPER_ADMIN") || permissions.includes("learning_resources.view");
  const lookups = canViewResources
    ? await listLearningResourceLookupsService()
    : EMPTY_LEARNING_RESOURCE_LOOKUPS;

  return <ResourceRepositoryWorkspace lookups={lookups} />;
}
