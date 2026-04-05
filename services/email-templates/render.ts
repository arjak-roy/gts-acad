import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import {
  getDefaultEmailTemplate,
  isMissingEmailTemplateTable,
  renderEmailTemplateSource,
  stripHtmlToText,
  TemplateVariables,
} from "@/services/email-templates/helpers";
import { ensureDefaultEmailTemplates } from "@/services/email-templates/defaults";

export async function renderEmailTemplateByKeyService(templateKey: string, variables: TemplateVariables) {
  const fallbackTemplate = getDefaultEmailTemplate(templateKey);

  if (isDatabaseConfigured) {
    try {
      await ensureDefaultEmailTemplates();

      const template = await prisma.emailTemplate.findUnique({
        where: { key: templateKey },
        select: {
          subject: true,
          htmlContent: true,
          textContent: true,
          isActive: true,
        },
      });

      if (template?.isActive) {
        return renderEmailTemplateSource(
          {
            subject: template.subject,
            htmlContent: template.htmlContent,
            textContent: template.textContent?.trim() || stripHtmlToText(template.htmlContent),
          },
          variables,
        );
      }
    } catch (error) {
      if (!isMissingEmailTemplateTable(error)) {
        console.warn(`Email template fallback activated for ${templateKey}.`, error);
      }
    }
  }

  if (!fallbackTemplate) {
    throw new Error("Email template not found.");
  }

  return renderEmailTemplateSource(fallbackTemplate, variables);
}
