import "server-only";

import { randomUUID } from "crypto";
import { AuditActionType, AuditEntityType, Prisma } from "@prisma/client";

import { buildPendingAccountActivationMetadata, mergeAccountMetadata } from "@/lib/auth/account-metadata";
import { hashPassword } from "@/lib/auth/password";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { UpdateCandidateSelfProfileInput } from "@/lib/validation-schemas/candidate-profile";
import { CreateLearnerEnrollmentInput, CreateLearnerInput, UpdateLearnerInput } from "@/lib/validation-schemas/learners";
import {
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
import { getCandidateProfileByUserIdService } from "@/services/learners/queries";
import { sendAccountActivationEmail } from "@/services/auth/account-activation";
import {
  sendCandidateBuddyPersonaAvailableNotification,
  sendCandidateCourseEnrollmentNotification,
} from "@/services/candidate-notifications";
import { resolveBuddyPersonaForBatchService } from "@/services/buddy-personas-service";
import { createAuditLogEntry } from "@/services/logs-actions-service";
import { addRoleToUser } from "@/services/rbac-service";
import { CandidateProfile } from "@/services/learners/types";

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
              metadata: buildPendingAccountActivationMetadata({
                createdFrom: "candidate-enrollment",
                requiresPasswordReset: true,
                learnerCode: generatedLearnerCode,
                welcomeCredentialsEmailStatus: "pending",
              }, new Date().toISOString()) as Prisma.InputJsonValue,
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
        const delivery = await sendCandidateEnrollmentCredentialsEmail({
          recipientEmail: createdResult.createdUser.email,
          recipientName: createdResult.createdUser.name,
          temporaryPassword,
          learnerCode: createdResult.learnerCode,
          programName: normalizedProgramName,
        });

        await prisma.user.update({
          where: { id: createdResult.createdUser.id },
          data: {
            metadata: mergeAccountMetadata(createdResult.createdUser.metadata, {
              createdFrom: "candidate-enrollment",
              requiresPasswordReset: true,
              learnerCode: createdResult.learnerCode,
              welcomeCredentialsEmailStatus: delivery.status === "SENT" ? "sent" : "pending",
            }) as Prisma.InputJsonValue,
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
            metadata: mergeAccountMetadata(createdResult.createdUser.metadata, {
              createdFrom: "candidate-enrollment",
              requiresPasswordReset: true,
              learnerCode: createdResult.learnerCode,
              welcomeCredentialsEmailStatus: "failed",
            }) as Prisma.InputJsonValue,
          },
        });
      }

      try {
        await sendAccountActivationEmail(createdResult.createdUser.id);
      } catch (error) {
        console.warn("Candidate activation email dispatch failed.", error);
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

        try {
          const notificationSummary = await sendCandidateCourseEnrollmentNotification({
            learnerId: mappedLearner.id,
            batchId: mappedLearner.activeEnrollments[0]?.batchId ?? null,
            batchCode: normalizedBatchCode,
          });

          if (notificationSummary.failedCount > 0) {
            console.warn("Candidate course enrollment email partially failed.", notificationSummary);
          }
        } catch (error) {
          console.warn("Candidate course enrollment email dispatch failed.", error);
        }

        const enrollmentBatchId = mappedLearner.activeEnrollments[0]?.batchId ?? null;
        if (enrollmentBatchId) {
          try {
            const buddyPersona = await resolveBuddyPersonaForBatchService(enrollmentBatchId);

            if (buddyPersona) {
              const notificationSummary = await sendCandidateBuddyPersonaAvailableNotification({
                learnerId: mappedLearner.id,
                batchId: enrollmentBatchId,
                buddyPersonaName: buddyPersona.name,
                buddyLanguage: buddyPersona.language,
              });

              if (notificationSummary.failedCount > 0) {
                console.warn("Candidate Buddy persona email partially failed.", notificationSummary);
              }
            }
          } catch (error) {
            console.warn("Candidate Buddy persona email dispatch failed.", error);
          }
        }
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
    const learnerRecord = await prisma.$transaction(
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
          select: {
            id: true,
            status: true,
          },
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

        return learnerRecord;
      },
      { maxWait: 10_000, timeout: 15_000 },
    );

    const learner = await prisma.learner.findUniqueOrThrow({
      where: { id: learnerRecord.id },
      ...learnerDetailArgs,
    });

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

    try {
      const notificationSummary = await sendCandidateCourseEnrollmentNotification({
        learnerId: mappedLearner.id,
        batchCode: normalizedBatchCode,
      });

      if (notificationSummary.failedCount > 0) {
        console.warn("Candidate course enrollment email partially failed.", notificationSummary);
      }
    } catch (error) {
      console.warn("Candidate course enrollment email dispatch failed.", error);
    }

    const enrollmentBatchId =
      mappedLearner.activeEnrollments.find(
        (enrollment) => enrollment.batchCode.toLowerCase() === normalizedBatchCode.toLowerCase(),
      )?.batchId ?? null;

    if (enrollmentBatchId) {
      try {
        const buddyPersona = await resolveBuddyPersonaForBatchService(enrollmentBatchId);

        if (buddyPersona) {
          const notificationSummary = await sendCandidateBuddyPersonaAvailableNotification({
            learnerId: mappedLearner.id,
            batchId: enrollmentBatchId,
            buddyPersonaName: buddyPersona.name,
            buddyLanguage: buddyPersona.language,
          });

          if (notificationSummary.failedCount > 0) {
            console.warn("Candidate Buddy persona email partially failed.", notificationSummary);
          }
        }
      } catch (error) {
        console.warn("Candidate Buddy persona email dispatch failed.", error);
      }
    }

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

export async function updateCandidateSelfProfileService(
  userId: string,
  input: UpdateCandidateSelfProfileInput,
  actorUserId?: string,
): Promise<CandidateProfile> {
  if (!isDatabaseConfigured) {
    const mockProfile = await getCandidateProfileByUserIdService(userId);

    if (!mockProfile) {
      throw new Error("Candidate profile not found.");
    }

    return {
      ...mockProfile,
      fullName: input.fullName?.trim() ?? mockProfile.fullName,
      email: input.email?.trim().toLowerCase() ?? mockProfile.email,
      phone: input.phone !== undefined ? input.phone.trim() || null : mockProfile.phone ?? null,
      country: input.country !== undefined ? input.country.trim() || null : mockProfile.country ?? null,
      dob: input.dob !== undefined ? input.dob.trim() || null : mockProfile.dob ?? null,
      gender: input.gender !== undefined ? input.gender.trim() || null : mockProfile.gender ?? null,
    };
  }

  const learner = await prisma.learner.findFirst({
    where: { userId },
    select: { learnerCode: true },
  });

  if (!learner) {
    throw new Error("Candidate profile not found.");
  }

  await updateLearnerService(learner.learnerCode, input, actorUserId ?? userId);

  const profile = await getCandidateProfileByUserIdService(userId);

  if (!profile) {
    throw new Error("Candidate profile not found.");
  }

  return profile;
}
