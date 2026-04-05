import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { DEFAULT_EMAIL_TEMPLATES, extractTemplateVariables } from "@/services/email-templates/helpers";

let defaultsEnsured = false;
let defaultEnsurePromise: Promise<void> | null = null;

export async function ensureDefaultEmailTemplates() {
  if (!isDatabaseConfigured || defaultsEnsured) {
    return;
  }

  if (defaultEnsurePromise) {
    return defaultEnsurePromise;
  }

  defaultEnsurePromise = (async () => {
    const keys = DEFAULT_EMAIL_TEMPLATES.map((template) => template.key);
    const existingTemplates = await prisma.emailTemplate.findMany({
      where: { key: { in: keys } },
      select: { key: true },
    });

    const existingKeys = new Set(existingTemplates.map((template) => template.key));
    const missingTemplates = DEFAULT_EMAIL_TEMPLATES.filter((template) => !existingKeys.has(template.key));

    if (missingTemplates.length > 0) {
      await prisma.emailTemplate.createMany({
        data: missingTemplates.map((template) => ({
          key: template.key,
          name: template.name,
          description: template.description,
          subject: template.subject,
          htmlContent: template.htmlContent.trim(),
          textContent: template.textContent,
          variables: extractTemplateVariables(template.subject, template.htmlContent, template.textContent),
          isSystem: template.isSystem,
          isActive: template.isActive,
        })),
        skipDuplicates: true,
      });
    }

    defaultsEnsured = true;
  })().finally(() => {
    defaultEnsurePromise = null;
  });

  return defaultEnsurePromise;
}
