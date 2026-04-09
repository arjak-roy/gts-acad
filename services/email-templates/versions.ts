import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";

export type EmailTemplateVersionSummary = {
  id: string;
  versionNumber: number;
  subject: string;
  updatedByName: string | null;
  createdAt: string;
};

export type EmailTemplateVersionDetail = EmailTemplateVersionSummary & {
  htmlContent: string;
  textContent: string | null;
};

export async function createVersionSnapshot(input: {
  templateId: string;
  subject: string;
  htmlContent: string;
  textContent: string | null;
  updatedById: string | null;
}): Promise<void> {
  if (!isDatabaseConfigured) {
    return;
  }

  try {
    const lastVersion = await prisma.emailTemplateVersion.findFirst({
      where: { templateId: input.templateId },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });

    const nextVersion = (lastVersion?.versionNumber ?? 0) + 1;

    await prisma.emailTemplateVersion.create({
      data: {
        templateId: input.templateId,
        versionNumber: nextVersion,
        subject: input.subject,
        htmlContent: input.htmlContent,
        textContent: input.textContent,
        updatedById: input.updatedById,
      },
    });
  } catch (error) {
    console.warn("Failed to create email template version snapshot.", error);
  }
}

export async function listEmailTemplateVersionsService(templateId: string): Promise<EmailTemplateVersionSummary[]> {
  if (!isDatabaseConfigured) {
    return [];
  }

  const versions = await prisma.emailTemplateVersion.findMany({
    where: { templateId },
    orderBy: { versionNumber: "desc" },
    select: {
      id: true,
      versionNumber: true,
      subject: true,
      createdAt: true,
      updatedBy: {
        select: { name: true },
      },
    },
  });

  return versions.map((version) => ({
    id: version.id,
    versionNumber: version.versionNumber,
    subject: version.subject,
    updatedByName: version.updatedBy?.name ?? null,
    createdAt: version.createdAt.toISOString(),
  }));
}

export async function getEmailTemplateVersionDetailService(versionId: string): Promise<EmailTemplateVersionDetail | null> {
  if (!isDatabaseConfigured) {
    return null;
  }

  const version = await prisma.emailTemplateVersion.findUnique({
    where: { id: versionId },
    select: {
      id: true,
      versionNumber: true,
      subject: true,
      htmlContent: true,
      textContent: true,
      createdAt: true,
      updatedBy: {
        select: { name: true },
      },
    },
  });

  if (!version) {
    return null;
  }

  return {
    id: version.id,
    versionNumber: version.versionNumber,
    subject: version.subject,
    htmlContent: version.htmlContent,
    textContent: version.textContent,
    updatedByName: version.updatedBy?.name ?? null,
    createdAt: version.createdAt.toISOString(),
  };
}
