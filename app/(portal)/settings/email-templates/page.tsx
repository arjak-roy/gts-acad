import { SectionPageContent } from "@/components/modules/portal/section-page-content";
import { listEmailTemplatesService } from "@/services/email-templates";
import type { PortalSectionContent } from "@/types";

export default async function SettingsEmailTemplatesPage() {
  const templates = await listEmailTemplatesService();
  const activeTemplates = templates.filter((template) => template.isActive).length;
  const systemTemplates = templates.filter((template) => template.isSystem).length;

  const section: PortalSectionContent = {
    title: "Email Settings",
    description: "Manage the template library used by authentication and operational email workflows from a dedicated sidebar module.",
    accent: `${activeTemplates} active templates`,
    summary: "System-owned and custom mail templates stored in the database.",
    metrics: [
      {
        label: "Total Templates",
        value: String(templates.length),
        helper: "Rows currently available in the email template library.",
      },
      {
        label: "System Templates",
        value: String(systemTemplates),
        helper: "Reserved keys used by core product flows.",
      },
      {
        label: "Active",
        value: String(activeTemplates),
        helper: "Templates currently eligible for runtime delivery.",
      },
    ],
    highlights: [
      {
        label: "Variable Coverage",
        value: `${templates.filter((template) => template.variables.length > 0).length} templates include runtime placeholders`,
        tone: "info",
      },
    ],
    tableTitle: "Email Templates",
    tableDescription: "Create and edit reusable HTML templates for operational email flows.",
    tableColumns: [
      { key: "name", header: "Template" },
      { key: "key", header: "Key" },
      { key: "category", header: "Category" },
      { key: "subject", header: "Subject" },
      { key: "variables", header: "Variables" },
      { key: "updatedBy", header: "Updated By" },
      { key: "updated", header: "Updated" },
      { key: "status", header: "Status" },
    ],
    tableRows: templates.map((template) => ({
      id: template.id,
      name: template.name,
      key: template.key,
      category: template.categoryName ?? "—",
      subject: template.subject.length > 48 ? `${template.subject.slice(0, 45)}...` : template.subject,
      variables: template.variables.length > 0 ? template.variables.join(", ") : "None",
      updatedBy: template.updatedByName ?? "—",
      updated: new Date(template.updatedAt).toLocaleDateString("en-IN"),
      status: template.isActive ? "ACTIVE" : "INACTIVE",
      isSystem: template.isSystem ? "true" : "false",
    })),
    primaryAction: "Create Template",
    secondaryAction: "Template Library",
  };

  return <SectionPageContent section={section} sectionKey="email-templates" />;
}