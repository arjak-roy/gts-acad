import { ResourceManager } from "@/components/modules/resource-manager/resource-manager";
import { requireServerAnyPermission } from "@/lib/auth/server-page-guards";

const repositoryPermissions = ["course_content.view", "learning_resources.view"];

export default async function ResourceRepositoryPage() {
  await requireServerAnyPermission(repositoryPermissions);

  return <ResourceManager mode="browse" />;
}
