import { redirect } from "next/navigation";

import { RESOURCE_REPOSITORY_ROUTE } from "@/lib/constants/resource-repository";

export default function LearningResourcesPage() {
  redirect(RESOURCE_REPOSITORY_ROUTE);
}