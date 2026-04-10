import "server-only";

import { BatchMode } from "@prisma/client";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";

export type BatchCourseContext = {
  batchId: string;
  batchCode: string;
  batchName: string;
  batchMode: BatchMode;
  programId: string;
  programName: string;
  courseId: string;
  courseCode: string;
  courseName: string;
};

export async function getBatchCourseContext(batchId: string): Promise<BatchCourseContext | null> {
  if (!isDatabaseConfigured) {
    return null;
  }

  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      code: true,
      name: true,
      mode: true,
      programId: true,
      program: {
        select: {
          name: true,
          courseId: true,
          course: {
            select: {
              code: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!batch) {
    return null;
  }

  return {
    batchId: batch.id,
    batchCode: batch.code,
    batchName: batch.name,
    batchMode: batch.mode,
    programId: batch.programId,
    programName: batch.program.name,
    courseId: batch.program.courseId,
    courseCode: batch.program.course.code,
    courseName: batch.program.course.name,
  };
}

export async function listCourseIdsForBatchIds(batchIds: string[]): Promise<string[]> {
  if (!isDatabaseConfigured || batchIds.length === 0) {
    return [];
  }

  const batches = await prisma.batch.findMany({
    where: {
      id: {
        in: batchIds,
      },
    },
    select: {
      program: {
        select: {
          courseId: true,
        },
      },
    },
  });

  return Array.from(new Set(batches.map((batch) => batch.program.courseId)));
}