import { randomUUID } from "crypto";

import { hashPassword } from "@/lib/auth/password";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { addRoleToUser } from "@/services/rbac-service";
import { MOCK_TRAINERS } from "@/services/trainers/mock-data";
import { TrainerCreateResult, TrainerOption } from "@/services/trainers/types";
import { CreateTrainerInput, UpdateTrainerInput } from "@/lib/validation-schemas/trainers";

function normalizeProgramList(programs: string[]) {
  return Array.from(new Set(programs.map((program) => program.trim()).filter(Boolean)));
}

export async function createTrainerService(input: CreateTrainerInput): Promise<TrainerCreateResult> {
  const normalizedFullName = input.fullName.trim();
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedPhone = input.phone.trim() || null;
  const normalizedSpecialization = input.specialization.trim();
  const normalizedBio = input.bio.trim() || null;
  const normalizedPrograms = normalizeProgramList(input.programs);
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
      programs: normalizedPrograms,
    };
  }

  const [existingUser, matchingPrograms] = await Promise.all([
    prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } }),
    prisma.program.findMany({
      where: {
        OR: normalizedPrograms.map((program) => ({
          name: {
            equals: program,
            mode: "insensitive",
          },
        })),
      },
      select: {
        name: true,
      },
    }),
  ]);

  if (existingUser) {
    throw new Error("Email already exists.");
  }

  if (matchingPrograms.length !== normalizedPrograms.length) {
    throw new Error("Invalid program selection.");
  }

  const resolvedPrograms = matchingPrograms.map((program) => program.name);
  const hashedTemporaryPassword = await hashPassword(randomUUID());

  const trainer = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: normalizedEmail,
        name: normalizedFullName,
        phone: normalizedPhone,
        password: hashedTemporaryPassword,
        isActive,
        metadata: {
          createdFrom: "academy-admin",
          requiresPasswordReset: true,
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
      },
    });

    const profile = await tx.trainerProfile.create({
      data: {
        userId: user.id,
        specialization: normalizedSpecialization,
        bio: normalizedBio,
        capacity: input.capacity,
        isActive,
        programs: resolvedPrograms,
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
    programs: resolvedPrograms,
  };
}

export async function updateTrainerService(input: UpdateTrainerInput): Promise<TrainerCreateResult> {
  const normalizedFullName = input.fullName.trim();
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedPhone = input.phone.trim() || null;
  const normalizedSpecialization = input.specialization.trim();
  const normalizedBio = input.bio.trim() || null;
  const normalizedPrograms = normalizeProgramList(input.programs);
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
      programs: normalizedPrograms,
    };
  }

  const trainer = await prisma.trainerProfile.findUnique({
    where: { id: input.trainerId },
    select: { id: true, userId: true },
  });

  if (!trainer) {
    throw new Error("Trainer not found.");
  }

  const [existingUser, matchingPrograms] = await Promise.all([
    prisma.user.findFirst({
      where: {
        id: { not: trainer.userId },
        email: normalizedEmail,
      },
      select: { id: true },
    }),
    prisma.program.findMany({
      where: {
        OR: normalizedPrograms.map((program) => ({
          name: {
            equals: program,
            mode: "insensitive",
          },
        })),
      },
      select: {
        name: true,
      },
    }),
  ]);

  if (existingUser) {
    throw new Error("Email already exists.");
  }

  if (matchingPrograms.length !== normalizedPrograms.length) {
    throw new Error("Invalid program selection.");
  }

  const resolvedPrograms = matchingPrograms.map((program) => program.name);

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
        programs: resolvedPrograms,
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
    programs: resolvedPrograms,
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
    programs: updated.programs,
  };
}
