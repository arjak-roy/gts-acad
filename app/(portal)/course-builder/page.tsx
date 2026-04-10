import { redirect } from "next/navigation";

import { requireServerAnyPermission } from "@/lib/auth/server-page-guards";
import { RESOURCE_REPOSITORY_ROUTE } from "@/lib/constants/resource-repository";

const repositoryPermissions = ["course_content.view", "learning_resources.view"];

export default async function CourseBuilderPage() {
  await requireServerAnyPermission(repositoryPermissions);
  redirect(RESOURCE_REPOSITORY_ROUTE);
}
