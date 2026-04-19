import "server-only";

import type { CertificateAutoIssueTrigger } from "@prisma/client";
import { prisma } from "@/lib/prisma-client";
import {
  getCertificateAutoIssueAttemptRetryContext,
  recordCertificateAutoIssueAttempt,
} from "@/services/certifications/auto-issue-attempts";
import { getBatchCourseContext } from "@/services/lms/hierarchy";
import { issueCertificateService } from "@/services/certifications/commands";
import type { CertificateAutoIssueAttemptStatus } from "@/services/certifications/types";
import { createAuditLogEntry } from "@/services/logs-actions/audit-log-service";
import { AUDIT_ACTION_TYPE, AUDIT_ENTITY_TYPE } from "@/services/logs-actions/constants";

// ── Types ────────────────────────────────────────────────────────────────────

export type AutoIssueResult = {
  issued: boolean;
  status: CertificateAutoIssueAttemptStatus;
  attemptId?: string | null;
  certificateId?: string;
  reason?: string;
};

async function persistAutoIssueAttempt(options: {
  learnerId: string;
  batchId: string;
  ruleId?: string | null;
  templateId?: string | null;
  curriculumId?: string | null;
  trigger: CertificateAutoIssueTrigger;
  status: CertificateAutoIssueAttemptStatus;
  certificateId?: string | null;
  reason?: string | null;
  retriedFromAttemptId?: string | null;
  actorUserId?: string | null;
  courseId?: string | null;
  programId?: string | null;
}) {
  return recordCertificateAutoIssueAttempt({
    learnerId: options.learnerId,
    batchId: options.batchId,
    ruleId: options.ruleId,
    templateId: options.templateId,
    curriculumId: options.curriculumId,
    trigger: options.trigger,
    status: options.status,
    certificateId: options.certificateId,
    reason: options.reason,
    retriedFromAttemptId: options.retriedFromAttemptId,
    metadata: {
      source: options.retriedFromAttemptId ? "manual_retry" : "automatic_trigger",
      actorUserId: options.actorUserId ?? null,
      courseId: options.courseId ?? null,
      programId: options.programId ?? null,
    },
  });
}

// ── Main auto-issue function ─────────────────────────────────────────────────

export async function attemptAutoIssueCertificate(options: {
  learnerId: string;
  batchId: string;
  trigger: CertificateAutoIssueTrigger;
  curriculumId?: string | null;
  retriedFromAttemptId?: string | null;
  actorUserId?: string | null;
}): Promise<AutoIssueResult> {
  const { learnerId, batchId, trigger, curriculumId } = options;
  let ruleId: string | null = null;
  let templateId: string | null = null;
  let courseId: string | null = null;
  let programId: string | null = null;

  try {
    // 1. Resolve batch → program → course
    const context = await getBatchCourseContext(batchId);
    if (!context) {
      const attemptId = await persistAutoIssueAttempt({
        learnerId,
        batchId,
        trigger,
        curriculumId,
        status: "FAILED",
        reason: "Batch context not found.",
        retriedFromAttemptId: options.retriedFromAttemptId,
        actorUserId: options.actorUserId,
      });

      return { issued: false, status: "FAILED", attemptId, reason: "Batch context not found." };
    }

    courseId = context.courseId;
    programId = context.programId;

    // 2. Find matching auto-issue rule(s) for this trigger + curriculum (rules are curriculum-scoped, not batch-scoped)
    const ruleWhere: Record<string, unknown> = {
      trigger,
      isActive: true,
      deletedAt: null,
      template: { isActive: true },
    };
    if (trigger === "CURRICULUM_COMPLETION" && curriculumId) {
      ruleWhere.curriculumId = curriculumId;
    } else if (trigger === "ENROLLMENT_COMPLETION") {
      // Enrollment rules have null curriculumId
      ruleWhere.curriculumId = null;
    }

    const rule = await prisma.certificateAutoIssueRule.findFirst({
      where: ruleWhere,
      select: {
        id: true,
        templateId: true,
        template: { select: { title: true } },
      },
    });

    if (!rule) {
      const attemptId = await persistAutoIssueAttempt({
        learnerId,
        batchId,
        trigger,
        curriculumId,
        status: "SKIPPED",
        reason: "No matching auto-issue rule found.",
        retriedFromAttemptId: options.retriedFromAttemptId,
        actorUserId: options.actorUserId,
        courseId,
        programId,
      });

      return { issued: false, status: "SKIPPED", attemptId, reason: "No matching auto-issue rule found." };
    }

    ruleId = rule.id;
    templateId = rule.templateId;

    // 3. Check if learner already has an ISSUED certificate for THIS TEMPLATE
    // (prevent duplicate issuance for same template, but allow issuing multiple templates per course)
    const existingCert = await prisma.certificate.findFirst({
      where: {
        learnerId,
        templateId: rule.templateId,
        status: "ISSUED",
      },
      select: { id: true },
    });

    if (existingCert) {
      const attemptId = await persistAutoIssueAttempt({
        learnerId,
        batchId,
        ruleId,
        templateId,
        trigger,
        curriculumId,
        certificateId: existingCert.id,
        status: "SKIPPED",
        reason: "Learner already has an issued certificate from this template.",
        retriedFromAttemptId: options.retriedFromAttemptId,
        actorUserId: options.actorUserId,
        courseId,
        programId,
      });

      return {
        issued: false,
        status: "SKIPPED",
        attemptId,
        reason: "Learner already has an issued certificate from this template.",
      };
    }

    // 4. Issue the certificate (system-issued, no actor)
    const certificate = await issueCertificateService({
      learnerId,
      courseId,
      programId,
      batchId,
      templateId: rule.templateId,
    });

    // 5. Log the auto-issuance
    await createAuditLogEntry({
      entityType: AUDIT_ENTITY_TYPE.CERTIFICATE,
      entityId: certificate.id,
      action: AUDIT_ACTION_TYPE.CREATED,
      message: `Certificate auto-issued via ${trigger} trigger (rule ${rule.id}) using template "${rule.template.title}".`,
    });

    const attemptId = await persistAutoIssueAttempt({
      learnerId,
      batchId,
      ruleId,
      templateId,
      trigger,
      curriculumId,
      certificateId: certificate.id,
      status: "ISSUED",
      retriedFromAttemptId: options.retriedFromAttemptId,
      actorUserId: options.actorUserId,
      courseId,
      programId,
    });

    return { issued: true, status: "ISSUED", attemptId, certificateId: certificate.id };
  } catch (error) {
    console.error("[auto-issue] Failed to auto-issue certificate:", error);

    const reason = error instanceof Error ? error.message : "Unknown error during auto-issuance.";
    const attemptId = await persistAutoIssueAttempt({
      learnerId,
      batchId,
      ruleId,
      templateId,
      trigger,
      curriculumId,
      status: "FAILED",
      reason,
      retriedFromAttemptId: options.retriedFromAttemptId,
      actorUserId: options.actorUserId,
      courseId,
      programId,
    });

    return {
      issued: false,
      status: "FAILED",
      attemptId,
      reason,
    };
  }
}

export async function retryCertificateAutoIssueAttemptService(
  attemptId: string,
  options?: { actorUserId?: string | null },
): Promise<AutoIssueResult> {
  const attempt = await getCertificateAutoIssueAttemptRetryContext(attemptId);

  if (!attempt) {
    throw new Error("Certificate auto-issue attempt not found.");
  }

  if (attempt.status === "ISSUED") {
    throw new Error("Issued certificate auto-issue attempts cannot be retried.");
  }

  return attemptAutoIssueCertificate({
    learnerId: attempt.learnerId,
    batchId: attempt.batchId,
    trigger: attempt.trigger,
    curriculumId: attempt.curriculumId,
    retriedFromAttemptId: attempt.id,
    actorUserId: options?.actorUserId ?? null,
  });
}
