import "server-only";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { MOCK_BATCHES } from "@/services/batches/mock-data";
import { MOCK_PROGRAMS } from "@/services/programs/mock-data";
import { ProgramType } from "@/types";

export type DashboardBatchFilterOption = {
  id: string;
  code: string;
  name: string;
  courseId: string | null;
  programId: string | null;
  programType: ProgramType | null;
  programName: string;
  status: string;
};

function buildDashboardBatchFilterFallback(filters?: {
  programType?: ProgramType;
  courseId?: string;
  programId?: string;
}): DashboardBatchFilterOption[] {
  return MOCK_BATCHES
    .map((batch) => {
      const program = MOCK_PROGRAMS.find((item) => item.name === batch.programName) ?? null;

      return {
        id: batch.id,
        code: batch.code,
        name: batch.name,
        courseId: program?.courseId ?? null,
        programId: program?.id ?? null,
        programType: program?.type ?? null,
        programName: batch.programName,
        status: batch.status,
      };
    })
    .filter((batch) => {
      if (filters?.programId) {
        return batch.programId === filters.programId;
      }

      if (filters?.courseId) {
        return batch.courseId === filters.courseId;
      }

      if (filters?.programType) {
        return batch.programType === filters.programType;
      }

      return true;
    });
}

export async function listDashboardBatchOptionsService(filters?: {
  programType?: ProgramType;
  courseId?: string;
  programId?: string;
}): Promise<DashboardBatchFilterOption[]> {
  if (!isDatabaseConfigured) {
    return buildDashboardBatchFilterFallback(filters);
  }

  try {
    const batches = await prisma.batch.findMany({
      where: filters?.programId
        ? {
            programId: filters.programId,
          }
        : filters?.courseId
          ? {
              program: {
                ...(filters.programType ? { type: filters.programType } : {}),
                courseId: filters.courseId,
              },
            }
          : filters?.programType
            ? {
                program: {
                  type: filters.programType,
                },
              }
          : undefined,
      orderBy: [{ startDate: "desc" }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        program: {
          select: {
            id: true,
            name: true,
            courseId: true,
            type: true,
          },
        },
      },
    });

    return batches.map((batch) => ({
      id: batch.id,
      code: batch.code,
      name: batch.name,
      courseId: batch.program.courseId,
      programId: batch.program.id,
      programType: batch.program.type,
      programName: batch.program.name,
      status: batch.status,
    }));
  } catch (error) {
    console.warn("Dashboard batch filter fallback activated", error);
    return buildDashboardBatchFilterFallback(filters);
  }
}