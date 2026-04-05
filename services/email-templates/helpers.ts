import { Prisma } from "@prisma/client";

import {
  DEFAULT_EMAIL_TEMPLATES,
  extractTemplateVariables,
  getDefaultEmailTemplate,
  renderEmailTemplateSource,
  stripHtmlToText,
  TemplateVariables,
} from "@/lib/mail-templates/email-template-defaults";
import { EmailTemplateDetail, EmailTemplateRecord } from "@/services/email-templates/types";

export function selectEmailTemplateRecord() {
  return {
    id: true,
    key: true,
    name: true,
    description: true,
    subject: true,
    htmlContent: true,
    textContent: true,
    variables: true,
    isSystem: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
  } as const;
}

export function normalizeTemplateKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 120);
}

export function resolveTextContent(htmlContent: string, textContent: string) {
  const normalizedText = textContent.trim();
  return normalizedText || stripHtmlToText(htmlContent);
}

export function buildTestTemplateVariables(template: EmailTemplateDetail, recipientEmail: string, actorName: string | null) {
  const defaults: TemplateVariables = {
    appName: "GTS Academy",
    recipientName: actorName || "Template Tester",
    recipientEmail,
    supportEmail: "support@gts-academy.app",
    loginUrl: process.env.NEXT_PUBLIC_APP_URL || "https://gts-acad.vercel.app",
    code: "123456",
    expiresInMinutes: 10,
    purposeLabel: "verify your account",
    resetUrl: "https://gts-academy.app/reset-password?token=SAMPLE_RESET_TOKEN",
    resetToken: "SAMPLE_RESET_TOKEN",
    learnerCode: "L-TEST-001",
    programName: "Demo Medical German Program",
    temporaryPassword: "TempPass#123",
    currentYear: new Date().getFullYear(),
    templateName: template.name,
  };

  const variables: TemplateVariables = { ...defaults };

  for (const variable of template.variables) {
    if (variables[variable] !== undefined) {
      continue;
    }

    variables[variable] = `sample_${variable}`;
  }

  return variables;
}

export function mapRecordToDetail(template: EmailTemplateRecord): EmailTemplateDetail {
  return {
    id: template.id,
    key: template.key,
    name: template.name,
    description: template.description,
    subject: template.subject,
    htmlContent: template.htmlContent,
    textContent: template.textContent?.trim() || stripHtmlToText(template.htmlContent),
    variables: template.variables,
    isSystem: template.isSystem,
    isActive: template.isActive,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

export function buildMockTemplateId(key: string) {
  return `mock-${key}`;
}

export function resolveMockTemplate(key: string): EmailTemplateDetail | null {
  const fallback = getDefaultEmailTemplate(key);
  if (!fallback) {
    return null;
  }

  return {
    id: buildMockTemplateId(fallback.key),
    key: fallback.key,
    name: fallback.name,
    description: fallback.description,
    subject: fallback.subject,
    htmlContent: fallback.htmlContent.trim(),
    textContent: fallback.textContent,
    variables: extractTemplateVariables(fallback.subject, fallback.htmlContent, fallback.textContent),
    isSystem: fallback.isSystem,
    isActive: fallback.isActive,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

export function resolveMockTemplateById(templateId: string) {
  if (!templateId.startsWith("mock-")) {
    return null;
  }

  return resolveMockTemplate(templateId.slice(5));
}

export function isMissingEmailTemplateTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2022");
}

export function createTemplatePersistenceError() {
  return new Error("Email templates table is not available. Run npm run db:sync:templates.");
}

export {
  DEFAULT_EMAIL_TEMPLATES,
  extractTemplateVariables,
  getDefaultEmailTemplate,
  renderEmailTemplateSource,
  stripHtmlToText,
};
export type { TemplateVariables };
