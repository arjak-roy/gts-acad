import { randomUUID } from "crypto";

import { Prisma } from "@prisma/client";

import { buildPendingAccountActivationMetadata, mergeAccountMetadata } from "@/lib/auth/account-metadata";
import { hashPassword } from "@/lib/auth/password";
import { INTERNAL_USER_WELCOME_CREDENTIALS_EMAIL_TEMPLATE_KEY } from "@/lib/mail-templates/email-template-defaults";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { sendAccountActivationEmail } from "@/services/auth/account-activation";
import { renderEmailTemplateByKeyService } from "@/services/email-templates";
import { deliverLoggedEmail } from "@/services/logs-actions-service";
import { addRoleToUser } from "@/services/rbac-service";
import { getGeneralRuntimeSettings } from "@/services/settings/runtime";
import { mapTrainerCourseNames } from "@/services/trainers/course-assignment-helpers";
import { MOCK_TRAINERS } from "@/services/trainers/mock-data";
import { TrainerCreateResult, TrainerDetail, TrainerOption, TrainerStatus } from "@/services/trainers/types";
import { CreateTrainerInput, UpdateTrainerCoursesInput, UpdateTrainerInput } from "@/lib/validation-schemas/trainers";

function normalizeCourseList(courses: string[]) {
  return Array.from(new Set(courses.map((course) => course.trim()).filter(Boolean)));
}

function normalizeEmployeeCode(employeeCode: string) {
  return employeeCode.trim().toUpperCase();
}

function isUuidLike(value: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value.trim());
}

async function resolveSelectedCourses(courseSelections: string[]) {
  const normalizedSelections = normalizeCourseList(courseSelections);

  if (normalizedSelections.length === 0) {
    return [];
  }

  const matchingCourses = await prisma.course.findMany({
    where: {
      OR: normalizedSelections.flatMap((courseSelection) => {
        const courseFilters: Prisma.CourseWhereInput[] = [
          {
            name: {
              equals: courseSelection,
              mode: "insensitive" as const,
            },
          },
        ];

        if (isUuidLike(courseSelection)) {
          courseFilters.unshift({ id: courseSelection });
        }

        return courseFilters;
      }),
    },
    select: {
      id: true,
      name: true,
    },
  });

  const coursesById = new Map(matchingCourses.map((course) => [course.id, course]));
  const coursesByNormalizedName = new Map(
    matchingCourses.map((course) => [course.name.trim().toLowerCase(), course]),
  );

  const resolvedCourses = normalizedSelections.map((courseSelection) => {
    const resolvedCourse = coursesById.get(courseSelection)
      ?? coursesByNormalizedName.get(courseSelection.trim().toLowerCase());

    if (!resolvedCourse) {
      throw new Error("Invalid course selection.");
    }

    return resolvedCourse;
  });

  return Array.from(new Map(resolvedCourses.map((course) => [course.id, course])).values());
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

function buildInternalLoginUrl(fallbackApplicationUrl?: string | null) {
  const normalizeOrigin = (value: string | undefined) => {
    const normalized = value?.trim();
    if (!normalized) {
      return null;
    }

    if (/^https?:\/\//i.test(normalized)) {
      return normalized.replace(/\/$/, "");
    }

    return `https://${normalized}`.replace(/\/$/, "");
  };

  const resolvedOrigin =
    normalizeOrigin(process.env.INTERNAL_APP_ORIGIN) ??
    normalizeOrigin(process.env.NEXT_PUBLIC_INTERNAL_APP_ORIGIN) ??
    normalizeOrigin(fallbackApplicationUrl ?? undefined) ??
    normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL) ??
    "https://gts-acad.vercel.app";

  return `${resolvedOrigin}/login`;
}

async function sendTrainerWelcomeEmail(input: {
  userId: string;
  recipientEmail: string;
  recipientName: string;
  temporaryPassword: string;
}) {
  const generalSettings = await getGeneralRuntimeSettings();

  const template = await renderEmailTemplateByKeyService(INTERNAL_USER_WELCOME_CREDENTIALS_EMAIL_TEMPLATE_KEY, {
    appName: generalSettings.applicationName,
    recipientName: input.recipientName,
    recipientEmail: input.recipientEmail,
    temporaryPassword: input.temporaryPassword,
    loginUrl: buildInternalLoginUrl(generalSettings.applicationUrl),
    supportEmail: generalSettings.supportEmail,
    roleSummary: "Trainer",
  });

  return deliverLoggedEmail({
    to: input.recipientEmail,
    subject: template.subject,
    text: template.text,
    html: template.html,
    category: "SYSTEM",
    templateKey: INTERNAL_USER_WELCOME_CREDENTIALS_EMAIL_TEMPLATE_KEY,
    audit: {
      entityType: "AUTH",
      entityId: input.userId,
    },
  });
}

export async function createTrainerService(input: CreateTrainerInput): Promise<TrainerCreateResult> {
  const normalizedFullName = input.fullName.trim();
  const normalizedEmployeeCode = normalizeEmployeeCode(input.employeeCode);
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedPhone = input.phone.trim() || null;
  const normalizedSpecialization = input.specialization.trim();
  const normalizedBio = input.bio.trim() || null;
  const normalizedCourses = normalizeCourseList(input.courses);
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

  const [existingUser, existingTrainerCode, resolvedCourses] = await Promise.all([
    prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } }),
    prisma.trainerProfile.findFirst({ where: { employeeCode: normalizedEmployeeCode }, select: { id: true } }),
    resolveSelectedCourses(normalizedCourses),
  ]);

  if (existingUser) {
    throw new Error("Email already exists.");
  }

  if (existingTrainerCode) {
    throw new Error("Employee code already exists.");
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
          createdFrom: "academy-admin",
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

  const trainerRole = await prisma.role.findUnique({ where: { code: "TRAINER" } });
  if (trainerRole) {
    await addRoleToUser(trainer.user.id, trainerRole.id);
  }

  try {
    const delivery = await sendTrainerWelcomeEmail({
      userId: trainer.user.id,
      recipientEmail: trainer.user.email,
      recipientName: trainer.user.name,
      temporaryPassword,
    });

    await prisma.user.update({
      where: { id: trainer.user.id },
      data: {
        metadata: mergeAccountMetadata(trainer.user.metadata, {
          welcomeCredentialsEmailStatus: delivery.status === "SENT" ? "sent" : "pending",
          ...(delivery.status === "SENT" ? { welcomeCredentialsLastSentAt: new Date().toISOString() } : {}),
          welcomeCredentialsFailureReason: null,
        }) as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    console.error("Trainer welcome email dispatch failed", {
      email: trainer.user.email,
      error,
    });

    await prisma.user.update({
      where: { id: trainer.user.id },
      data: {
        metadata: mergeAccountMetadata(trainer.user.metadata, {
          welcomeCredentialsEmailStatus: "failed",
          welcomeCredentialsFailureReason: error instanceof Error ? error.message : "Unknown delivery failure.",
        }) as Prisma.InputJsonValue,
      },
    });
  }

  try {
    await sendAccountActivationEmail(trainer.user.id);
  } catch (error) {
    console.warn("Trainer activation email dispatch failed.", error);
  }

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
  const normalizedEmployeeCode = normalizeEmployeeCode(input.employeeCode);
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedPhone = input.phone.trim() || null;
  const normalizedSpecialization = input.specialization.trim();
  const normalizedBio = input.bio.trim() || null;
  const normalizedCourses = normalizeCourseList(input.courses);
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
    resolveSelectedCourses(normalizedCourses),
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
  const normalizedCourses = normalizeCourseList(input.courses);

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

  const resolvedCourses = await resolveSelectedCourses(normalizedCourses);

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
