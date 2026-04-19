import "server-only";

import type { CertificateStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma-client";
import type {
  CertificateTemplateDetail,
  CertificateTemplateSummary,
  CertificateTemplateWithPreview,
  IssuedCertificateDetail,
  IssuedCertificateSummary,
  PublicCertificateVerification,
  CanvasElement,
} from "@/services/certifications/types";

// ── Template queries ─────────────────────────────────────────────────────────

export async function listCertificateTemplatesByCourseService(courseId: string): Promise<CertificateTemplateWithPreview[]> {
  const records = await prisma.certificateTemplate.findMany({
    where: { courseId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      courseId: true,
      title: true,
      description: true,
      orientation: true,
      paperSize: true,
      isActive: true,
      isDefault: true,
      createdAt: true,
      updatedAt: true,
      layoutJson: true,
      backgroundColor: true,
      backgroundImageUrl: true,
      logoUrl: true,
      signatory1SignatureUrl: true,
      signatory2SignatureUrl: true,
      course: { select: { name: true } },
    },
  });

  return records.map((record) => ({
    id: record.id,
    courseId: record.courseId,
    courseName: record.course?.name ?? null,
    title: record.title,
    description: record.description,
    orientation: record.orientation,
    paperSize: record.paperSize,
    isActive: record.isActive,
    isDefault: record.isDefault,
    layoutJson: (record.layoutJson ?? []) as CanvasElement[],
    backgroundColor: record.backgroundColor,
    backgroundImageUrl: record.backgroundImageUrl,
    logoUrl: record.logoUrl,
    signatory1SignatureUrl: record.signatory1SignatureUrl,
    signatory2SignatureUrl: record.signatory2SignatureUrl,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }));
}

export async function listAllCertificateTemplatesService(): Promise<CertificateTemplateWithPreview[]> {
  const records = await prisma.certificateTemplate.findMany({
    where: { courseId: { not: null } },
    orderBy: [{ course: { name: "asc" } }, { isDefault: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      courseId: true,
      title: true,
      description: true,
      orientation: true,
      paperSize: true,
      isActive: true,
      isDefault: true,
      createdAt: true,
      updatedAt: true,
      layoutJson: true,
      backgroundColor: true,
      backgroundImageUrl: true,
      logoUrl: true,
      signatory1SignatureUrl: true,
      signatory2SignatureUrl: true,
      course: { select: { name: true } },
    },
  });

  return records.map((record) => ({
    id: record.id,
    courseId: record.courseId,
    courseName: record.course?.name ?? null,
    title: record.title,
    description: record.description,
    orientation: record.orientation,
    paperSize: record.paperSize,
    isActive: record.isActive,
    isDefault: record.isDefault,
    layoutJson: (record.layoutJson ?? []) as CanvasElement[],
    backgroundColor: record.backgroundColor,
    backgroundImageUrl: record.backgroundImageUrl,
    logoUrl: record.logoUrl,
    signatory1SignatureUrl: record.signatory1SignatureUrl,
    signatory2SignatureUrl: record.signatory2SignatureUrl,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }));
}

export async function listBaseTemplatesService(): Promise<CertificateTemplateWithPreview[]> {
  const records = await prisma.certificateTemplate.findMany({
    where: { courseId: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      courseId: true,
      title: true,
      description: true,
      orientation: true,
      paperSize: true,
      isActive: true,
      isDefault: true,
      createdAt: true,
      updatedAt: true,
      layoutJson: true,
      backgroundColor: true,
      backgroundImageUrl: true,
      logoUrl: true,
      signatory1SignatureUrl: true,
      signatory2SignatureUrl: true,
    },
  });

  return records.map((record) => ({
    id: record.id,
    courseId: null,
    courseName: null,
    title: record.title,
    description: record.description,
    orientation: record.orientation,
    paperSize: record.paperSize,
    isActive: record.isActive,
    isDefault: record.isDefault,
    layoutJson: (record.layoutJson ?? []) as CanvasElement[],
    backgroundColor: record.backgroundColor,
    backgroundImageUrl: record.backgroundImageUrl,
    logoUrl: record.logoUrl,
    signatory1SignatureUrl: record.signatory1SignatureUrl,
    signatory2SignatureUrl: record.signatory2SignatureUrl,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }));
}

export async function getCertificateTemplateByIdService(templateId: string): Promise<CertificateTemplateDetail | null> {
  const record = await prisma.certificateTemplate.findUnique({
    where: { id: templateId },
    include: {
      course: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  });

  if (!record) return null;

  return {
    id: record.id,
    courseId: record.courseId,
    courseName: record.course?.name ?? null,
    title: record.title,
    description: record.description,
    orientation: record.orientation,
    paperSize: record.paperSize,
    isActive: record.isActive,
    isDefault: record.isDefault,
    layoutJson: (record.layoutJson ?? []) as CanvasElement[],
    backgroundColor: record.backgroundColor,
    backgroundImageUrl: record.backgroundImageUrl,
    logoUrl: record.logoUrl,
    signatory1Name: record.signatory1Name,
    signatory1Title: record.signatory1Title,
    signatory1SignatureUrl: record.signatory1SignatureUrl,
    signatory2Name: record.signatory2Name,
    signatory2Title: record.signatory2Title,
    signatory2SignatureUrl: record.signatory2SignatureUrl,
    createdByName: record.createdBy?.name ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

// ── Issued certificate queries ───────────────────────────────────────────────

type ListCertificatesFilters = {
  courseId?: string;
  programId?: string;
  batchId?: string;
  status?: CertificateStatus;
  learnerId?: string;
};

export async function listIssuedCertificatesService(filters: ListCertificatesFilters = {}): Promise<IssuedCertificateSummary[]> {
  const records = await prisma.certificate.findMany({
    where: {
      ...(filters.courseId ? { courseId: filters.courseId } : {}),
      ...(filters.programId ? { programId: filters.programId } : {}),
      ...(filters.batchId ? { batchId: filters.batchId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.learnerId ? { learnerId: filters.learnerId } : {}),
    },
    orderBy: { issuedAt: "desc" },
    select: {
      id: true,
      certificateNumber: true,
      status: true,
      issuedAt: true,
      verificationCode: true,
      expiresAt: true,
      revokedAt: true,
      learner: { select: { id: true, fullName: true } },
      course: { select: { name: true } },
      program: { select: { name: true } },
      batch: { select: { name: true } },
      issuedBy: { select: { name: true } },
    },
  });

  return records.map((record) => ({
    id: record.id,
    certificateNumber: record.certificateNumber,
    learnerName: record.learner.fullName,
    learnerId: record.learner.id,
    courseName: record.course?.name ?? null,
    programName: record.program.name,
    batchName: record.batch?.name ?? null,
    status: record.status,
    issuedAt: record.issuedAt.toISOString(),
    issuedByName: record.issuedBy?.name ?? null,
    verificationCode: record.verificationCode,
    expiresAt: record.expiresAt?.toISOString() ?? null,
    revokedAt: record.revokedAt?.toISOString() ?? null,
  }));
}

export async function getCertificateByIdService(certificateId: string): Promise<IssuedCertificateDetail | null> {
  const record = await prisma.certificate.findUnique({
    where: { id: certificateId },
    include: {
      learner: { select: { id: true, fullName: true } },
      course: { select: { name: true } },
      program: { select: { name: true } },
      batch: { select: { name: true } },
      issuedBy: { select: { name: true } },
      revokedBy: { select: { name: true } },
      template: {
        select: {
          title: true,
          layoutJson: true,
          orientation: true,
          paperSize: true,
          backgroundColor: true,
          backgroundImageUrl: true,
          logoUrl: true,
          signatory1Name: true,
          signatory1Title: true,
          signatory1SignatureUrl: true,
          signatory2Name: true,
          signatory2Title: true,
          signatory2SignatureUrl: true,
        },
      },
    },
  });

  if (!record) return null;

  return {
    id: record.id,
    certificateNumber: record.certificateNumber,
    learnerName: record.learner.fullName,
    learnerId: record.learner.id,
    courseId: record.courseId,
    courseName: record.course?.name ?? null,
    programId: record.programId,
    programName: record.program.name,
    batchId: record.batchId,
    batchName: record.batch?.name ?? null,
    status: record.status,
    issuedAt: record.issuedAt.toISOString(),
    issuedByName: record.issuedBy?.name ?? null,
    verificationCode: record.verificationCode,
    expiresAt: record.expiresAt?.toISOString() ?? null,
    revokedAt: record.revokedAt?.toISOString() ?? null,
    templateId: record.templateId,
    renderedDataJson: record.renderedDataJson as IssuedCertificateDetail["renderedDataJson"],
    revocationReason: record.revocationReason,
    revokedByName: record.revokedBy?.name ?? null,
    templateTitle: record.template?.title ?? null,
    layoutJson: record.template ? (record.template.layoutJson as CanvasElement[]) : null,
    templateBranding: record.template
      ? {
          backgroundColor: record.template.backgroundColor,
          backgroundImageUrl: record.template.backgroundImageUrl,
          logoUrl: record.template.logoUrl,
          signatory1Name: record.template.signatory1Name,
          signatory1Title: record.template.signatory1Title,
          signatory1SignatureUrl: record.template.signatory1SignatureUrl,
          signatory2Name: record.template.signatory2Name,
          signatory2Title: record.template.signatory2Title,
          signatory2SignatureUrl: record.template.signatory2SignatureUrl,
          orientation: record.template.orientation,
          paperSize: record.template.paperSize,
        }
      : null,
  };
}

// ── Public verification query ────────────────────────────────────────────────

export async function getCertificateByVerificationCodeService(verificationCode: string): Promise<PublicCertificateVerification | null> {
  const record = await prisma.certificate.findUnique({
    where: { verificationCode },
    include: {
      learner: { select: { fullName: true } },
      course: { select: { name: true } },
      program: { select: { name: true } },
      template: {
        select: {
          layoutJson: true,
          orientation: true,
          paperSize: true,
          backgroundColor: true,
          backgroundImageUrl: true,
          logoUrl: true,
        },
      },
    },
  });

  if (!record) return null;

  return {
    status: record.status,
    certificateNumber: record.certificateNumber,
    learnerName: record.learner.fullName,
    courseName: record.course?.name ?? null,
    programName: record.program.name,
    issuedAt: record.issuedAt.toISOString(),
    expiresAt: record.expiresAt?.toISOString() ?? null,
    revokedAt: record.revokedAt?.toISOString() ?? null,
    renderedDataJson: record.renderedDataJson as PublicCertificateVerification["renderedDataJson"],
    layoutJson: record.template ? (record.template.layoutJson as CanvasElement[]) : null,
    templateBranding: record.template
      ? {
          backgroundColor: record.template.backgroundColor,
          backgroundImageUrl: record.template.backgroundImageUrl,
          logoUrl: record.template.logoUrl,
          orientation: record.template.orientation,
          paperSize: record.template.paperSize,
        }
      : null,
  };
}

// ── Candidate-facing query ───────────────────────────────────────────────────

export async function listCertificatesForLearnerService(learnerId: string): Promise<IssuedCertificateSummary[]> {
  return listIssuedCertificatesService({ learnerId, status: "ISSUED" });
}
