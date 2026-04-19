import "server-only";

import { Prisma } from "@prisma/client";
import type { CertificateAutoIssueTrigger } from "@prisma/client";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import type {
  CertificateAutoIssueAttemptStatus,
  CertificateAutoIssueAttemptSummary,
} from "@/services/certifications/types";

type RetryContextRow = {
  id: string;
  learnerId: string;
  batchId: string;
  curriculumId: string | null;
  triggerDbValue: string;
  statusDbValue: string;
};

type AttemptListRow = {
  id: string;
  learnerId: string;
  learnerName: string;
  batchId: string;
  batchCode: string;
  batchName: string;
  curriculumId: string | null;
  curriculumTitle: string | null;
  templateId: string | null;
  templateTitle: string | null;
  triggerDbValue: string;
  statusDbValue: string;
  reason: string | null;
  certificateId: string | null;
  attemptedAt: Date;
  retriedFromAttemptId: string | null;
};

const triggerToDbValue: Record<CertificateAutoIssueTrigger, string> = {
  CURRICULUM_COMPLETION: "curriculum_completion",
  ENROLLMENT_COMPLETION: "enrollment_completion",
};

const dbValueToTrigger: Record<string, CertificateAutoIssueTrigger> = {
  curriculum_completion: "CURRICULUM_COMPLETION",
  enrollment_completion: "ENROLLMENT_COMPLETION",
};

const statusToDbValue: Record<CertificateAutoIssueAttemptStatus, string> = {
  ISSUED: "issued",
  SKIPPED: "skipped",
  FAILED: "failed",
};

const dbValueToStatus: Record<string, CertificateAutoIssueAttemptStatus> = {
  issued: "ISSUED",
  skipped: "SKIPPED",
  failed: "FAILED",
};

function normalizeReason(reason: string | null | undefined) {
  if (!reason) {
    return null;
  }

  return reason.length > 1000 ? `${reason.slice(0, 997)}...` : reason;
}

function isAutoIssueAttemptStorageUnavailable(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    message.includes("certificate_auto_issue_attempt") &&
    (message.includes("does not exist") || message.includes("doesn't exist") || message.includes("unknown"))
  );
}

function mapDbTrigger(value: string): CertificateAutoIssueTrigger {
  return dbValueToTrigger[value] ?? "CURRICULUM_COMPLETION";
}

function mapDbStatus(value: string): CertificateAutoIssueAttemptStatus {
  return dbValueToStatus[value] ?? "FAILED";
}

export async function recordCertificateAutoIssueAttempt(input: {
  learnerId: string;
  batchId: string;
  ruleId?: string | null;
  templateId?: string | null;
  curriculumId?: string | null;
  trigger: CertificateAutoIssueTrigger;
  status: CertificateAutoIssueAttemptStatus;
  certificateId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  retriedFromAttemptId?: string | null;
}): Promise<string | null> {
  if (!isDatabaseConfigured) {
    return null;
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      INSERT INTO "certificate_auto_issue_attempts" (
        "candidate_id",
        "batch_id",
        "rule_id",
        "template_id",
        "curriculum_id",
        "trigger",
        "status",
        "certificate_id",
        "reason",
        "metadata",
        "retried_from_attempt_id"
      )
      VALUES (
        ${input.learnerId},
        ${input.batchId},
        ${input.ruleId ?? null},
        ${input.templateId ?? null},
        ${input.curriculumId ?? null},
        CAST(${triggerToDbValue[input.trigger]} AS "certificate_auto_issue_trigger"),
        CAST(${statusToDbValue[input.status]} AS "certificate_auto_issue_attempt_status"),
        ${input.certificateId ?? null},
        ${normalizeReason(input.reason)},
        CAST(${JSON.stringify(input.metadata ?? {})} AS jsonb),
        ${input.retriedFromAttemptId ?? null}
      )
      RETURNING "attempt_id" AS "id"
    `);

    return rows[0]?.id ?? null;
  } catch (error) {
    if (!isAutoIssueAttemptStorageUnavailable(error)) {
      console.error("[auto-issue-attempts] Failed to record certificate auto-issue attempt:", error);
    }

    return null;
  }
}

export async function listCertificateAutoIssueAttemptsService(options: {
  courseId: string;
  status?: CertificateAutoIssueAttemptStatus;
  limit?: number;
  openOnly?: boolean;
}): Promise<CertificateAutoIssueAttemptSummary[]> {
  if (!isDatabaseConfigured) {
    return [];
  }

  const limit = Math.max(1, Math.min(options.limit ?? 25, 100));

  try {
    const rows = await prisma.$queryRaw<AttemptListRow[]>(Prisma.sql`
      SELECT
        attempt."attempt_id" AS "id",
        learner."candidate_id" AS "learnerId",
        learner."full_name" AS "learnerName",
        batch."batch_id" AS "batchId",
        batch."code" AS "batchCode",
        batch."batch_name" AS "batchName",
        attempt."curriculum_id" AS "curriculumId",
        curriculum."title" AS "curriculumTitle",
        COALESCE(attempt."template_id", rule."template_id") AS "templateId",
        template."title" AS "templateTitle",
        attempt."trigger"::text AS "triggerDbValue",
        attempt."status"::text AS "statusDbValue",
        attempt."reason" AS "reason",
        attempt."certificate_id" AS "certificateId",
        attempt."attempted_at" AS "attemptedAt",
        attempt."retried_from_attempt_id" AS "retriedFromAttemptId"
      FROM "certificate_auto_issue_attempts" attempt
      INNER JOIN "candidates" learner
        ON learner."candidate_id" = attempt."candidate_id"
      INNER JOIN "batches" batch
        ON batch."batch_id" = attempt."batch_id"
      INNER JOIN "programs" program
        ON program."program_id" = batch."program_id"
      LEFT JOIN "certificate_auto_issue_rules" rule
        ON rule."rule_id" = attempt."rule_id"
      LEFT JOIN "certificate_templates" template
        ON template."template_id" = COALESCE(attempt."template_id", rule."template_id")
      LEFT JOIN "curricula" curriculum
        ON curriculum."curriculum_id" = attempt."curriculum_id"
      WHERE program."course_id" = ${options.courseId}
      ${options.status
        ? Prisma.sql`AND attempt."status" = CAST(${statusToDbValue[options.status]} AS "certificate_auto_issue_attempt_status")`
        : Prisma.empty}
      ${options.openOnly
        ? Prisma.sql`
          AND NOT EXISTS (
            SELECT 1
            FROM "certificate_auto_issue_attempts" retry_attempt
            WHERE retry_attempt."retried_from_attempt_id" = attempt."attempt_id"
          )
        `
        : Prisma.empty}
      ORDER BY attempt."attempted_at" DESC
      LIMIT ${limit}
    `);

    return rows.map((row) => ({
      id: row.id,
      learnerId: row.learnerId,
      learnerName: row.learnerName,
      batchId: row.batchId,
      batchCode: row.batchCode,
      batchName: row.batchName,
      curriculumId: row.curriculumId,
      curriculumTitle: row.curriculumTitle,
      templateId: row.templateId,
      templateTitle: row.templateTitle,
      trigger: mapDbTrigger(row.triggerDbValue),
      status: mapDbStatus(row.statusDbValue),
      reason: row.reason,
      certificateId: row.certificateId,
      attemptedAt: row.attemptedAt.toISOString(),
      retriedFromAttemptId: row.retriedFromAttemptId,
    }));
  } catch (error) {
    if (isAutoIssueAttemptStorageUnavailable(error)) {
      return [];
    }

    throw error;
  }
}

export async function getCertificateAutoIssueAttemptRetryContext(attemptId: string): Promise<{
  id: string;
  learnerId: string;
  batchId: string;
  curriculumId: string | null;
  trigger: CertificateAutoIssueTrigger;
  status: CertificateAutoIssueAttemptStatus;
} | null> {
  if (!isDatabaseConfigured) {
    return null;
  }

  try {
    const rows = await prisma.$queryRaw<RetryContextRow[]>(Prisma.sql`
      SELECT
        attempt."attempt_id" AS "id",
        attempt."candidate_id" AS "learnerId",
        attempt."batch_id" AS "batchId",
        attempt."curriculum_id" AS "curriculumId",
        attempt."trigger"::text AS "triggerDbValue",
        attempt."status"::text AS "statusDbValue"
      FROM "certificate_auto_issue_attempts" attempt
      WHERE attempt."attempt_id" = ${attemptId}
      LIMIT 1
    `);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      learnerId: row.learnerId,
      batchId: row.batchId,
      curriculumId: row.curriculumId,
      trigger: mapDbTrigger(row.triggerDbValue),
      status: mapDbStatus(row.statusDbValue),
    };
  } catch (error) {
    if (isAutoIssueAttemptStorageUnavailable(error)) {
      throw new Error("Certificate auto-issue attempts are unavailable until the database migration is applied.");
    }

    throw error;
  }
}