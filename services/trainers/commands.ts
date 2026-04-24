import { randomUUID } from "crypto";

import { Prisma, TrainerProfileStatus } from "@prisma/client";

import { buildPendingAccountActivationMetadata } from "@/lib/auth/account-metadata";
import { hashPassword } from "@/lib/auth/password";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { TRAINER_ROLE_CODE } from "@/lib/users/constants";
import { getStoredUploadAssetUrl } from "@/services/file-upload";
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

function resolveTrainerPhotoUrl(value: string | null) {
  if (!value) {
    return null;
  }

  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) {
    return value;
  }

  const storageProvider = value.startsWith("candidate-profile-photos/") ? "S3" : "LOCAL_PUBLIC";
  return getStoredUploadAssetUrl({ storageProvider, storagePath: value });
}

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
  const normalizedDepartment = input.department?.trim() || null;
  const normalizedJobTitle = input.jobTitle?.trim() || null;
  const normalizedSpecialization = input.specialization.trim();
  const normalizedBio = input.bio.trim() || null;
  const normalizedPreferredLanguage = input.preferredLanguage?.trim() || null;
  const normalizedTimeZone = input.timeZone?.trim() || null;
  const normalizedCourses = normalizeTrainerCourseList(input.courses);
  const isActive = input.status !== "INACTIVE" && input.status !== "SUSPENDED";
  const trainerStatus = (input.status ?? "ACTIVE") as TrainerProfileStatus;

  if (!isDatabaseConfigured) {
    const mockId = `mock-${Date.now()}`;
    return {
      id: mockId,
      userId: `mock-user-${Date.now()}`,
      fullName: normalizedFullName,
      employeeCode: normalizedEmployeeCode,
      email: normalizedEmail,
      phone: normalizedPhone,
      department: normalizedDepartment,
      jobTitle: normalizedJobTitle,
      specialization: normalizedSpecialization,
      skills: input.skills ?? [],
      certifications: input.certifications ?? [],
      experienceYears: input.experienceYears ?? null,
      preferredLanguage: normalizedPreferredLanguage,
      timeZone: normalizedTimeZone,
      profilePhotoUrl: null,
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
        department: normalizedDepartment,
        jobTitle: normalizedJobTitle,
        specialization: normalizedSpecialization,
        bio: normalizedBio,
        skills: input.skills ?? [],
        certifications: input.certifications ?? [],
        experienceYears: input.experienceYears ?? null,
        preferredLanguage: normalizedPreferredLanguage,
        timeZone: normalizedTimeZone,
        capacity: input.capacity,
        isActive,
        trainerStatus,
        availabilityStatus: input.availabilityStatus,
        courseAssignments: {
          create: resolvedCourses.map((course) => ({
            courseId: course.id,
          })),
        },
      },
      select: {
        id: true,
        department: true,
        jobTitle: true,
        specialization: true,
        bio: true,
        skills: true,
        certifications: true,
        experienceYears: true,
        preferredLanguage: true,
        timeZone: true,
        profilePhotoUrl: true,
        capacity: true,
        isActive: true,
        trainerStatus: true,
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
    department: trainer.profile.department,
    jobTitle: trainer.profile.jobTitle,
    specialization: trainer.profile.specialization,
    skills: trainer.profile.skills,
    certifications: trainer.profile.certifications,
    experienceYears: trainer.profile.experienceYears,
    preferredLanguage: trainer.profile.preferredLanguage,
    timeZone: trainer.profile.timeZone,
    profilePhotoUrl: resolveTrainerPhotoUrl(trainer.profile.profilePhotoUrl),
    bio: trainer.profile.bio,
    capacity: trainer.profile.capacity,
    status: trainer.profile.trainerStatus as TrainerStatus,
    availabilityStatus: trainer.profile.availabilityStatus,
    courses: resolvedCourses.map((course) => course.name),
    lastActiveAt: null,
  };
}

export async function updateTrainerService(
  input: UpdateTrainerInput,
  actor: { actorUserId?: string | null } = {},
): Promise<TrainerCreateResult> {
  const normalizedFullName = input.fullName.trim();
  const normalizedEmployeeCode = normalizeTrainerEmployeeCode(input.employeeCode);
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedPhone = input.phone.trim() || null;
  const normalizedDepartment = input.department?.trim() || null;
  const normalizedJobTitle = input.jobTitle?.trim() || null;
  const normalizedSpecialization = input.specialization.trim();
  const normalizedBio = input.bio.trim() || null;
  const normalizedPreferredLanguage = input.preferredLanguage?.trim() || null;
  const normalizedTimeZone = input.timeZone?.trim() || null;
  const normalizedCourses = normalizeTrainerCourseList(input.courses);
  const isActive = input.status !== "INACTIVE" && input.status !== "SUSPENDED";
  const trainerStatus = (input.status ?? "ACTIVE") as TrainerProfileStatus;

  if (!isDatabaseConfigured) {
    return {
      id: input.trainerId,
      userId: `mock-user-${input.trainerId}`,
      fullName: normalizedFullName,
      employeeCode: normalizedEmployeeCode,
      email: normalizedEmail,
      phone: normalizedPhone,
      department: normalizedDepartment,
      jobTitle: normalizedJobTitle,
      specialization: normalizedSpecialization,
      skills: input.skills ?? [],
      certifications: input.certifications ?? [],
      experienceYears: input.experienceYears ?? null,
      preferredLanguage: normalizedPreferredLanguage,
      timeZone: normalizedTimeZone,
      profilePhotoUrl: null,
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
        department: normalizedDepartment,
        jobTitle: normalizedJobTitle,
        specialization: normalizedSpecialization,
        bio: normalizedBio,
        skills: input.skills ?? [],
        certifications: input.certifications ?? [],
        experienceYears: input.experienceYears ?? null,
        preferredLanguage: normalizedPreferredLanguage,
        timeZone: normalizedTimeZone,
        capacity: input.capacity,
        isActive,
        trainerStatus,
        availabilityStatus: input.availabilityStatus,
        updatedById: actor.actorUserId ?? null,
        courseAssignments: {
          deleteMany: {},
          create: resolvedCourses.map((course) => ({
            courseId: course.id,
          })),
        },
      },
      select: {
        id: true,
        department: true,
        jobTitle: true,
        specialization: true,
        bio: true,
        skills: true,
        certifications: true,
        experienceYears: true,
        preferredLanguage: true,
        timeZone: true,
        profilePhotoUrl: true,
        capacity: true,
        isActive: true,
        trainerStatus: true,
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
    department: updated.profile.department,
    jobTitle: updated.profile.jobTitle,
    specialization: updated.profile.specialization,
    skills: updated.profile.skills,
    certifications: updated.profile.certifications,
    experienceYears: updated.profile.experienceYears,
    preferredLanguage: updated.profile.preferredLanguage,
    timeZone: updated.profile.timeZone,
    profilePhotoUrl: resolveTrainerPhotoUrl(updated.profile.profilePhotoUrl),
    bio: updated.profile.bio,
    capacity: updated.profile.capacity,
    status: updated.profile.trainerStatus as TrainerStatus,
    availabilityStatus: updated.profile.availabilityStatus,
    courses: resolvedCourses.map((course) => course.name),
    lastActiveAt: null,
  };
}

export async function updateTrainerStatusService(
  trainerId: string,
  status: TrainerStatus,
  reason?: string,
  actorUserId?: string | null,
): Promise<TrainerOption> {
  const isActive = status === "ACTIVE";
  const newTrainerStatus = status as TrainerProfileStatus;

  if (!isDatabaseConfigured) {
    const trainer = MOCK_TRAINERS.find((item) => item.id === trainerId);
    if (!trainer) {
      throw new Error("Trainer not found.");
    }

    return {
      ...trainer,
      isActive,
      trainerStatus: status,
      availabilityStatus: isActive ? trainer.availabilityStatus : "UNAVAILABLE",
    };
  }

  const trainer = await prisma.trainerProfile.findUnique({
    where: { id: trainerId },
    select: { userId: true, trainerStatus: true },
  });

  if (!trainer) {
    throw new Error("Trainer not found.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const profile = await tx.trainerProfile.update({
      where: { id: trainerId },
      data: {
        isActive,
        trainerStatus: newTrainerStatus,
        updatedById: actorUserId ?? null,
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

    if (trainer.trainerStatus !== newTrainerStatus) {
      await tx.trainerStatusHistory.create({
        data: {
          trainerId,
          oldStatus: trainer.trainerStatus,
          newStatus: newTrainerStatus,
          reason: reason?.trim() || null,
          changedById: actorUserId ?? null,
        },
      });
    }

    return profile;
  });

  return {
    id: updated.id,
    fullName: updated.user.name,
    employeeCode: updated.employeeCode,
    email: updated.user.email,
    department: null,
    specialization: updated.specialization,
    isActive: updated.isActive,
    trainerStatus: updated.trainerStatus as TrainerStatus,
    availabilityStatus: updated.availabilityStatus,
    courses: mapTrainerCourseNames(updated),
    lastActiveAt: updated.user.lastLoginAt?.toISOString() ?? null,
    lastUpdatedAt: updated.user.lastLoginAt?.toISOString() ?? null,
    lastUpdatedByName: null,
  };
}

export async function updateTrainerCoursesService(
  trainerId: string,
  input: UpdateTrainerCoursesInput,
  actorUserId?: string | null,
): Promise<TrainerDetail> {
  const normalizedCourses = normalizeTrainerCourseList(input.courses);

  if (!isDatabaseConfigured) {
    const trainer = MOCK_TRAINERS.find((item) => item.id === trainerId);
    if (!trainer) {
      throw new Error("Trainer not found.");
    }

    if (!trainer.isActive && normalizedCourses.length > 0) {
      throw new Error("Inactive trainers cannot be assigned to courses.");
    }

    return {
      id: trainer.id,
      userId: `mock-user-${trainer.id}`,
      fullName: trainer.fullName,
      employeeCode: trainer.employeeCode,
      email: trainer.email,
      phone: null,
      department: null,
      jobTitle: null,
      specialization: trainer.specialization,
      skills: [],
      certifications: [],
      experienceYears: null,
      preferredLanguage: null,
      timeZone: null,
      profilePhotoUrl: null,
      bio: null,
      capacity: 0,
      status: trainer.isActive ? "ACTIVE" : "INACTIVE",
      availabilityStatus: trainer.availabilityStatus,
      courses: normalizedCourses,
      lastActiveAt: trainer.lastActiveAt,
      lastUpdatedAt: trainer.lastUpdatedAt,
      lastUpdatedByName: trainer.lastUpdatedByName,
    };
  }

  const trainer = await prisma.trainerProfile.findUnique({
    where: { id: trainerId },
    select: {
      id: true,
      isActive: true,
      capacity: true,
    },
  });

  if (!trainer) {
    throw new Error("Trainer not found.");
  }

  if (!trainer.isActive && normalizedCourses.length > 0) {
    throw new Error("Inactive trainers cannot be assigned to courses.");
  }

  if (trainer.capacity > 0 && normalizedCourses.length > trainer.capacity) {
    throw new Error(`Trainer capacity exceeded. Maximum allowed assignments: ${trainer.capacity}.`);
  }

  const resolvedCourses = await resolveTrainerSelectedCourses(normalizedCourses);

  const updated = await prisma.trainerProfile.update({
    where: { id: trainerId },
    data: {
      updatedById: actorUserId ?? null,
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
    department: null,
    jobTitle: null,
    specialization: updated.specialization,
    skills: [],
    certifications: [],
    experienceYears: null,
    preferredLanguage: null,
    timeZone: null,
    profilePhotoUrl: null,
    bio: updated.bio,
    capacity: updated.capacity,
    status: updated.isActive ? "ACTIVE" : "INACTIVE",
    availabilityStatus: updated.availabilityStatus,
    courses: mapTrainerCourseNames(updated),
    lastActiveAt: updated.user.lastLoginAt?.toISOString() ?? null,
    lastUpdatedAt: updated.user.lastLoginAt?.toISOString() ?? null,
    lastUpdatedByName: null,
  };
}

export async function archiveTrainerService(
  trainerId: string,
  actor: { actorUserId?: string | null } = {},
): Promise<TrainerOption> {
  if (!isDatabaseConfigured) {
    const trainer = MOCK_TRAINERS.find((item) => item.id === trainerId);
    if (!trainer) {
      throw new Error("Trainer not found.");
    }

    return {
      ...trainer,
      isActive: false,
      trainerStatus: "INACTIVE",
      availabilityStatus: "UNAVAILABLE",
      lastUpdatedAt: new Date().toISOString(),
      lastUpdatedByName: null,
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
        trainerStatus: "INACTIVE" as TrainerProfileStatus,
        availabilityStatus: "UNAVAILABLE",
        updatedById: actor.actorUserId ?? null,
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
    department: null,
    specialization: updated.specialization,
    isActive: updated.isActive,
    trainerStatus: updated.trainerStatus as TrainerStatus,
    availabilityStatus: updated.availabilityStatus,
    courses: mapTrainerCourseNames(updated),
    lastActiveAt: updated.user.lastLoginAt?.toISOString() ?? null,
    lastUpdatedAt: updated.user.lastLoginAt?.toISOString() ?? null,
    lastUpdatedByName: null,
  };
}

export async function updateTrainerProfilePhotoService(
  trainerId: string,
  profilePhotoUrl: string | null,
  actorUserId?: string | null,
): Promise<{ trainerId: string; profilePhotoUrl: string | null }> {
  if (!isDatabaseConfigured) {
    const trainer = MOCK_TRAINERS.find((item) => item.id === trainerId);
    if (!trainer) {
      throw new Error("Trainer not found.");
    }

    return {
      trainerId,
      profilePhotoUrl,
    };
  }

  const trainer = await prisma.trainerProfile.findUnique({
    where: { id: trainerId },
    select: { id: true },
  });

  if (!trainer) {
    throw new Error("Trainer not found.");
  }

  const updated = await prisma.trainerProfile.update({
    where: { id: trainerId },
    data: {
      profilePhotoUrl,
      updatedById: actorUserId ?? null,
    },
    select: {
      id: true,
      profilePhotoUrl: true,
    },
  });

  return {
    trainerId: updated.id,
    profilePhotoUrl: updated.profilePhotoUrl,
  };
}
