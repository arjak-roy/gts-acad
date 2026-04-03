import "server-only";

import { Prisma } from "@prisma/client";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import {
  DEFAULT_EMAIL_TEMPLATES,
  extractTemplateVariables,
  getDefaultEmailTemplate,
  renderEmailTemplateSource,
  stripHtmlToText,
  TemplateVariables,
} from "@/lib/mail-templates/email-template-defaults";
import { CreateEmailTemplateInput, UpdateEmailTemplateInput } from "@/lib/validation-schemas/email-templates";
import { deliverLoggedEmail } from "@/services/logs-actions-service";

export type EmailTemplateSummary = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  subject: string;
  variables: string[];
  isSystem: boolean;
  isActive: boolean;
  updatedAt: string;
};

export type EmailTemplateDetail = EmailTemplateSummary & {
  htmlContent: string;
  textContent: string;
  createdAt: string;
};

export type SendTestEmailTemplateResult = {
  templateId: string;
  templateKey: string;
  recipientEmail: string;
  emailLogId: string | null;
  providerMessageId: string | null;
};

type EmailTemplateRecord = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  subject: string;
  htmlContent: string;
  textContent: string | null;
  variables: string[];
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

let defaultsEnsured = false;
let defaultEnsurePromise: Promise<void> | null = null;

function selectEmailTemplateRecord() {
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

function normalizeTemplateKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 120);
}

function resolveTextContent(htmlContent: string, textContent: string) {
  const normalizedText = textContent.trim();
  return normalizedText || stripHtmlToText(htmlContent);
}

function buildTestTemplateVariables(template: EmailTemplateDetail, recipientEmail: string, actorName: string | null) {
  const defaults: TemplateVariables = {
    appName: "GTS Academy",
    recipientName: actorName || "Template Tester",
    recipientEmail,
    supportEmail: "support@gts-academy.app",
    loginUrl: process.env.NEXT_PUBLIC_APP_URL || "https://gts-acad.vercel.app",
    code: "123456",
    expiresInMinutes: 10,
    purposeLabel: "verify your account",
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

function mapRecordToDetail(template: EmailTemplateRecord): EmailTemplateDetail {
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

function buildMockTemplateId(key: string) {
  return `mock-${key}`;
}

function resolveMockTemplate(key: string): EmailTemplateDetail | null {
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

function resolveMockTemplateById(templateId: string) {
  if (!templateId.startsWith("mock-")) {
    return null;
  }

  return resolveMockTemplate(templateId.slice(5));
}

function isMissingEmailTemplateTable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2022");
}

function createTemplatePersistenceError() {
  return new Error("Email templates table is not available. Run npm run db:sync:templates.");
}

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

export async function createEmailTemplateService(input: CreateEmailTemplateInput): Promise<EmailTemplateDetail> {
  const key = normalizeTemplateKey(input.key);
  const name = input.name.trim();
  const description = input.description.trim() || null;
  const subject = input.subject.trim();
  const htmlContent = input.htmlContent.trim();
  const textContent = resolveTextContent(htmlContent, input.textContent);
  const variables = extractTemplateVariables(subject, htmlContent, textContent);

  if (!key) {
    throw new Error("Template key is required.");
  }

  if (!isDatabaseConfigured) {
    return {
      id: buildMockTemplateId(key),
      key,
      name,
      description,
      subject,
      htmlContent,
      textContent,
      variables,
      isSystem: false,
      isActive: input.isActive,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  try {
    await ensureDefaultEmailTemplates();

    const existingTemplate = await prisma.emailTemplate.findUnique({
      where: { key },
      select: { id: true },
    });

    if (existingTemplate) {
      throw new Error("Email template key already exists.");
    }

    const createdTemplate = await prisma.emailTemplate.create({
      data: {
        key,
        name,
        description,
        subject,
        htmlContent,
        textContent,
        variables,
        isActive: input.isActive,
      },
      select: selectEmailTemplateRecord(),
    });

    return mapRecordToDetail(createdTemplate);
  } catch (error) {
    if (isMissingEmailTemplateTable(error)) {
      throw createTemplatePersistenceError();
    }

    throw error;
  }
}

export async function updateEmailTemplateService(input: UpdateEmailTemplateInput): Promise<EmailTemplateDetail> {
  const templateId = input.templateId.trim();
  const name = input.name.trim();
  const description = input.description.trim() || null;
  const subject = input.subject.trim();
  const htmlContent = input.htmlContent.trim();
  const textContent = resolveTextContent(htmlContent, input.textContent);

  if (!isDatabaseConfigured) {
    const existingMock = resolveMockTemplateById(templateId);
    if (!existingMock) {
      throw new Error("Email template not found.");
    }

    const key = existingMock.isSystem ? existingMock.key : normalizeTemplateKey(input.key);
    return {
      ...existingMock,
      key,
      name,
      description,
      subject,
      htmlContent,
      textContent,
      variables: extractTemplateVariables(subject, htmlContent, textContent),
      isActive: input.isActive,
      updatedAt: new Date().toISOString(),
    };
  }

  try {
    await ensureDefaultEmailTemplates();

    const existingTemplate = await prisma.emailTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, key: true, isSystem: true },
    });

    if (!existingTemplate) {
      throw new Error("Email template not found.");
    }

    const nextKey = existingTemplate.isSystem ? existingTemplate.key : normalizeTemplateKey(input.key);
    if (!nextKey) {
      throw new Error("Template key is required.");
    }

    if (nextKey !== existingTemplate.key) {
      const duplicateKey = await prisma.emailTemplate.findUnique({
        where: { key: nextKey },
        select: { id: true },
      });

      if (duplicateKey) {
        throw new Error("Email template key already exists.");
      }
    }

    const updatedTemplate = await prisma.emailTemplate.update({
      where: { id: templateId },
      data: {
        key: nextKey,
        name,
        description,
        subject,
        htmlContent,
        textContent,
        variables: extractTemplateVariables(subject, htmlContent, textContent),
        isActive: input.isActive,
      },
      select: selectEmailTemplateRecord(),
    });

    return mapRecordToDetail(updatedTemplate);
  } catch (error) {
    if (isMissingEmailTemplateTable(error)) {
      throw createTemplatePersistenceError();
    }

    throw error;
  }
}

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

export async function sendTestEmailTemplateService(input: {
  templateId: string;
  recipientEmail: string;
  actorUserId: string;
  actorName: string;
}) : Promise<SendTestEmailTemplateResult> {
  const template = await getEmailTemplateByIdService(input.templateId);
  if (!template) {
    throw new Error("Email template not found.");
  }

  const variables = buildTestTemplateVariables(template, input.recipientEmail, input.actorName);
  const rendered = renderEmailTemplateSource(
    {
      subject: template.subject,
      htmlContent: template.htmlContent,
      textContent: template.textContent,
    },
    variables,
  );

  const delivery = await deliverLoggedEmail({
    to: input.recipientEmail,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    category: "SYSTEM",
    templateKey: template.key,
    metadata: {
      reason: "template_test",
      templateId: template.id,
      templateKey: template.key,
    },
    audit: {
      actorUserId: input.actorUserId,
      entityId: template.id,
    },
  });

  return {
    templateId: template.id,
    templateKey: template.key,
    recipientEmail: input.recipientEmail,
    emailLogId: delivery.emailLogId,
    providerMessageId: delivery.providerMessageId,
  };
}