import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import { buildPendingAccountActivationMetadata } from "@/lib/auth/account-metadata";
import { hashPassword } from "@/lib/auth/password";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import type { OnboardCandidateInput, UpdateCandidateUserInput, CandidateCustomMailInput } from "@/lib/validation-schemas/candidate-users";
import { createAuditLogEntry } from "@/services/logs-actions-service";
import { sendAccountActivationEmail } from "@/services/auth/account-activation";
import { addRoleToUser, assignRolesToUser, invalidateUserPermissionCache } from "@/services/rbac-service";
import { requestPasswordReset } from "@/services/auth";
import { sendCandidateCourseEnrollmentNotification } from "@/services/candidate-notifications";
import { deliverLoggedEmail } from "@/services/logs-actions-service";
import {
  getMetadataRecord,
  mergeMetadata,
  buildCandidateUserWhere,
  buildCandidateUserSelect,
  type CandidateUserRecord,
} from "@/services/users/candidate-helpers";
import { getCandidateUserByIdService } from "@/services/users/candidate-queries";
import { sendCandidateEnrollmentCredentialsEmail, generateLearnerCode } from "@/services/learners/internal-helpers";
import { invalidateAllUserSessions } from "@/services/auth/session-manager";
import { logUserActivity } from "@/services/user-activity-service";
import type { CandidateUserDetail } from "@/types";

function requireDatabase() {
  if (!isDatabaseConfigured) {
    throw new Error("Candidate user management requires database configuration.");
  }
}

export async function onboardCandidateService(
  input: OnboardCandidateInput,
  actorUserId?: string,
): Promise<CandidateUserDetail> {
  requireDatabase();

  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedFullName = input.fullName.trim();
  const normalizedPhone = input.phone.trim() || null;
  const normalizedCampus = input.campus.trim() || null;
  const normalizedProgramName = input.programName.trim();
  const normalizedBatchCode = input.batchCode.trim();

  const [existingLearner, existingUser] = await Promise.all([
    prisma.learner.findUnique({ where: { email: normalizedEmail }, select: { id: true } }),
    prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } }),
  ]);

  if (existingLearner) {
    throw new Error("A learner already exists with this email.");
  }

  if (existingUser) {
    throw new Error("A user account already exists with this email.");
  }

  const batch = normalizedBatchCode
    ? await prisma.batch.findFirst({
        where: { code: { equals: normalizedBatchCode, mode: "insensitive" } },
        select: { id: true },
      })
    : null;

  if (normalizedBatchCode && !batch) {
    throw new Error("Invalid batch code.");
  }

  const generatedLearnerCode = await generateLearnerCode();
  const temporaryPassword = randomUUID();
  const hashedTemporaryPassword = await hashPassword(temporaryPassword);
  const issuedAt = new Date().toISOString();

  const createdResult = await prisma.$transaction(
    async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          name: normalizedFullName,
          phone: normalizedPhone,
          password: hashedTemporaryPassword,
          isActive: true,
          metadata: buildPendingAccountActivationMetadata(
            {
              accountType: "CANDIDATE",
              createdFrom: "candidate-user-management",
              requiresPasswordReset: true,
              learnerCode: generatedLearnerCode,
              welcomeCredentialsEmailStatus: "pending",
              welcomeCredentialsLastIssuedAt: issuedAt,
            },
            issuedAt,
          ) as Prisma.InputJsonValue,
        },
        select: {
          id: true,
          email: true,
          name: true,
          metadata: true,
        },
      });

      await tx.userSecurity.create({
        data: {
          userId: createdUser.id,
          twoFactorEnabled: false,
          recoveryCodes: [],
        },
      });

      const createdLearner = await tx.learner.create({
        data: {
          userId: createdUser.id,
          learnerCode: generatedLearnerCode,
          fullName: normalizedFullName,
          email: normalizedEmail,
          phone: normalizedPhone,
          country: normalizedCampus,
        },
        select: { id: true },
      });

      if (batch) {
        await tx.batchEnrollment.create({
          data: {
            learnerId: createdLearner.id,
            batchId: batch.id,
            status: "ACTIVE",
          },
        });
      }

      return { createdUser, generatedLearnerCode, learnerId: createdLearner.id };
    },
    { maxWait: 10_000, timeout: 15_000 },
  );

  const candidateRole = await prisma.role.findUnique({ where: { code: "CANDIDATE" } });
  if (candidateRole) {
    await addRoleToUser(createdResult.createdUser.id, candidateRole.id);
  }

  try {
    const delivery = await sendCandidateEnrollmentCredentialsEmail({
      recipientEmail: createdResult.createdUser.email,
      recipientName: createdResult.createdUser.name,
      temporaryPassword,
      learnerCode: createdResult.generatedLearnerCode,
      programName: normalizedProgramName,
    });

    await prisma.user.update({
      where: { id: createdResult.createdUser.id },
      data: {
        metadata: mergeMetadata(createdResult.createdUser.metadata, {
          welcomeCredentialsEmailStatus: delivery.status === "SENT" ? "sent" : "pending",
          ...(delivery.status === "SENT" ? { welcomeCredentialsLastSentAt: new Date().toISOString() } : {}),
          welcomeCredentialsFailureReason: null,
        }) as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    await prisma.user.update({
      where: { id: createdResult.createdUser.id },
      data: {
        metadata: mergeMetadata(createdResult.createdUser.metadata, {
          welcomeCredentialsEmailStatus: "failed",
          welcomeCredentialsFailureReason: error instanceof Error ? error.message : "Unknown delivery failure.",
        }) as Prisma.InputJsonValue,
      },
    });
  }

  try {
    await sendAccountActivationEmail(createdResult.createdUser.id, {
      actorUserId: actorUserId ?? null,
    });
  } catch (error) {
    console.warn("Candidate account activation email dispatch failed.", error);
  }

  await createAuditLogEntry({
    entityType: "CANDIDATE",
    entityId: createdResult.createdUser.id,
    action: "CREATED",
    message: `Candidate ${normalizedEmail} onboarded from user management.`,
    metadata: {
      email: normalizedEmail,
      learnerCode: createdResult.generatedLearnerCode,
      programName: normalizedProgramName,
      batchCode: normalizedBatchCode || null,
    },
    actorUserId: actorUserId ?? null,
  });

  const detail = await getCandidateUserByIdService(createdResult.createdUser.id);
  if (!detail) {
    throw new Error("User not found after creation.");
  }

  if (normalizedBatchCode) {
    try {
      const notificationSummary = await sendCandidateCourseEnrollmentNotification({
        learnerId: createdResult.learnerId,
        batchId: batch?.id ?? null,
        batchCode: normalizedBatchCode,
        actorUserId: actorUserId ?? null,
      });

      if (notificationSummary.failedCount > 0) {
        console.warn("Candidate course enrollment email partially failed.", notificationSummary);
      }
    } catch (error) {
      console.warn("Candidate course enrollment email dispatch failed.", error);
    }
  }

  return detail;
}

export async function updateCandidateUserService(
  userId: string,
  input: UpdateCandidateUserInput,
  actorUserId?: string,
): Promise<CandidateUserDetail> {
  requireDatabase();

  const record = await prisma.user.findFirst({
    where: { id: userId, ...buildCandidateUserWhere() },
    select: { id: true, email: true },
  });

  if (!record) {
    throw new Error("Candidate user not found.");
  }

  const normalizedEmail = input.email?.trim().toLowerCase();

  if (normalizedEmail && normalizedEmail !== record.email.toLowerCase()) {
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser && existingUser.id !== userId) {
      throw new Error("A user account already exists with this email.");
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name?.trim(),
      email: normalizedEmail,
      phone: input.phone !== undefined ? input.phone.trim() || null : undefined,
      isActive: input.isActive,
    },
  });

  if (normalizedEmail) {
    await prisma.learner.updateMany({
      where: { userId },
      data: { email: normalizedEmail },
    });
  }

  if (input.name) {
    await prisma.learner.updateMany({
      where: { userId },
      data: { fullName: input.name.trim() },
    });
  }

  if (input.isActive !== undefined) {
    invalidateUserPermissionCache(userId);
  }

  // When deactivating a candidate, invalidate all their sessions to force logout.
  if (input.isActive === false) {
    await invalidateAllUserSessions(userId, "account-deactivated-by-admin");

    await logUserActivity({
      userId,
      activityType: "ACCOUNT_DEACTIVATED",
      metadata: { deactivatedBy: actorUserId ?? "system" },
    });
  }

  // Log reactivation as activity for audit trail.
  if (input.isActive === true) {
    await logUserActivity({
      userId,
      activityType: "ACCOUNT_ACTIVATED",
      metadata: { activatedBy: actorUserId ?? "system" },
    });
  }

  await createAuditLogEntry({
    entityType: "CANDIDATE",
    entityId: userId,
    action: input.isActive === false ? "DEACTIVATED" : input.isActive === true ? "ACTIVATED" : "UPDATED",
    message: input.isActive === false
      ? `Candidate user ${record.email} deactivated. All sessions invalidated.`
      : input.isActive === true
        ? `Candidate user ${record.email} activated.`
        : `Candidate user ${record.email} updated from user management.`,
    metadata: {
      name: input.name?.trim(),
      email: normalizedEmail,
      phone: input.phone?.trim() || null,
      isActive: input.isActive,
    },
    actorUserId: actorUserId ?? null,
  });

  const detail = await getCandidateUserByIdService(userId);
  if (!detail) {
    throw new Error("User not found.");
  }

  return detail;
}

export async function assignCandidateUserRolesService(
  userId: string,
  roleIds: string[],
  actorUserId?: string,
): Promise<CandidateUserDetail> {
  requireDatabase();

  const record = await prisma.user.findFirst({
    where: { id: userId, ...buildCandidateUserWhere() },
    select: { id: true, email: true },
  });

  if (!record) {
    throw new Error("Candidate user not found.");
  }

  const roles = await prisma.role.findMany({
    where: { id: { in: roleIds }, isActive: true },
    select: { id: true, code: true, name: true },
  });

  if (roles.length !== roleIds.length) {
    throw new Error("Invalid role selection.");
  }

  await assignRolesToUser(userId, roles.map((r) => r.id));

  await createAuditLogEntry({
    entityType: "CANDIDATE",
    entityId: userId,
    action: "UPDATED",
    message: `Candidate user ${record.email} roles updated.`,
    metadata: { roles: roles.map((r) => r.code) },
    actorUserId: actorUserId ?? null,
  });

  const detail = await getCandidateUserByIdService(userId);
  if (!detail) {
    throw new Error("User not found.");
  }

  return detail;
}

export async function resendCandidateWelcomeService(
  userId: string,
  actorUserId?: string,
): Promise<CandidateUserDetail> {
  requireDatabase();

  const record = await prisma.user.findFirst({
    where: { id: userId, ...buildCandidateUserWhere() },
    select: buildCandidateUserSelect(),
  });

  if (!record) {
    throw new Error("Candidate user not found.");
  }

  const castRecord = record as CandidateUserRecord;
  const learnerCode = castRecord.learnerAccount?.learnerCode ?? "N/A";
  const programName = castRecord.learnerAccount?.enrollments?.[0]?.batch?.program?.name ?? "N/A";
  const temporaryPassword = randomUUID();
  const hashedTemporaryPassword = await hashPassword(temporaryPassword);

  const nextMetadata = mergeMetadata(castRecord.metadata, {
    accountType: "CANDIDATE",
    requiresPasswordReset: true,
    welcomeCredentialsEmailStatus: "pending",
    welcomeCredentialsLastIssuedAt: new Date().toISOString(),
    welcomeCredentialsFailureReason: null,
  });

  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedTemporaryPassword,
      metadata: nextMetadata as Prisma.InputJsonValue,
    },
  });

  try {
    const delivery = await sendCandidateEnrollmentCredentialsEmail({
      recipientEmail: castRecord.email,
      recipientName: castRecord.name,
      temporaryPassword,
      learnerCode,
      programName,
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        metadata: {
          ...nextMetadata,
          welcomeCredentialsEmailStatus: delivery.status === "SENT" ? "sent" : "pending",
          ...(delivery.status === "SENT" ? { welcomeCredentialsLastSentAt: new Date().toISOString() } : {}),
          welcomeCredentialsFailureReason: null,
        } as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        metadata: {
          ...nextMetadata,
          welcomeCredentialsEmailStatus: "failed",
          welcomeCredentialsFailureReason: error instanceof Error ? error.message : "Unknown delivery failure.",
        } as Prisma.InputJsonValue,
      },
    });
  }

  try {
    await sendAccountActivationEmail(userId, { actorUserId: actorUserId ?? null });
  } catch (error) {
    console.warn("Candidate activation email re-issue failed.", error);
  }

  await createAuditLogEntry({
    entityType: "CANDIDATE",
    entityId: userId,
    action: "UPDATED",
    message: `Candidate welcome credentials re-issued for ${castRecord.email}.`,
    actorUserId: actorUserId ?? null,
  });

  const detail = await getCandidateUserByIdService(userId);
  if (!detail) {
    throw new Error("User not found.");
  }

  return detail;
}

export async function sendCandidatePasswordResetService(
  userId: string,
  actorUserId?: string,
) {
  requireDatabase();

  const record = await prisma.user.findFirst({
    where: { id: userId, ...buildCandidateUserWhere() },
    select: { id: true, email: true },
  });

  if (!record) {
    throw new Error("Candidate user not found.");
  }

  await requestPasswordReset(record.email, {});

  await createAuditLogEntry({
    entityType: "CANDIDATE",
    entityId: userId,
    action: "UPDATED",
    message: `Admin password reset requested for candidate ${record.email}.`,
    actorUserId: actorUserId ?? null,
  });

  return { ok: true };
}

export async function sendCandidateCustomMailService(
  userId: string,
  input: CandidateCustomMailInput,
  actorUserId?: string,
) {
  requireDatabase();

  const record = await prisma.user.findFirst({
    where: { id: userId, ...buildCandidateUserWhere() },
    select: { id: true, email: true, name: true },
  });

  if (!record) {
    throw new Error("Candidate user not found.");
  }

  const delivery = await deliverLoggedEmail({
    to: record.email,
    subject: input.subject,
    text: input.body,
    html: `<div style="white-space: pre-wrap;">${input.body.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`,
    category: "SYSTEM",
    templateKey: "custom-candidate-mail",
    audit: {
      entityType: "CANDIDATE",
      entityId: userId,
    },
  });

  await createAuditLogEntry({
    entityType: "CANDIDATE",
    entityId: userId,
    action: "UPDATED",
    message: `${delivery.status === "SENT" ? "Custom email sent" : "Custom email queued"} for candidate ${record.email}: ${input.subject}`,
    metadata: { subject: input.subject },
    actorUserId: actorUserId ?? null,
  });

  return { ok: true, deliveryStatus: delivery.status };
}
