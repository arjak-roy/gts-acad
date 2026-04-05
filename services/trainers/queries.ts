import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { MOCK_TRAINERS } from "@/services/trainers/mock-data";
import { TrainerDetail, TrainerOption } from "@/services/trainers/types";

function filterMockByProgram(programName?: string) {
  const normalizedProgramName = programName?.trim();

  return MOCK_TRAINERS.filter((trainer) =>
    normalizedProgramName
      ? trainer.programs.some((program) => program.toLowerCase() === normalizedProgramName.toLowerCase())
      : true,
  );
}

export async function listTrainersService(programName?: string): Promise<TrainerOption[]> {
  const normalizedProgramName = programName?.trim();

  if (!isDatabaseConfigured) {
    return filterMockByProgram(normalizedProgramName);
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
    return filterMockByProgram(normalizedProgramName);
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
    // Branch A - match on name / email / specialization directly
    // Branch B - resolve program names first, then match trainers via hasSome
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
    const trainers = [...branchA, ...branchB]
      .filter((trainer) => {
        if (seen.has(trainer.id)) {
          return false;
        }

        seen.add(trainer.id);
        return true;
      })
      .slice(0, limit);

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

export async function getTrainersForProgramService(programName: string): Promise<TrainerOption[]> {
  const normalizedProgramName = programName.trim();

  if (!isDatabaseConfigured) {
    return MOCK_TRAINERS.filter((trainer) =>
      trainer.programs.some((program) => program.toLowerCase() === normalizedProgramName.toLowerCase()),
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

  return trainers.map((trainer) => ({
    id: trainer.id,
    fullName: trainer.user.name,
    email: trainer.user.email,
    specialization: trainer.specialization,
    isActive: trainer.isActive,
    programs: trainer.programs,
  }));
}
