"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BuilderShell } from "@/components/modules/builders/builder-shell";

const tabs = [
  {
    href: "/course-builder/content",
    label: "Content Library",
    description: "Organize folders, upload assets, and keep course materials easy to source.",
  },
  {
    href: "/course-builder/assessments",
    label: "Assessment Pool",
    description: "Manage reusable assessments, filters, and publishing from one canonical view.",
  },
  {
    href: "/course-builder/batch-mapping",
    label: "Batch Mapping",
    description: "Assign approved content and assessments to live batches in a cleaner operational workspace.",
  },
];

export default function CourseBuilderLayout({ children }: { children: React.ReactNode }) {
  return (
    <BuilderShell
      title="Course Builder"
      description="Run the source-of-truth workspace for learning assets. Keep content, reusable assessments, and batch mappings in clear operational lanes so teams can find and action the right widget quickly."
      sections={tabs}
      aside={(
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recommended Workflow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
            <p>1. Curate folders and upload content in Content Library.</p>
            <p>2. Create or publish assessments in Assessment Pool.</p>
            <p>3. Use Batch Mapping to operationalize what each cohort should receive.</p>
          </CardContent>
        </Card>
      )}
    >
      {children}
    </BuilderShell>
  );
}
