import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { CreateEmailTemplateInput, UpdateEmailTemplateInput } from "@/lib/validation-schemas/email-templates";
import { ensureDefaultEmailTemplates } from "@/services/email-templates/defaults";
import {
  buildMockTemplateId,
  createTemplatePersistenceError,
  extractTemplateVariables,
  isMissingEmailTemplateTable,
  mapRecordToDetail,
  normalizeTemplateKey,
  resolveMockTemplateById,
  resolveTextContent,
  selectEmailTemplateRecord,
} from "@/services/email-templates/helpers";
import { EmailTemplateDetail } from "@/services/email-templates/types";

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
