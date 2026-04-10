import { redirect } from "next/navigation";

import { RESOURCE_REPOSITORY_ROUTE } from "@/lib/constants/resource-repository";

export default function ContentLibraryPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = new URLSearchParams();
  const course = searchParams.course;
  const folder = searchParams.folder;

  if (typeof course === "string" && course.length > 0) {
    params.set("course", course);
  }

  if (typeof folder === "string" && folder.length > 0) {
    params.set("folder", folder);
  }

  redirect(`${RESOURCE_REPOSITORY_ROUTE}${params.size > 0 ? `?${params.toString()}` : ""}`);
}