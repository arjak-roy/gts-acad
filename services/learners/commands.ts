import "server-only";

import { randomUUID } from "crypto";
import { AuditActionType, AuditEntityType, Prisma } from "@prisma/client";

import { hashPassword } from "@/lib/auth/password";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { CreateLearnerEnrollmentInput, CreateLearnerInput, UpdateLearnerInput } from "@/lib/validation-schemas/learners";
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

export async function updateLearnerService(learnerCode: string, input: UpdateLearnerInput, actorUserId?: string) {
  const normalizedLearnerCode = learnerCode.trim();
  const normalizedFullName = input.fullName?.trim();
  const normalizedEmail = input.email?.trim().toLowerCase();
  const normalizedPhone = input.phone !== undefined ? input.phone.trim() || null : undefined;
  const normalizedCountry = input.country !== undefined ? input.country.trim() || null : undefined;
  const normalizedDob = input.dob !== undefined ? (input.dob.trim().length > 0 ? new Date(input.dob) : null) : undefined;
  const normalizedGender = input.gender !== undefined ? input.gender.trim() || null : undefined;
  const normalizedTargetCountry = input.targetCountry !== undefined ? input.targetCountry.trim() || null : undefined;
  const normalizedTargetLanguage = input.targetLanguage !== undefined ? input.targetLanguage.trim() || null : undefined;
  const normalizedTargetExam = input.targetExam === undefined ? undefined : input.targetExam;

  if (normalizedDob !== undefined && normalizedDob !== null && Number.isNaN(normalizedDob.getTime())) {
    throw new Error("Invalid date of birth.");
  }

  if (!isDatabaseConfigured) {
    const learner = buildMockLearnerDetail(normalizedLearnerCode);

    if (!learner) {
      throw new Error("Learner not found.");
    }

    return {
      ...learner,
      fullName: normalizedFullName ?? learner.fullName,
      email: normalizedEmail ?? learner.email,
      phone: normalizedPhone !== undefined ? normalizedPhone : learner.phone,
      country: normalizedCountry !== undefined ? normalizedCountry : learner.country,
      dob: normalizedDob !== undefined ? (normalizedDob ? normalizedDob.toISOString() : null) : learner.dob,
      gender: normalizedGender !== undefined ? normalizedGender : learner.gender,
      targetCountry: normalizedTargetCountry !== undefined ? normalizedTargetCountry : learner.targetCountry,
      targetLanguage: normalizedTargetLanguage !== undefined ? normalizedTargetLanguage : learner.targetLanguage,
      targetExam: normalizedTargetExam !== undefined ? normalizedTargetExam : learner.targetExam,
    };
  }

  const learner = await prisma.$transaction(
    async (tx) => {
      const current = await tx.learner.findUnique({
        where: { learnerCode: normalizedLearnerCode },
        select: {
          id: true,
          learnerCode: true,
          userId: true,
          fullName: true,
          email: true,
          phone: true,
          country: true,
        },
      });

      if (!current) {
        throw new Error("Learner not found.");
      }

      if (normalizedEmail && normalizedEmail !== current.email.toLowerCase()) {
        const [existingLearner, existingUser] = await Promise.all([
          tx.learner.findUnique({ where: { email: normalizedEmail }, select: { id: true } }),
          tx.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } }),
        ]);

        if (existingLearner && existingLearner.id !== current.id) {
          throw new Error("Email already exists.");
        }

        if (existingUser && existingUser.id !== current.userId) {
          throw new Error("A user account already exists with this email.");
        }
      }

      await tx.learner.update({
        where: { id: current.id },
        data: {
          fullName: normalizedFullName,
          email: normalizedEmail,
          phone: normalizedPhone,
          country: normalizedCountry,
          dob: normalizedDob,
          gender: normalizedGender,
          targetCountry: normalizedTargetCountry,
          targetLanguage: normalizedTargetLanguage,
          targetExam: normalizedTargetExam,
        },
      });

      if (current.userId) {
        await tx.user.update({
          where: { id: current.userId },
          data: {
            name: normalizedFullName,
            email: normalizedEmail,
            phone: normalizedPhone,
          },
        });
      }

      return tx.learner.findUniqueOrThrow({ where: { id: current.id }, ...learnerDetailArgs });
    },
    { maxWait: 10_000, timeout: 15_000 },
  );

  const mappedLearner = mapLearnerToDetail(learner);

  await createAuditLogEntry({
    entityType: AuditEntityType.CANDIDATE,
    entityId: mappedLearner.id,
    action: AuditActionType.UPDATED,
    message: `Candidate ${mappedLearner.learnerCode} profile updated.`,
    metadata: {
      learnerCode: mappedLearner.learnerCode,
      fullName: normalizedFullName,
      email: normalizedEmail,
      phone: normalizedPhone,
      country: normalizedCountry,
      dob: normalizedDob ? normalizedDob.toISOString() : normalizedDob,
      gender: normalizedGender,
      targetCountry: normalizedTargetCountry,
      targetLanguage: normalizedTargetLanguage,
      targetExam: normalizedTargetExam,
    },
    actorUserId: actorUserId ?? null,
  });

  return mappedLearner;
}
