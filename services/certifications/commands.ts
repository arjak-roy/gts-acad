import "server-only";

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma-client";
import type {
  CreateCertificateTemplateInput,
  UpdateCertificateTemplateInput,
  UpdateTemplateLayoutInput,
  UpdateTemplateBrandingInput,
  IssueCertificateInput,
  BulkIssueCertificatesInput,
  RevokeCertificateInput,
} from "@/lib/validation-schemas/certifications";
import type { CertificateRenderedData } from "@/services/certifications/types";
import { createAuditLogEntry } from "@/services/logs-actions/audit-log-service";
import { AUDIT_ACTION_TYPE, AUDIT_ENTITY_TYPE } from "@/services/logs-actions/constants";

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateVerificationCode(): string {
  return randomBytes(16).toString("hex");
}

async function generateCertificateNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `GTS-CERT-${year}-`;

  const latest = await prisma.certificate.findFirst({
    where: { certificateNumber: { startsWith: prefix } },
    orderBy: { certificateNumber: "desc" },
    select: { certificateNumber: true },
  });

  let nextSeq = 1;
  if (latest?.certificateNumber) {
    const seqPart = latest.certificateNumber.replace(prefix, "");
    const parsed = Number.parseInt(seqPart, 10);
    if (!Number.isNaN(parsed)) {
      nextSeq = parsed + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(5, "0")}`;
}

async function buildRenderedData(
  learnerId: string,
  courseId: string | null,
  programId: string,
  batchId: string | null,
  certificateNumber: string,
  verificationCode: string,
  expiresAt: Date | null,
): Promise<CertificateRenderedData> {
  const [learner, course, program, batch] = await Promise.all([
    prisma.learner.findUniqueOrThrow({ where: { id: learnerId }, select: { fullName: true } }),
    courseId ? prisma.course.findUnique({ where: { id: courseId }, select: { name: true } }) : null,
    prisma.program.findUniqueOrThrow({ where: { id: programId }, select: { name: true } }),
    batchId ? prisma.batch.findUnique({ where: { id: batchId }, select: { name: true } }) : null,
  ]);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "https://academy.gts.ai";

  return {
    learnerName: learner.fullName,
    courseName: course?.name ?? "",
    programName: program.name,
    batchName: batch?.name ?? null,
    issuedDate: new Date().toISOString().split("T")[0],
    expiryDate: expiresAt ? expiresAt.toISOString().split("T")[0] : null,
    certificateNumber,
    verificationCode,
    verificationUrl: `${baseUrl}/verify/${verificationCode}`,
  };
}

// ── Template commands ────────────────────────────────────────────────────────

export async function createCertificateTemplateService(
  input: CreateCertificateTemplateInput,
  options?: { actorUserId?: string },
) {
  const template = await prisma.certificateTemplate.create({
    data: {
      courseId: input.courseId ?? null,
      title: input.title,
      description: input.description ?? null,
      orientation: input.orientation ?? "LANDSCAPE",
      paperSize: input.paperSize ?? "A4",
      createdById: options?.actorUserId ?? null,
    },
    select: { id: true, title: true },
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.CERTIFICATE_TEMPLATE,
    entityId: template.id,
    action: AUDIT_ACTION_TYPE.CREATED,
    message: `Certificate template "${template.title}" created.`,
    actorUserId: options?.actorUserId,
    metadata: { courseId: input.courseId ?? null },
  });

  return template;
}

export async function updateCertificateTemplateService(
  templateId: string,
  input: UpdateCertificateTemplateInput,
  options?: { actorUserId?: string },
) {
  const template = await prisma.$transaction(async (tx) => {
    // If setting isDefault to true, unset all other defaults for this course
    // (base templates with courseId=null skip this logic)
    if (input.isDefault === true) {
      const existing = await tx.certificateTemplate.findUniqueOrThrow({
        where: { id: templateId },
        select: { courseId: true },
      });

      if (existing.courseId) {
        await tx.certificateTemplate.updateMany({
          where: { courseId: existing.courseId, isDefault: true, id: { not: templateId } },
          data: { isDefault: false },
        });
      }
    }

    return tx.certificateTemplate.update({
      where: { id: templateId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.orientation !== undefined ? { orientation: input.orientation } : {}),
        ...(input.paperSize !== undefined ? { paperSize: input.paperSize } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      },
      select: { id: true, title: true },
    });
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.CERTIFICATE_TEMPLATE,
    entityId: template.id,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `Certificate template "${template.title}" updated.`,
    actorUserId: options?.actorUserId,
  });

  return template;
}

export async function saveTemplateLayoutService(
  templateId: string,
  input: UpdateTemplateLayoutInput,
  options?: { actorUserId?: string },
) {
  await prisma.certificateTemplate.update({
    where: { id: templateId },
    data: { layoutJson: input.layoutJson as unknown as object[] },
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.CERTIFICATE_TEMPLATE,
    entityId: templateId,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: "Certificate template layout saved.",
    actorUserId: options?.actorUserId,
  });
}

export async function saveTemplateBrandingService(
  templateId: string,
  input: UpdateTemplateBrandingInput,
  options?: { actorUserId?: string },
) {
  await prisma.certificateTemplate.update({
    where: { id: templateId },
    data: {
      ...(input.backgroundColor !== undefined ? { backgroundColor: input.backgroundColor } : {}),
      ...(input.backgroundImageUrl !== undefined ? { backgroundImageUrl: input.backgroundImageUrl } : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
      ...(input.signatory1Name !== undefined ? { signatory1Name: input.signatory1Name } : {}),
      ...(input.signatory1Title !== undefined ? { signatory1Title: input.signatory1Title } : {}),
      ...(input.signatory1SignatureUrl !== undefined ? { signatory1SignatureUrl: input.signatory1SignatureUrl } : {}),
      ...(input.signatory2Name !== undefined ? { signatory2Name: input.signatory2Name } : {}),
      ...(input.signatory2Title !== undefined ? { signatory2Title: input.signatory2Title } : {}),
      ...(input.signatory2SignatureUrl !== undefined ? { signatory2SignatureUrl: input.signatory2SignatureUrl } : {}),
    },
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.CERTIFICATE_TEMPLATE,
    entityId: templateId,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: "Certificate template branding updated.",
    actorUserId: options?.actorUserId,
  });
}

export async function deleteCertificateTemplateService(
  templateId: string,
  options?: { actorUserId?: string },
) {
  const template = await prisma.certificateTemplate.delete({
    where: { id: templateId },
    select: { id: true, title: true },
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.CERTIFICATE_TEMPLATE,
    entityId: template.id,
    action: AUDIT_ACTION_TYPE.DELETED,
    message: `Certificate template "${template.title}" deleted.`,
    actorUserId: options?.actorUserId,
  });

  return template;
}

// ── Base template commands ───────────────────────────────────────────────────

export async function importBaseTemplateToCourseService(
  baseTemplateId: string,
  courseId: string,
  options?: { actorUserId?: string },
) {
  const base = await prisma.certificateTemplate.findUniqueOrThrow({
    where: { id: baseTemplateId },
  });

  if (base.courseId !== null) {
    throw new Error("Template is not a base template.");
  }

  const copy = await prisma.certificateTemplate.create({
    data: {
      courseId,
      title: base.title,
      description: base.description,
      orientation: base.orientation,
      paperSize: base.paperSize,
      layoutJson: base.layoutJson as unknown as object[],
      backgroundColor: base.backgroundColor,
      backgroundImageUrl: base.backgroundImageUrl,
      logoUrl: base.logoUrl,
      signatory1Name: base.signatory1Name,
      signatory1Title: base.signatory1Title,
      signatory1SignatureUrl: base.signatory1SignatureUrl,
      signatory2Name: base.signatory2Name,
      signatory2Title: base.signatory2Title,
      signatory2SignatureUrl: base.signatory2SignatureUrl,
      isActive: true,
      isDefault: false,
      createdById: options?.actorUserId ?? null,
    },
    select: { id: true, title: true },
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.CERTIFICATE_TEMPLATE,
    entityId: copy.id,
    action: AUDIT_ACTION_TYPE.CREATED,
    message: `Base template "${base.title}" imported to course as "${copy.title}".`,
    actorUserId: options?.actorUserId,
    metadata: { baseTemplateId, courseId },
  });

  return copy;
}

export async function promoteTemplateToBaseService(
  templateId: string,
  options?: { actorUserId?: string },
) {
  const source = await prisma.certificateTemplate.findUniqueOrThrow({
    where: { id: templateId },
  });

  if (source.courseId === null) {
    throw new Error("Template is already a base template.");
  }

  const base = await prisma.certificateTemplate.create({
    data: {
      courseId: null,
      title: source.title,
      description: source.description,
      orientation: source.orientation,
      paperSize: source.paperSize,
      layoutJson: source.layoutJson as unknown as object[],
      backgroundColor: source.backgroundColor,
      backgroundImageUrl: source.backgroundImageUrl,
      logoUrl: source.logoUrl,
      signatory1Name: source.signatory1Name,
      signatory1Title: source.signatory1Title,
      signatory1SignatureUrl: source.signatory1SignatureUrl,
      signatory2Name: source.signatory2Name,
      signatory2Title: source.signatory2Title,
      signatory2SignatureUrl: source.signatory2SignatureUrl,
      isActive: true,
      isDefault: false,
      createdById: options?.actorUserId ?? null,
    },
    select: { id: true, title: true },
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.CERTIFICATE_TEMPLATE,
    entityId: base.id,
    action: AUDIT_ACTION_TYPE.CREATED,
    message: `Template "${source.title}" promoted to base library as "${base.title}".`,
    actorUserId: options?.actorUserId,
    metadata: { sourceTemplateId: templateId },
  });

  return base;
}

// ── Certificate issuance ─────────────────────────────────────────────────────

export async function issueCertificateService(
  input: IssueCertificateInput,
  options?: { actorUserId?: string },
) {
  const verificationCode = generateVerificationCode();
  const certificateNumber = await generateCertificateNumber();

  const renderedData = await buildRenderedData(
    input.learnerId,
    input.courseId,
    input.programId,
    input.batchId ?? null,
    certificateNumber,
    verificationCode,
    input.expiresAt ?? null,
  );

  const certificate = await prisma.certificate.create({
    data: {
      learnerId: input.learnerId,
      programId: input.programId,
      courseId: input.courseId,
      batchId: input.batchId ?? null,
      templateId: input.templateId,
      certificateNumber,
      verificationCode,
      issuedById: options?.actorUserId ?? null,
      renderedDataJson: renderedData as unknown as object,
      expiresAt: input.expiresAt ?? null,
    },
    select: { id: true, certificateNumber: true, verificationCode: true },
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.CERTIFICATE,
    entityId: certificate.id,
    action: AUDIT_ACTION_TYPE.ISSUED,
    message: `Certificate ${certificateNumber} issued to learner.`,
    actorUserId: options?.actorUserId,
    metadata: {
      learnerId: input.learnerId,
      courseId: input.courseId,
      programId: input.programId,
      certificateNumber,
    },
  });

  return certificate;
}

export async function bulkIssueCertificatesService(
  input: BulkIssueCertificatesInput,
  options?: { actorUserId?: string },
) {
  const results: Array<{ learnerId: string; certificateId: string; certificateNumber: string; verificationCode: string }> = [];
  const errors: Array<{ learnerId: string; error: string }> = [];

  for (const learnerId of input.learnerIds) {
    try {
      // Skip if learner already has a certificate for this course
      const existing = await prisma.certificate.findFirst({
        where: { learnerId, courseId: input.courseId, status: "ISSUED" },
        select: { id: true },
      });

      if (existing) {
        errors.push({ learnerId, error: "Certificate already issued for this course." });
        continue;
      }

      const cert = await issueCertificateService(
        {
          learnerId,
          courseId: input.courseId,
          programId: input.programId,
          batchId: input.batchId ?? null,
          templateId: input.templateId,
          expiresAt: input.expiresAt ?? null,
        },
        options,
      );

      results.push({
        learnerId,
        certificateId: cert.id,
        certificateNumber: cert.certificateNumber!,
        verificationCode: cert.verificationCode,
      });
    } catch (error) {
      errors.push({ learnerId, error: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  return { issued: results, errors };
}

export async function revokeCertificateService(
  certificateId: string,
  input: RevokeCertificateInput,
  options?: { actorUserId?: string },
) {
  const certificate = await prisma.certificate.update({
    where: { id: certificateId },
    data: {
      status: "REVOKED",
      revokedAt: new Date(),
      revokedById: options?.actorUserId ?? null,
      revocationReason: input.reason,
    },
    select: { id: true, certificateNumber: true },
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.CERTIFICATE,
    entityId: certificate.id,
    action: AUDIT_ACTION_TYPE.REVOKED,
    message: `Certificate ${certificate.certificateNumber ?? certificate.id} revoked. Reason: ${input.reason}`,
    actorUserId: options?.actorUserId,
  });

  return certificate;
}
