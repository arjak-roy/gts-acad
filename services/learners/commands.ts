import "server-only";

import { randomUUID } from "crypto";
import { AuditActionType, AuditEntityType, Prisma } from "@prisma/client";

import { hashPassword } from "@/lib/auth/password";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { CreateLearnerEnrollmentInput, CreateLearnerInput } from "@/lib/validation-schemas/learners";
import {
  batchDetailArgs,
  buildMockActiveEnrollment,
  buildMockLearnerCode,
  buildMockLearnerDetail,
  generateLearnerCode,
  isLearnerCodeConflict,
  learnerDetailArgs,
  mapLearnerToDetail,
  sendCandidateEnrollmentCredentialsEmail,
  MOCK_ENROLLMENT_CATALOG,
} from "@/services/learners/internal-helpers";
import { createAuditLogEntry } from "@/services/logs-actions-service";
import { addRoleToUser } from "@/services/rbac-service";

export async function createLearnerService(input: CreateLearnerInput) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedFullName = input.fullName.trim();
  const normalizedPhone = input.phone.trim() || null;
  const normalizedCampus = input.campus.trim() || null;
  const normalizedProgramName = input.programName.trim();
  const normalizedBatchCode = input.batchCode.trim();

  if (!isDatabaseConfigured) {
    const nowId = `mock-${Date.now()}`;
    const activeEnrollments = normalizedBatchCode ? [buildMockActiveEnrollment(normalizedBatchCode, nowId)] : [];

    return {
      id: nowId,
      learnerCode: buildMockLearnerCode(),
      fullName: normalizedFullName,
      email: normalizedEmail,
      phone: normalizedPhone,
      country: normalizedCampus,
      attendancePercentage: 0,
      averageScore: 0,
      readinessPercentage: 0,
      placementStatus: "NOT_READY",
      recruiterSyncStatus: "NOT_SYNCED",
      programName: normalizedProgramName,
      batchCode: normalizedBatchCode || null,
      campus: normalizedCampus,
      trainerName: null,
      programType: null,
      softSkillsScore: 0,
      latestSyncMessage: null,
      activeEnrollments,
    };
  }

  const [existingLearnerEmail, existingUserEmail] = await Promise.all([
    prisma.learner.findUnique({ where: { email: normalizedEmail }, select: { id: true } }),
    prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } }),
  ]);

  if (existingLearnerEmail) {
    throw new Error("Email already exists.");
  }

  if (existingUserEmail) {
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

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const generatedLearnerCode = await generateLearnerCode();
    const temporaryPassword = randomUUID();
    const hashedTemporaryPassword = await hashPassword(temporaryPassword);

    try {
      const createdResult = await prisma.$transaction(
        async (tx) => {
          const createdUser = await tx.user.create({
            data: {
              email: normalizedEmail,
              name: normalizedFullName,
              phone: normalizedPhone,
              password: hashedTemporaryPassword,
              isActive: true,
              metadata: {
                createdFrom: "candidate-enrollment",
                requiresPasswordReset: true,
                learnerCode: generatedLearnerCode,
                welcomeCredentialsEmailStatus: "pending",
              },
            },
            select: {
              id: true,
              email: true,
              name: true,
            },
          });

          await tx.userSecurity.create({
            data: {
              userId: createdUser.id,
              twoFactorEnabled: false,
              recoveryCodes: [],
            },
          });

          const created = await tx.learner.create({
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
                learnerId: created.id,
                batchId: batch.id,
                status: "ACTIVE",
              },
            });
          }

          return {
            learnerId: created.id,
            learnerCode: generatedLearnerCode,
            createdUser,
          };
        },
        { maxWait: 10_000, timeout: 15_000 },
      );

      const candidateRole = await prisma.role.findUnique({ where: { code: "CANDIDATE" } });
      if (candidateRole) {
        await addRoleToUser(createdResult.createdUser.id, candidateRole.id);
      }

      const learner = await prisma.learner.findUniqueOrThrow({
        where: { id: createdResult.learnerId },
        ...learnerDetailArgs,
      });

      try {
        await sendCandidateEnrollmentCredentialsEmail({
          recipientEmail: createdResult.createdUser.email,
          recipientName: createdResult.createdUser.name,
          temporaryPassword,
          learnerCode: createdResult.learnerCode,
          programName: normalizedProgramName,
        });

        await prisma.user.update({
          where: { id: createdResult.createdUser.id },
          data: {
            metadata: {
              createdFrom: "candidate-enrollment",
              requiresPasswordReset: true,
              learnerCode: createdResult.learnerCode,
              welcomeCredentialsEmailStatus: "sent",
            },
          },
        });
      } catch (mailError) {
        console.error("Candidate welcome email dispatch failed", {
          learnerCode: createdResult.learnerCode,
          email: createdResult.createdUser.email,
          error: mailError,
        });

        await prisma.user.update({
          where: { id: createdResult.createdUser.id },
          data: {
            metadata: {
              createdFrom: "candidate-enrollment",
              requiresPasswordReset: true,
              learnerCode: createdResult.learnerCode,
              welcomeCredentialsEmailStatus: "failed",
            },
          },
        });
      }

      const mappedLearner = mapLearnerToDetail(learner);

      await createAuditLogEntry({
        entityType: AuditEntityType.CANDIDATE,
        entityId: mappedLearner.id,
        action: AuditActionType.CREATED,
        message: `Candidate ${mappedLearner.learnerCode} created from enrollment flow.`,
        metadata: {
          learnerCode: mappedLearner.learnerCode,
          email: mappedLearner.email,
          batchCode: normalizedBatchCode || null,
        },
      });

      if (normalizedBatchCode) {
        await createAuditLogEntry({
          entityType: AuditEntityType.BATCH,
          entityId: normalizedBatchCode,
          action: AuditActionType.ENROLLED,
          message: `Candidate ${mappedLearner.learnerCode} enrolled into batch ${normalizedBatchCode}.`,
          metadata: {
            learnerCode: mappedLearner.learnerCode,
            learnerId: mappedLearner.id,
            batchCode: normalizedBatchCode,
          },
        });
      }

      return mappedLearner;
    } catch (error) {
      if (isLearnerCodeConflict(error)) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Unable to generate learner code.");
}

export async function addLearnerEnrollmentService(learnerCode: string, input: CreateLearnerEnrollmentInput) {
  const normalizedLearnerCode = learnerCode.trim();
  const normalizedBatchCode = input.batchCode.trim();

  if (!isDatabaseConfigured) {
    const learner = buildMockLearnerDetail(normalizedLearnerCode);

    if (!learner) {
      throw new Error("Learner not found.");
    }

    const existingEnrollment = learner.activeEnrollments.find(
      (enrollment) => enrollment.batchCode.toLowerCase() === normalizedBatchCode.toLowerCase(),
    );

    if (existingEnrollment) {
      throw new Error("Learner is already enrolled in this batch.");
    }

    const mockEnrollment = Object.entries(MOCK_ENROLLMENT_CATALOG).find(
      ([batchCode]) => batchCode.toLowerCase() === normalizedBatchCode.toLowerCase(),
    );

    if (!mockEnrollment) {
      throw new Error("Invalid batch code.");
    }

    return {
      ...learner,
      activeEnrollments: [buildMockActiveEnrollment(mockEnrollment[0], `${learner.learnerCode}-new`), ...learner.activeEnrollments],
    };
  }

  try {
    const learner = await prisma.$transaction(
      async (tx) => {
        const learnerRecord = await tx.learner.findUnique({
          where: { learnerCode: normalizedLearnerCode },
          select: { id: true },
        });

        if (!learnerRecord) {
          throw new Error("Learner not found.");
        }

        const batch = await tx.batch.findFirst({
          where: {
            code: { equals: normalizedBatchCode, mode: "insensitive" },
          },
          ...batchDetailArgs,
        });

        if (!batch) {
          throw new Error("Invalid batch code.");
        }

        if (batch.status !== "PLANNED" && batch.status !== "IN_SESSION") {
          throw new Error("Only planned or in-session batches can accept enrollments.");
        }

        const existingEnrollment = await tx.batchEnrollment.findFirst({
          where: {
            learnerId: learnerRecord.id,
            batchId: batch.id,
          },
          select: {
            id: true,
          },
        });

        if (existingEnrollment) {
          throw new Error("Learner is already enrolled in this batch.");
        }

        await tx.batchEnrollment.create({
          data: {
            learnerId: learnerRecord.id,
            batchId: batch.id,
            status: "ACTIVE",
          },
        });

        return tx.learner.findUniqueOrThrow({ where: { id: learnerRecord.id }, ...learnerDetailArgs });
      },
      { maxWait: 10_000, timeout: 15_000 },
    );

    const mappedLearner = mapLearnerToDetail(learner);

    await createAuditLogEntry({
      entityType: AuditEntityType.BATCH,
      entityId: normalizedBatchCode,
      action: AuditActionType.ENROLLED,
      message: `Candidate ${mappedLearner.learnerCode} enrolled into batch ${normalizedBatchCode}.`,
      metadata: {
        learnerCode: mappedLearner.learnerCode,
        learnerId: mappedLearner.id,
        batchCode: normalizedBatchCode,
      },
    });

    return mappedLearner;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("Learner is already enrolled in this batch.");
    }

    throw error;
  }
}
