import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { ensureDefaultEmailTemplates } from "@/services/email-templates/defaults";
import {
  DEFAULT_EMAIL_TEMPLATES,
  isMissingEmailTemplateTable,
  mapRecordToDetail,
  resolveMockTemplate,
  resolveMockTemplateById,
  selectEmailTemplateRecord,
} from "@/services/email-templates/helpers";
import { EmailTemplateDetail, EmailTemplateSummary } from "@/services/email-templates/types";

export async function listEmailTemplatesService(): Promise<EmailTemplateSummary[]> {
  if (!isDatabaseConfigured) {
    return DEFAULT_EMAIL_TEMPLATES.map((template) => {
      const detail = resolveMockTemplate(template.key);
      return detail as EmailTemplateSummary;
    });
  }

  try {
    await ensureDefaultEmailTemplates();

    const templates = await prisma.emailTemplate.findMany({
      orderBy: [{ isSystem: "desc" }, { updatedAt: "desc" }, { name: "asc" }],
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        subject: true,
        variables: true,
        isSystem: true,
        isActive: true,
        categoryId: true,
        category: { select: { name: true } },
        updatedBy: { select: { name: true } },
        updatedAt: true,
      },
    });

    return templates.map((template) => ({
      id: template.id,
      key: template.key,
      name: template.name,
      description: template.description,
      subject: template.subject,
      variables: template.variables,
      isSystem: template.isSystem,
      isActive: template.isActive,
      categoryId: template.categoryId,
      categoryName: template.category?.name ?? null,
      updatedByName: template.updatedBy?.name ?? null,
      updatedAt: template.updatedAt.toISOString(),
    }));
  } catch (error) {
    if (isMissingEmailTemplateTable(error)) {
      console.warn("Email templates fallback activated. Run npm run db:sync:templates.", error);
      return DEFAULT_EMAIL_TEMPLATES.map((template) => {
        const detail = resolveMockTemplate(template.key);
        return detail as EmailTemplateSummary;
      });
    }

    throw error;
  }
}

export async function getEmailTemplateByIdService(templateId: string): Promise<EmailTemplateDetail | null> {
  const mockTemplate = resolveMockTemplateById(templateId);
  if (mockTemplate) {
    return mockTemplate;
  }

  if (!isDatabaseConfigured) {
    return null;
  }

  try {
    await ensureDefaultEmailTemplates();
    const template = await prisma.emailTemplate.findUnique({
      where: { id: templateId },
      select: selectEmailTemplateRecord(),
    });

    return template ? mapRecordToDetail(template) : null;
  } catch (error) {
    if (isMissingEmailTemplateTable(error)) {
      console.warn("Email template detail fallback activated. Run npm run db:sync:templates.", error);
      return null;
    }

    throw error;
  }
}
