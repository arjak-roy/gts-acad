import { BuilderShell } from "@/components/modules/builders/builder-shell";
import { RESOURCE_REPOSITORY_ROUTE } from "@/lib/constants/resource-repository";

const tabs = [
  {
    href: RESOURCE_REPOSITORY_ROUTE,
    label: "Resource Repository",
    description: "Browse course content in an explorer view, import it into the repository, and manage direct uploads in one workspace.",
  },
];

export default function CourseBuilderLayout({ children }: { children: React.ReactNode }) {
  return (
    <BuilderShell
      title="Resource Repository"
      description="Use one repository workspace for structured course content, direct uploads, reusable learning resources, and assignment-driven delivery."
      sections={tabs}
      showHeader={false}
    >
      {children}
    </BuilderShell>
  );
}
