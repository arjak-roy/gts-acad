import "server-only";

import { randomUUID } from "crypto";

import { hashPassword } from "@/lib/auth/password";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { addRoleToUser } from "@/services/rbac-service";
import { CreateTrainerInput, UpdateTrainerInput } from "@/lib/validation-schemas/trainers";

export type TrainerOption = {
  id: string;
  fullName: string;
  email: string;
  specialization: string;
  isActive: boolean;
  programs: string[];
};

export type TrainerCreateResult = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  specialization: string;
  bio: string | null;
  capacity: number;
  status: "ACTIVE" | "INACTIVE";
  programs: string[];
};

export type TrainerDetail = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  specialization: string;
  bio: string | null;
  capacity: number;
  status: "ACTIVE" | "INACTIVE";
  programs: string[];
};

const MOCK_TRAINERS: TrainerOption[] = [
  {
    id: "mock-trainer-1",
    fullName: "Dr. Markus Stein",
    email: "markus.trainer@gts-academy.test",
    specialization: "German Language",
    isActive: true,
    programs: ["German Language B1", "German Language B2"],
  },
];

export async function listTrainersService(programName?: string): Promise<TrainerOption[]> {
  const normalizedProgramName = programName?.trim();

  if (!isDatabaseConfigured) {
    return MOCK_TRAINERS.filter((trainer) =>
      normalizedProgramName
        ? trainer.programs.some((program) => program.toLowerCase() === normalizedProgramName.toLowerCase())
        : true,
    );
  }

  try {
    const trainers = await prisma.trainerProfile.findMany({
      where: normalizedProgramName
        ? {
            programs: {
              has: normalizedProgramName,
            },
          }
        : undefined,
      orderBy: [{ isActive: "desc" }, { joinedAt: "desc" }],
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return trainers.map((trainer) => ({
      id: trainer.id,
      fullName: trainer.user.name,
      email: trainer.user.email,
      specialization: trainer.specialization,
      isActive: trainer.isActive,
      programs: trainer.programs,
    }));
  } catch (error) {
    console.warn("Trainer list fallback activated", error);
    return MOCK_TRAINERS.filter((trainer) =>
      normalizedProgramName
        ? trainer.programs.some((program) => program.toLowerCase() === normalizedProgramName.toLowerCase())
        : true,
    );
  }
}

export async function searchTrainersService(query: string, limit: number): Promise<TrainerOption[]> {
  const normalizedQuery = query.trim().toLowerCase();

  if (!isDatabaseConfigured) {
    return MOCK_TRAINERS.filter(
      (trainer) =>
        trainer.fullName.toLowerCase().includes(normalizedQuery) ||
        trainer.email.toLowerCase().includes(normalizedQuery) ||
        trainer.specialization.toLowerCase().includes(normalizedQuery) ||
        trainer.programs.some((program) => program.toLowerCase().includes(normalizedQuery)),
    ).slice(0, limit);
  }

  try {
    // Run two branches in parallel:
    // Branch A — match on name / email / specialization directly
    // Branch B — resolve program names first, then match trainers via hasSome
    const trainerSelect = {
      include: { user: { select: { name: true, email: true } } },
      orderBy: [{ isActive: "desc" as const }, { joinedAt: "desc" as const }],
      take: limit,
    };

    const [branchA, matchingPrograms] = await Promise.all([
      prisma.trainerProfile.findMany({
        where: {
          OR: [
            { user: { name: { contains: query, mode: "insensitive" } } },
            { user: { email: { contains: query, mode: "insensitive" } } },
            { specialization: { contains: query, mode: "insensitive" } },
          ],
        },
        ...trainerSelect,
      }),
      prisma.program.findMany({
        where: { name: { contains: query, mode: "insensitive" } },
        select: { name: true },
        take: 20,
      }),
    ]);

    const branchB =
      matchingPrograms.length > 0
        ? await prisma.trainerProfile.findMany({
            where: { programs: { hasSome: matchingPrograms.map((p) => p.name) } },
            ...trainerSelect,
          })
        : [];

    // Deduplicate by id, preserving Branch A ordering first
    const seen = new Set<string>();
    const trainers = [...branchA, ...branchB].filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    }).slice(0, limit);

    return trainers.map((trainer) => ({
      id: trainer.id,
      fullName: trainer.user.name,
      email: trainer.user.email,
      specialization: trainer.specialization,
      isActive: trainer.isActive,
      programs: trainer.programs,
    }));
  } catch (error) {
    console.warn("Trainer search fallback activated", error);
    return MOCK_TRAINERS.filter(
      (trainer) =>
        trainer.fullName.toLowerCase().includes(normalizedQuery) ||
        trainer.email.toLowerCase().includes(normalizedQuery) ||
        trainer.specialization.toLowerCase().includes(normalizedQuery) ||
        trainer.programs.some((program) => program.toLowerCase().includes(normalizedQuery)),
    ).slice(0, limit);
  }
}

export async function createTrainerService(input: CreateTrainerInput): Promise<TrainerCreateResult> {
  const normalizedFullName = input.fullName.trim();
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedPhone = input.phone.trim() || null;
  const normalizedSpecialization = input.specialization.trim();
  const normalizedBio = input.bio.trim() || null;
  const normalizedPrograms = Array.from(new Set(input.programs.map((program) => program.trim()).filter(Boolean)));
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

export async function getTrainerByIdService(trainerId: string): Promise<TrainerDetail | null> {
  if (!isDatabaseConfigured) {
    const trainer = MOCK_TRAINERS.find((item) => item.id === trainerId);
    if (!trainer) {
      return null;
    }

    return {
      id: trainer.id,
      userId: `mock-user-${trainer.id}`,
      fullName: trainer.fullName,
      email: trainer.email,
      phone: null,
      specialization: trainer.specialization,
      bio: null,
      capacity: 0,
      status: trainer.isActive ? "ACTIVE" : "INACTIVE",
      programs: trainer.programs,
    };
  }

  const trainer = await prisma.trainerProfile.findUnique({
    where: { id: trainerId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  if (!trainer) {
    return null;
  }

  return {
    id: trainer.id,
    userId: trainer.user.id,
    fullName: trainer.user.name,
    email: trainer.user.email,
    phone: trainer.user.phone,
    specialization: trainer.specialization,
    bio: trainer.bio,
    capacity: trainer.capacity,
    status: trainer.isActive ? "ACTIVE" : "INACTIVE",
    programs: trainer.programs,
  };
}

export async function updateTrainerService(input: UpdateTrainerInput): Promise<TrainerCreateResult> {
  const normalizedFullName = input.fullName.trim();
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedPhone = input.phone.trim() || null;
  const normalizedSpecialization = input.specialization.trim();
  const normalizedBio = input.bio.trim() || null;
  const normalizedPrograms = Array.from(new Set(input.programs.map((program) => program.trim()).filter(Boolean)));
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

export async function getTrainersForProgramService(programName: string): Promise<TrainerOption[]> {
  const normalizedProgramName = programName.trim();

  if (!isDatabaseConfigured) {
    return MOCK_TRAINERS.filter((t) =>
      t.programs.some((p) => p.toLowerCase() === normalizedProgramName.toLowerCase()),
    );
  }

  const trainers = await prisma.trainerProfile.findMany({
    where: {
      isActive: true,
      programs: {
        has: normalizedProgramName,
      },
    },
    include: { user: { select: { name: true, email: true } } },
  });

  return trainers.map((t) => ({
    id: t.id,
    fullName: t.user.name,
    email: t.user.email,
    specialization: t.specialization,
    isActive: t.isActive,
    programs: t.programs,
  }));
}