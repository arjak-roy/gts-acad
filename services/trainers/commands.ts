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
import { MOCK_TRAINERS } from "@/services/trainers/mock-data";
import { TrainerCreateResult, TrainerOption } from "@/services/trainers/types";
import { CreateTrainerInput, UpdateTrainerInput } from "@/lib/validation-schemas/trainers";

function normalizeCourseList(courses: string[]) {
  return Array.from(new Set(courses.map((course) => course.trim()).filter(Boolean)));
}

function isUuidLike(value: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value.trim());
}

async function resolveSelectedCourseNames(courseSelections: string[]) {
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

  const courseNamesById = new Map(matchingCourses.map((course) => [course.id, course.name]));
  const courseNamesByNormalizedName = new Map(
    matchingCourses.map((course) => [course.name.trim().toLowerCase(), course.name]),
  );

  const resolvedCourses = normalizedSelections.map((courseSelection) => {
    const resolvedCourse = courseNamesById.get(courseSelection)
      ?? courseNamesByNormalizedName.get(courseSelection.trim().toLowerCase());

    if (!resolvedCourse) {
      throw new Error("Invalid course selection.");
    }

    return resolvedCourse;
  });

  return Array.from(new Set(resolvedCourses));
}

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

  await deliverLoggedEmail({
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
      email: normalizedEmail,
      phone: normalizedPhone,
      specialization: normalizedSpecialization,
      bio: normalizedBio,
      capacity: input.capacity,
      status: input.status,
      courses: normalizedCourses,
    };
  }

  const [existingUser, resolvedCourses] = await Promise.all([
    prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } }),
    resolveSelectedCourseNames(normalizedCourses),
  ]);

  if (existingUser) {
    throw new Error("Email already exists.");
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
        specialization: normalizedSpecialization,
        bio: normalizedBio,
        capacity: input.capacity,
        isActive,
        courses: resolvedCourses,
      },
      select: {
        id: true,
        specialization: true,
        bio: true,
        capacity: true,
        isActive: true,
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
    await sendTrainerWelcomeEmail({
      userId: trainer.user.id,
      recipientEmail: trainer.user.email,
      recipientName: trainer.user.name,
      temporaryPassword,
    });

    await prisma.user.update({
      where: { id: trainer.user.id },
      data: {
        metadata: mergeAccountMetadata(trainer.user.metadata, {
          welcomeCredentialsEmailStatus: "sent",
          welcomeCredentialsLastSentAt: new Date().toISOString(),
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
    email: trainer.user.email,
    phone: trainer.user.phone,
    specialization: trainer.profile.specialization,
    bio: trainer.profile.bio,
    capacity: trainer.profile.capacity,
    status: trainer.profile.isActive ? "ACTIVE" : "INACTIVE",
    courses: resolvedCourses,
  };
}

export async function updateTrainerService(input: UpdateTrainerInput): Promise<TrainerCreateResult> {
  const normalizedFullName = input.fullName.trim();
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
      email: normalizedEmail,
      phone: normalizedPhone,
      specialization: normalizedSpecialization,
      bio: normalizedBio,
      capacity: input.capacity,
      status: input.status,
      courses: normalizedCourses,
    };
  }

  const trainer = await prisma.trainerProfile.findUnique({
    where: { id: input.trainerId },
    select: { id: true, userId: true },
  });

  if (!trainer) {
    throw new Error("Trainer not found.");
  }

  const [existingUser, resolvedCourses] = await Promise.all([
    prisma.user.findFirst({
      where: {
        id: { not: trainer.userId },
        email: normalizedEmail,
      },
      select: { id: true },
    }),
    resolveSelectedCourseNames(normalizedCourses),
  ]);

  if (existingUser) {
    throw new Error("Email already exists.");
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
        specialization: normalizedSpecialization,
        bio: normalizedBio,
        capacity: input.capacity,
        isActive,
        courses: resolvedCourses,
      },
      select: {
        id: true,
        specialization: true,
        bio: true,
        capacity: true,
        isActive: true,
      },
    });

    return { user, profile };
  });

  return {
    id: updated.profile.id,
    userId: updated.user.id,
    fullName: updated.user.name,
    email: updated.user.email,
    phone: updated.user.phone,
    specialization: updated.profile.specialization,
    bio: updated.profile.bio,
    capacity: updated.profile.capacity,
    status: updated.profile.isActive ? "ACTIVE" : "INACTIVE",
    courses: resolvedCourses,
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
      data: { isActive: false },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
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
    email: updated.user.email,
    specialization: updated.specialization,
    isActive: updated.isActive,
    courses: updated.courses,
  };
}
