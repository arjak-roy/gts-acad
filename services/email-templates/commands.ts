import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { CreateEmailTemplateInput, UpdateEmailTemplateInput } from "@/lib/validation-schemas/email-templates";
import { sanitizeEmailTemplateHtml } from "@/services/email-templates/html";
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
import { createVersionSnapshot } from "@/services/email-templates/versions";

export async function createEmailTemplateService(input: CreateEmailTemplateInput & { userId?: string | null }): Promise<EmailTemplateDetail> {
  const key = normalizeTemplateKey(input.key);
  const name = input.name.trim();
  const description = input.description.trim() || null;
  const subject = input.subject.trim();
  const htmlContent = sanitizeEmailTemplateHtml(input.htmlContent);
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
      categoryId: input.categoryId ?? null,
      categoryName: null,
      updatedByName: null,
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
        categoryId: input.categoryId ?? null,
        createdById: input.userId ?? null,
        updatedById: input.userId ?? null,
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

export async function updateEmailTemplateService(input: UpdateEmailTemplateInput & { userId?: string | null }): Promise<EmailTemplateDetail> {
  const templateId = input.templateId.trim();
  const name = input.name.trim();
  const description = input.description.trim() || null;
  const subject = input.subject.trim();
  const htmlContent = sanitizeEmailTemplateHtml(input.htmlContent);
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
      categoryId: input.categoryId ?? existingMock.categoryId,
      updatedAt: new Date().toISOString(),
    };
  }

  try {
    await ensureDefaultEmailTemplates();

    const existingTemplate = await prisma.emailTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, key: true, isSystem: true, subject: true, htmlContent: true, textContent: true },
    });

    if (!existingTemplate) {
      throw new Error("Email template not found.");
    }

    // Save version snapshot before applying changes
    await createVersionSnapshot({
      templateId: existingTemplate.id,
      subject: existingTemplate.subject,
      htmlContent: existingTemplate.htmlContent,
      textContent: existingTemplate.textContent,
      updatedById: input.userId ?? null,
    });

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
        categoryId: input.categoryId ?? undefined,
        updatedById: input.userId ?? undefined,
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

export async function deleteEmailTemplateService(templateId: string): Promise<void> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const template = await prisma.emailTemplate.findUnique({
    where: { id: templateId },
    select: { id: true, isSystem: true },
  });

  if (!template) {
    throw new Error("Email template not found.");
  }

  if (template.isSystem) {
    throw new Error("System templates cannot be deleted.");
  }

  await prisma.emailTemplate.delete({
    where: { id: templateId },
  });
}

export async function duplicateEmailTemplateService(templateId: string, userId?: string | null): Promise<EmailTemplateDetail> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  await ensureDefaultEmailTemplates();

  const source = await prisma.emailTemplate.findUnique({
    where: { id: templateId },
    select: selectEmailTemplateRecord(),
  });

  if (!source) {
    throw new Error("Email template not found.");
  }

  const baseKey = `${source.key}-copy`;
  let candidateKey = baseKey;
  let counter = 1;

  while (await prisma.emailTemplate.findUnique({ where: { key: candidateKey }, select: { id: true } })) {
    candidateKey = `${baseKey}-${counter}`;
    counter++;
  }

  const created = await prisma.emailTemplate.create({
    data: {
      key: candidateKey,
      name: `${source.name} (Copy)`,
      description: source.description,
      subject: source.subject,
      htmlContent: source.htmlContent,
      textContent: source.textContent,
      variables: source.variables,
      isSystem: false,
      isActive: false,
      categoryId: source.categoryId,
      createdById: userId ?? null,
      updatedById: userId ?? null,
    },
    select: selectEmailTemplateRecord(),
  });

  return mapRecordToDetail(created);
}

export async function toggleEmailTemplateStatusService(templateId: string, userId?: string | null): Promise<EmailTemplateDetail> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const existing = await prisma.emailTemplate.findUnique({
    where: { id: templateId },
    select: { id: true, isActive: true },
  });

  if (!existing) {
    throw new Error("Email template not found.");
  }

  const updated = await prisma.emailTemplate.update({
    where: { id: templateId },
    data: {
      isActive: !existing.isActive,
      updatedById: userId ?? undefined,
    },
    select: selectEmailTemplateRecord(),
  });

  return mapRecordToDetail(updated);
}
