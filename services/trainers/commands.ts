import { randomUUID } from "crypto";

import { Prisma } from "@prisma/client";

import { buildPendingAccountActivationMetadata } from "@/lib/auth/account-metadata";
import { hashPassword } from "@/lib/auth/password";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { TRAINER_ROLE_CODE } from "@/lib/users/constants";
import { sendAccountActivationEmail } from "@/services/auth/account-activation";
import { createAuditLogEntry } from "@/services/logs-actions-service";
import { invalidateUserPermissionCache } from "@/services/rbac-service";
import { mapTrainerCourseNames } from "@/services/trainers/course-assignment-helpers";
import {
  normalizeTrainerCourseList,
  normalizeTrainerEmployeeCode,
  resolveTrainerSelectedCourses,
} from "@/services/trainers/import-helpers";
import { MOCK_TRAINERS } from "@/services/trainers/mock-data";
import { TrainerCreateResult, TrainerDetail, TrainerOption, TrainerStatus } from "@/services/trainers/types";
import { CreateTrainerInput, UpdateTrainerCoursesInput, UpdateTrainerInput } from "@/lib/validation-schemas/trainers";
import { sendInternalUserWelcomeEmail, updateInternalUserMetadata } from "@/services/users/internal-helpers";

const trainerCourseAssignmentsInclude = {
  courseAssignments: {
    select: {
      course: {
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      },
    },
    orderBy: {
      course: {
        name: "asc" as const,
      },
    },
  },
};

async function sendTrainerWelcomeEmail(input: {
  userId: string;
  recipientEmail: string;
  recipientName: string;
  temporaryPassword: string;
  actorUserId?: string;
  roleName: string;
}) {
  return sendInternalUserWelcomeEmail({
    userId: input.userId,
    recipientEmail: input.recipientEmail,
    recipientName: input.recipientName,
    temporaryPassword: input.temporaryPassword,
    roles: [{ name: input.roleName }],
    actorUserId: input.actorUserId,
  });
}

export async function createTrainerService(
  input: CreateTrainerInput,
  actor: { actorUserId?: string | null } = {},
): Promise<TrainerCreateResult> {
  const normalizedFullName = input.fullName.trim();
  const normalizedEmployeeCode = normalizeTrainerEmployeeCode(input.employeeCode);
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedPhone = input.phone.trim() || null;
  const normalizedSpecialization = input.specialization.trim();
  const normalizedBio = input.bio.trim() || null;
  const normalizedCourses = normalizeTrainerCourseList(input.courses);
  const isActive = input.status === "ACTIVE";

  if (!isDatabaseConfigured) {
    const mockId = `mock-${Date.now()}`;
    return {
      id: mockId,
      userId: `mock-user-${Date.now()}`,
      fullName: normalizedFullName,
      employeeCode: normalizedEmployeeCode,
      email: normalizedEmail,
      phone: normalizedPhone,
      specialization: normalizedSpecialization,
      bio: normalizedBio,
      capacity: input.capacity,
      status: input.status,
      availabilityStatus: input.availabilityStatus,
      courses: normalizedCourses,
      lastActiveAt: null,
    };
  }

  const [existingUser, existingTrainerCode, resolvedCourses, trainerRole] = await Promise.all([
    prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } }),
    prisma.trainerProfile.findFirst({ where: { employeeCode: normalizedEmployeeCode }, select: { id: true } }),
    resolveTrainerSelectedCourses(normalizedCourses),
    prisma.role.findUnique({
      where: { code: TRAINER_ROLE_CODE },
      select: { id: true, name: true, code: true },
    }),
  ]);

  if (existingUser) {
    throw new Error("Email already exists.");
  }

  if (existingTrainerCode) {
    throw new Error("Employee code already exists.");
  }

  if (!trainerRole) {
    throw new Error("Trainer role is not configured.");
  }

  const temporaryPassword = randomUUID();
  const hashedTemporaryPassword = await hashPassword(temporaryPassword);
  const issuedAt = new Date().toISOString();

  const trainer = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: normalizedEmail,
        name: normalizedFullName,
        phone: normalizedPhone,
        password: hashedTemporaryPassword,
        isActive,
        metadata: buildPendingAccountActivationMetadata({
          accountType: "INTERNAL",
          createdFrom: "trainer-registry",
          requiresPasswordReset: true,
          welcomeCredentialsEmailStatus: "pending",
          welcomeCredentialsLastIssuedAt: issuedAt,
        }, issuedAt) as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        metadata: true,
      },
    });

    await tx.userSecurity.create({
      data: {
        userId: user.id,
        twoFactorEnabled: true,
        recoveryCodes: [],
      },
    });

    await tx.userRoleAssignment.createMany({
      data: [{ userId: user.id, roleId: trainerRole.id }],
      skipDuplicates: true,
    });

    const profile = await tx.trainerProfile.create({
      data: {
        userId: user.id,
        employeeCode: normalizedEmployeeCode,
        specialization: normalizedSpecialization,
        bio: normalizedBio,
        capacity: input.capacity,
        isActive,
        availabilityStatus: input.availabilityStatus,
        courseAssignments: {
          create: resolvedCourses.map((course) => ({
            courseId: course.id,
          })),
        },
      },
      select: {
        id: true,
        specialization: true,
        bio: true,
        capacity: true,
        isActive: true,
        availabilityStatus: true,
      },
    });

    return {
      user,
      profile,
    };
  });

  invalidateUserPermissionCache(trainer.user.id);

  try {
    const delivery = await sendTrainerWelcomeEmail({
      userId: trainer.user.id,
      recipientEmail: trainer.user.email,
      recipientName: trainer.user.name,
      temporaryPassword,
      actorUserId: actor.actorUserId ?? undefined,
      roleName: trainerRole.name,
    });

    await updateInternalUserMetadata(trainer.user.id, trainer.user.metadata, {
      welcomeCredentialsEmailStatus: delivery.status === "SENT" ? "sent" : "pending",
      ...(delivery.status === "SENT" ? { welcomeCredentialsLastSentAt: new Date().toISOString() } : {}),
      welcomeCredentialsFailureReason: null,
    });
  } catch (error) {
    console.error("Trainer welcome email dispatch failed", {
      email: trainer.user.email,
      error,
    });

    await updateInternalUserMetadata(trainer.user.id, trainer.user.metadata, {
      welcomeCredentialsEmailStatus: "failed",
      welcomeCredentialsFailureReason: error instanceof Error ? error.message : "Unknown delivery failure.",
    });
  }

  try {
    await sendAccountActivationEmail(trainer.user.id, {
      actorUserId: actor.actorUserId ?? null,
    });
  } catch (error) {
    console.warn("Trainer activation email dispatch failed.", error);
  }

  await createAuditLogEntry({
    entityType: "AUTH",
    entityId: trainer.user.id,
    action: "CREATED",
    message: `Trainer ${normalizedEmail} onboarded from the trainer registry.`,
    metadata: {
      email: normalizedEmail,
      employeeCode: normalizedEmployeeCode,
      role: trainerRole.code,
      specialization: normalizedSpecialization,
      courseIds: resolvedCourses.map((course) => course.id),
      courseNames: resolvedCourses.map((course) => course.name),
    },
    actorUserId: actor.actorUserId ?? null,
  });

  return {
    id: trainer.profile.id,
    userId: trainer.user.id,
    fullName: trainer.user.name,
    employeeCode: normalizedEmployeeCode,
    email: trainer.user.email,
    phone: trainer.user.phone,
    specialization: trainer.profile.specialization,
    bio: trainer.profile.bio,
    capacity: trainer.profile.capacity,
    status: trainer.profile.isActive ? "ACTIVE" : "INACTIVE",
    availabilityStatus: trainer.profile.availabilityStatus,
    courses: resolvedCourses.map((course) => course.name),
    lastActiveAt: null,
  };
}

export async function updateTrainerService(input: UpdateTrainerInput): Promise<TrainerCreateResult> {
  const normalizedFullName = input.fullName.trim();
  const normalizedEmployeeCode = normalizeTrainerEmployeeCode(input.employeeCode);
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedPhone = input.phone.trim() || null;
  const normalizedSpecialization = input.specialization.trim();
  const normalizedBio = input.bio.trim() || null;
  const normalizedCourses = normalizeTrainerCourseList(input.courses);
  const isActive = input.status === "ACTIVE";

  if (!isDatabaseConfigured) {
    return {
      id: input.trainerId,
      userId: `mock-user-${input.trainerId}`,
      fullName: normalizedFullName,
      employeeCode: normalizedEmployeeCode,
      email: normalizedEmail,
      phone: normalizedPhone,
      specialization: normalizedSpecialization,
      bio: normalizedBio,
      capacity: input.capacity,
      status: input.status,
      availabilityStatus: input.availabilityStatus,
      courses: normalizedCourses,
      lastActiveAt: null,
    };
  }

  const trainer = await prisma.trainerProfile.findUnique({
    where: { id: input.trainerId },
    select: { id: true, userId: true },
  });

  if (!trainer) {
    throw new Error("Trainer not found.");
  }

  const [existingUser, existingTrainerCode, resolvedCourses] = await Promise.all([
    prisma.user.findFirst({
      where: {
        id: { not: trainer.userId },
        email: normalizedEmail,
      },
      select: { id: true },
    }),
    prisma.trainerProfile.findFirst({
      where: {
        id: { not: input.trainerId },
        employeeCode: normalizedEmployeeCode,
      },
      select: { id: true },
    }),
    resolveTrainerSelectedCourses(normalizedCourses),
  ]);

  if (existingUser) {
    throw new Error("Email already exists.");
  }

  if (existingTrainerCode) {
    throw new Error("Employee code already exists.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: trainer.userId },
      data: {
        name: normalizedFullName,
        email: normalizedEmail,
        phone: normalizedPhone,
        isActive,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
      },
    });

    const profile = await tx.trainerProfile.update({
      where: { id: input.trainerId },
      data: {
        employeeCode: normalizedEmployeeCode,
        specialization: normalizedSpecialization,
        bio: normalizedBio,
        capacity: input.capacity,
        isActive,
        availabilityStatus: input.availabilityStatus,
        courseAssignments: {
          deleteMany: {},
          create: resolvedCourses.map((course) => ({
            courseId: course.id,
          })),
        },
      },
      select: {
        id: true,
        specialization: true,
        bio: true,
        capacity: true,
        isActive: true,
        availabilityStatus: true,
      },
    });

    return { user, profile };
  });

  return {
    id: updated.profile.id,
    userId: updated.user.id,
    fullName: updated.user.name,
    employeeCode: normalizedEmployeeCode,
    email: updated.user.email,
    phone: updated.user.phone,
    specialization: updated.profile.specialization,
    bio: updated.profile.bio,
    capacity: updated.profile.capacity,
    status: updated.profile.isActive ? "ACTIVE" : "INACTIVE",
    availabilityStatus: updated.profile.availabilityStatus,
    courses: resolvedCourses.map((course) => course.name),
    lastActiveAt: null,
  };
}

export async function updateTrainerStatusService(trainerId: string, status: TrainerStatus): Promise<TrainerOption> {
  const isActive = status === "ACTIVE";

  if (!isDatabaseConfigured) {
    const trainer = MOCK_TRAINERS.find((item) => item.id === trainerId);
    if (!trainer) {
      throw new Error("Trainer not found.");
    }

    return {
      ...trainer,
      isActive,
      availabilityStatus: isActive ? trainer.availabilityStatus : "UNAVAILABLE",
    };
  }

  const trainer = await prisma.trainerProfile.findUnique({
    where: { id: trainerId },
    select: { userId: true },
  });

  if (!trainer) {
    throw new Error("Trainer not found.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const profile = await tx.trainerProfile.update({
      where: { id: trainerId },
      data: {
        isActive,
        ...(isActive ? {} : { availabilityStatus: "UNAVAILABLE" }),
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
            lastLoginAt: true,
          },
        },
        ...trainerCourseAssignmentsInclude,
      },
    });

    await tx.user.update({
      where: { id: trainer.userId },
      data: { isActive },
    });

    return profile;
  });

  return {
    id: updated.id,
    fullName: updated.user.name,
    employeeCode: updated.employeeCode,
    email: updated.user.email,
    specialization: updated.specialization,
    isActive: updated.isActive,
    availabilityStatus: updated.availabilityStatus,
    courses: mapTrainerCourseNames(updated),
    lastActiveAt: updated.user.lastLoginAt?.toISOString() ?? null,
  };
}

export async function updateTrainerCoursesService(trainerId: string, input: UpdateTrainerCoursesInput): Promise<TrainerDetail> {
  const normalizedCourses = normalizeTrainerCourseList(input.courses);

  if (!isDatabaseConfigured) {
    const trainer = MOCK_TRAINERS.find((item) => item.id === trainerId);
    if (!trainer) {
      throw new Error("Trainer not found.");
    }

    return {
      id: trainer.id,
      userId: `mock-user-${trainer.id}`,
      fullName: trainer.fullName,
      employeeCode: trainer.employeeCode,
      email: trainer.email,
      phone: null,
      specialization: trainer.specialization,
      bio: null,
      capacity: 0,
      status: trainer.isActive ? "ACTIVE" : "INACTIVE",
      availabilityStatus: trainer.availabilityStatus,
      courses: normalizedCourses,
      lastActiveAt: trainer.lastActiveAt,
    };
  }

  const trainer = await prisma.trainerProfile.findUnique({
    where: { id: trainerId },
    select: { id: true },
  });

  if (!trainer) {
    throw new Error("Trainer not found.");
  }

  const resolvedCourses = await resolveTrainerSelectedCourses(normalizedCourses);

  const updated = await prisma.trainerProfile.update({
    where: { id: trainerId },
    data: {
      courseAssignments: {
        deleteMany: {},
        create: resolvedCourses.map((course) => ({
          courseId: course.id,
        })),
      },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          lastLoginAt: true,
        },
      },
      ...trainerCourseAssignmentsInclude,
    },
  });

  return {
    id: updated.id,
    userId: updated.user.id,
    fullName: updated.user.name,
    employeeCode: updated.employeeCode,
    email: updated.user.email,
    phone: updated.user.phone,
    specialization: updated.specialization,
    bio: updated.bio,
    capacity: updated.capacity,
    status: updated.isActive ? "ACTIVE" : "INACTIVE",
    availabilityStatus: updated.availabilityStatus,
    courses: mapTrainerCourseNames(updated),
    lastActiveAt: updated.user.lastLoginAt?.toISOString() ?? null,
  };
}

export async function archiveTrainerService(trainerId: string): Promise<TrainerOption> {
  if (!isDatabaseConfigured) {
    const trainer = MOCK_TRAINERS.find((item) => item.id === trainerId);
    if (!trainer) {
      throw new Error("Trainer not found.");
    }

    return {
      ...trainer,
      isActive: false,
      availabilityStatus: "UNAVAILABLE",
    };
  }

  const trainer = await prisma.trainerProfile.findUnique({
    where: { id: trainerId },
    select: { userId: true },
  });

  if (!trainer) {
    throw new Error("Trainer not found.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const profile = await tx.trainerProfile.update({
      where: { id: trainerId },
      data: {
        isActive: false,
        availabilityStatus: "UNAVAILABLE",
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
            lastLoginAt: true,
          },
        },
        ...trainerCourseAssignmentsInclude,
      },
    });

    await tx.user.update({
      where: { id: trainer.userId },
      data: { isActive: false },
    });

    return profile;
  });

  return {
    id: updated.id,
    fullName: updated.user.name,
    employeeCode: updated.employeeCode,
    email: updated.user.email,
    specialization: updated.specialization,
    isActive: updated.isActive,
    availabilityStatus: updated.availabilityStatus,
    courses: mapTrainerCourseNames(updated),
    lastActiveAt: updated.user.lastLoginAt?.toISOString() ?? null,
  };
}
