import "server-only";

import { AuditActionType, AuditEntityType } from "@prisma/client";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { CreateBatchInput, UpdateBatchInput } from "@/lib/validation-schemas/batches";
import { createAuditLogEntry } from "@/services/logs-actions-service";
import { addLearnerEnrollmentService } from "@/services/learners-service";
import { formatMockTrainerNames, mapBatchRecord, normalizeTrainerIds, resolveProgramAndTrainersWithAutoCourseMapping } from "@/services/batches/internal-helpers";
import { MOCK_BATCHES } from "@/services/batches/mock-data";
import { MOCK_CENTERS } from "@/services/centers/mock-data";
import { BatchBulkEnrollmentResult, BatchCreateResult, BatchOption } from "@/services/batches/types";

const BATCH_MUTATION_INCLUDE = {
  centre: {
    select: {
      id: true,
      name: true,
      addressLine1: true,
      addressLine2: true,
      landmark: true,
      postalCode: true,
      location: {
        select: {
          name: true,
          state: {
            select: {
              name: true,
              country: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  },
  program: { select: { name: true } },
  trainer: {
    select: {
      id: true,
      user: { select: { name: true } },
    },
  },
  trainers: {
    select: {
      id: true,
      user: { select: { name: true } },
    },
  },
} as const;

export async function generateBatchCode(programName: string): Promise<string> {
  const prefix = programName.substring(0, 3).toUpperCase();

  if (!isDatabaseConfigured) {
    return `B-${prefix}-001`;
  }

  const lastBatch = await prisma.batch.findFirst({
    where: { code: { startsWith: `B-${prefix}-` } },
    orderBy: { code: "desc" },
    select: { code: true },
  });

  let number = 1;
  if (lastBatch) {
    const match = lastBatch.code.match(/-(\d+)$/);
    number = match ? parseInt(match[1], 10) + 1 : 1;
  }

  return `B-${prefix}-${String(number).padStart(3, "0")}`;
}

export async function createBatchService(input: CreateBatchInput): Promise<BatchCreateResult> {
  const normalizedName = input.name.trim();
  const normalizedProgramName = input.programName.trim();
  const normalizedTrainerIds = normalizeTrainerIds(input.trainerIds);
  const normalizedCentreId = input.centreId.trim() || null;
  const startDate = new Date(input.startDate);
  const endDate = input.endDate.trim() ? new Date(input.endDate) : null;

  let normalizedCode = input.code.trim().toUpperCase();
  if (!normalizedCode || normalizedCode.length === 0) {
    normalizedCode = await generateBatchCode(normalizedProgramName);
  }

  if (Number.isNaN(startDate.getTime())) {
    throw new Error("Invalid start date.");
  }

  if (endDate && Number.isNaN(endDate.getTime())) {
    throw new Error("Invalid end date.");
  }

  const mockCentre = normalizedCentreId ? MOCK_CENTERS.find((center) => center.id === normalizedCentreId && center.isActive) ?? null : null;

  if (input.mode === "OFFLINE" && !normalizedCentreId) {
    throw new Error("A physical center is required for offline batches.");
  }

  if (normalizedCentreId && !isDatabaseConfigured && !mockCentre) {
    throw new Error("Invalid center selection.");
  }

  if (!isDatabaseConfigured) {
    return {
      id: `mock-${Date.now()}`,
      code: normalizedCode,
      name: normalizedName,
      programName: normalizedProgramName,
      centreId: mockCentre?.id ?? null,
      campus: mockCentre?.name ?? null,
      centreAddress: mockCentre?.addressSummary ?? null,
      startDate: startDate.toISOString(),
      endDate: endDate?.toISOString() ?? null,
      capacity: input.capacity,
      mode: input.mode,
      status: input.status,
      trainerIds: normalizedTrainerIds,
      trainerNames: formatMockTrainerNames(normalizedTrainerIds),
    };
  }

  const [existingCode, resolved, centre] = await Promise.all([
    prisma.batch.findUnique({ where: { code: normalizedCode }, select: { id: true } }),
    resolveProgramAndTrainersWithAutoCourseMapping(normalizedProgramName, normalizedTrainerIds),
    normalizedCentreId
      ? prisma.trainingCentre.findFirst({
          where: { id: normalizedCentreId, isActive: true },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
  ]);

  if (existingCode) {
    throw new Error("Batch code already exists.");
  }

  if (normalizedCentreId && !centre) {
    throw new Error("Invalid center selection.");
  }

  if (input.mode === "OFFLINE" && !centre) {
    throw new Error("A physical center is required for offline batches.");
  }

  const normalizedCampus = centre?.name ?? null;

  if (resolved.trainersToAddToCourse.length > 0) {
    await prisma.trainerCourseAssignment.createMany({
      data: resolved.trainersToAddToCourse.map((trainerId) => ({
        trainerId,
        courseId: resolved.courseId,
      })),
      skipDuplicates: true,
    });
  }

  const batch = await prisma.batch.create({
    data: {
      code: normalizedCode,
      name: normalizedName,
      programId: resolved.program.id,
      centreId: centre?.id ?? null,
      campus: normalizedCampus,
      startDate,
      endDate,
      capacity: input.capacity,
      mode: input.mode,
      schedule: input.schedule,
      status: input.status,
      trainerId: resolved.trainerIds[0] ?? null,
      trainers: resolved.trainerIds.length > 0 ? { connect: resolved.trainerIds.map((trainerId) => ({ id: trainerId })) } : undefined,
    },
    include: BATCH_MUTATION_INCLUDE,
  });

  const mapped = mapBatchRecord(batch);

  await createAuditLogEntry({
    entityType: AuditEntityType.BATCH,
    entityId: mapped.id,
    action: AuditActionType.CREATED,
    message: `Batch ${mapped.code} created.`,
    metadata: {
      programName: mapped.programName,
      trainerIds: mapped.trainerIds,
      status: mapped.status,
    },
  });

  return {
    id: mapped.id,
    code: mapped.code,
    name: mapped.name,
    programName: mapped.programName,
    centreId: mapped.centreId,
    campus: mapped.campus,
    centreAddress: mapped.centreAddress,
    startDate: mapped.startDate ?? startDate.toISOString(),
    endDate: mapped.endDate ?? null,
    capacity: mapped.capacity ?? input.capacity,
    mode: mapped.mode ?? input.mode,
    status: mapped.status,
    trainerIds: mapped.trainerIds,
    trainerNames: mapped.trainerNames,
  };
}

export async function updateBatchService(input: UpdateBatchInput): Promise<BatchCreateResult> {
  const normalizedBatchId = input.batchId.trim();
  const normalizedCode = input.code.trim().toUpperCase();
  const normalizedName = input.name.trim();
  const normalizedProgramName = input.programName.trim();
  const normalizedTrainerIds = normalizeTrainerIds(input.trainerIds);
  const normalizedCentreId = input.centreId.trim() || null;
  const startDate = new Date(input.startDate);
  const endDate = input.endDate.trim() ? new Date(input.endDate) : null;

  if (Number.isNaN(startDate.getTime())) {
    throw new Error("Invalid start date.");
  }

  if (endDate && Number.isNaN(endDate.getTime())) {
    throw new Error("Invalid end date.");
  }

  const mockCentre = normalizedCentreId ? MOCK_CENTERS.find((center) => center.id === normalizedCentreId && center.isActive) ?? null : null;

  if (!isDatabaseConfigured) {
    return {
      id: normalizedBatchId,
      code: normalizedCode,
      name: normalizedName,
      programName: normalizedProgramName,
      centreId: mockCentre?.id ?? null,
      campus: mockCentre?.name ?? null,
      centreAddress: mockCentre?.addressSummary ?? null,
      startDate: startDate.toISOString(),
      endDate: endDate?.toISOString() ?? null,
      capacity: input.capacity,
      mode: input.mode,
      status: input.status,
      trainerIds: normalizedTrainerIds,
      trainerNames: formatMockTrainerNames(normalizedTrainerIds),
    };
  }

  const existingBatch = await prisma.batch.findUnique({ where: { id: normalizedBatchId }, select: { id: true } });
  if (!existingBatch) {
    throw new Error("Batch not found.");
  }

  const [duplicateCode, resolved, centre] = await Promise.all([
    prisma.batch.findFirst({ where: { code: normalizedCode, NOT: { id: normalizedBatchId } }, select: { id: true } }),
    resolveProgramAndTrainersWithAutoCourseMapping(normalizedProgramName, normalizedTrainerIds),
    normalizedCentreId
      ? prisma.trainingCentre.findFirst({
          where: { id: normalizedCentreId, isActive: true },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
  ]);

  if (duplicateCode) {
    throw new Error("Batch code already exists.");
  }

  if (normalizedCentreId && !centre) {
    throw new Error("Invalid center selection.");
  }

  if (input.mode === "OFFLINE" && !centre) {
    throw new Error("A physical center is required for offline batches.");
  }

  const normalizedCampus = centre?.name ?? null;

  if (resolved.trainersToAddToCourse.length > 0) {
    await prisma.trainerCourseAssignment.createMany({
      data: resolved.trainersToAddToCourse.map((trainerId) => ({
        trainerId,
        courseId: resolved.courseId,
      })),
      skipDuplicates: true,
    });
  }

  const batch = await prisma.batch.update({
    where: { id: normalizedBatchId },
    data: {
      code: normalizedCode,
      name: normalizedName,
      programId: resolved.program.id,
      centreId: centre?.id ?? null,
      trainerId: resolved.trainerIds[0] ?? null,
      trainers: { set: resolved.trainerIds.map((trainerId) => ({ id: trainerId })) },
      campus: normalizedCampus,
      startDate,
      endDate,
      mode: input.mode,
      status: input.status,
      capacity: input.capacity,
      schedule: input.schedule,
    },
    include: BATCH_MUTATION_INCLUDE,
  });

  const mapped = mapBatchRecord(batch);

  await createAuditLogEntry({
    entityType: AuditEntityType.BATCH,
    entityId: mapped.id,
    action: AuditActionType.UPDATED,
    message: `Batch ${mapped.code} updated.`,
    metadata: {
      programName: mapped.programName,
      trainerIds: mapped.trainerIds,
      status: mapped.status,
    },
  });

  return {
    id: mapped.id,
    code: mapped.code,
    name: mapped.name,
    programName: mapped.programName,
    centreId: mapped.centreId,
    campus: mapped.campus,
    centreAddress: mapped.centreAddress,
    startDate: mapped.startDate ?? startDate.toISOString(),
    endDate: mapped.endDate ?? null,
    capacity: mapped.capacity ?? input.capacity,
    mode: mapped.mode ?? input.mode,
    status: mapped.status,
    trainerIds: mapped.trainerIds,
    trainerNames: mapped.trainerNames,
  };
}

export async function assignTrainerToBatchService(batchId: string, trainerId: string): Promise<BatchCreateResult> {
  const normalizedBatchId = batchId.trim();
  const normalizedTrainerId = normalizeTrainerIds([trainerId])[0];

  if (!normalizedTrainerId) {
    throw new Error("Trainer is required.");
  }

  if (!isDatabaseConfigured) {
    const batch = MOCK_BATCHES.find((item) => item.id === normalizedBatchId);

    if (!batch) {
      throw new Error("Batch not found.");
    }

    const trainerIds = normalizeTrainerIds([...batch.trainerIds, normalizedTrainerId]);

    return {
      ...batch,
      startDate: batch.startDate ?? new Date().toISOString(),
      endDate: batch.endDate ?? null,
      capacity: batch.capacity ?? 25,
      mode: batch.mode ?? "OFFLINE",
      trainerIds,
      trainerNames: formatMockTrainerNames(trainerIds),
    };
  }

  const batch = await prisma.batch.findUnique({
    where: { id: normalizedBatchId },
    select: {
      id: true,
      code: true,
      status: true,
      trainerId: true,
      trainers: {
        select: {
          id: true,
        },
      },
      program: {
        select: {
          name: true,
          course: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!batch) {
    throw new Error("Batch not found.");
  }

  if (batch.status === "ARCHIVED" || batch.status === "CANCELLED" || batch.status === "COMPLETED") {
    throw new Error("Only draft, planned, or in-session batches can accept trainer assignments.");
  }

  const trainer = await prisma.trainerProfile.findFirst({
    where: {
      id: normalizedTrainerId,
      isActive: true,
    },
    select: {
      id: true,
      courseAssignments: {
        select: {
          course: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  if (!trainer) {
    throw new Error("Trainer not found.");
  }

  const existingTrainerIds = new Set<string>([
    ...(batch.trainerId ? [batch.trainerId] : []),
    ...batch.trainers.map((item) => item.id),
  ]);

  if (!existingTrainerIds.has(normalizedTrainerId) && !trainer.courseAssignments.some((assignment) => assignment.course.id === batch.program.course.id)) {
    await prisma.trainerCourseAssignment.createMany({
      data: [{
        trainerId: normalizedTrainerId,
        courseId: batch.program.course.id,
      }],
      skipDuplicates: true,
    });
  }

  const updatedBatch = existingTrainerIds.has(normalizedTrainerId)
    ? await prisma.batch.findUnique({
        where: { id: normalizedBatchId },
        include: BATCH_MUTATION_INCLUDE,
      })
    : await prisma.batch.update({
        where: { id: normalizedBatchId },
        data: {
          trainerId: batch.trainerId ?? normalizedTrainerId,
          trainers: {
            connect: {
              id: normalizedTrainerId,
            },
          },
        },
        include: BATCH_MUTATION_INCLUDE,
      });

  if (!updatedBatch) {
    throw new Error("Batch not found.");
  }

  const mapped = mapBatchRecord(updatedBatch);

  await createAuditLogEntry({
    entityType: AuditEntityType.BATCH,
    entityId: mapped.id,
    action: AuditActionType.UPDATED,
    message: `Trainer assigned to batch ${mapped.code}.`,
    metadata: {
      trainerId: normalizedTrainerId,
      trainerIds: mapped.trainerIds,
      programName: mapped.programName,
    },
  });

  return {
    id: mapped.id,
    code: mapped.code,
    name: mapped.name,
    programName: mapped.programName,
    centreId: mapped.centreId,
    campus: mapped.campus,
    centreAddress: mapped.centreAddress,
    startDate: mapped.startDate ?? new Date().toISOString(),
    endDate: mapped.endDate ?? null,
    capacity: mapped.capacity ?? 25,
    mode: mapped.mode ?? "OFFLINE",
    status: mapped.status,
    trainerIds: mapped.trainerIds,
    trainerNames: mapped.trainerNames,
  };
}

export async function archiveBatchService(batchId: string): Promise<BatchOption> {
  const normalizedBatchId = batchId.trim();

  if (!isDatabaseConfigured) {
    const batch = MOCK_BATCHES.find((item) => item.id === normalizedBatchId);
    if (!batch) {
      throw new Error("Batch not found.");
    }

    return {
      ...batch,
      status: "ARCHIVED",
    };
  }

  const batch = await prisma.batch.update({
    where: { id: normalizedBatchId },
    data: { status: "ARCHIVED" },
    include: BATCH_MUTATION_INCLUDE,
  });

  return mapBatchRecord(batch);
}

type EnrollmentBatchContext = {
  id: string;
  code: string;
  status: BatchOption["status"];
};

async function resolveBatchForEnrollment(batchId: string): Promise<EnrollmentBatchContext> {
  const normalizedBatchId = batchId.trim();

  if (!isDatabaseConfigured) {
    const mockBatch = MOCK_BATCHES.find((batch) => batch.id === normalizedBatchId);

    if (!mockBatch) {
      throw new Error("Batch not found.");
    }

    if (mockBatch.status !== "PLANNED" && mockBatch.status !== "IN_SESSION") {
      throw new Error("Only planned or in-session batches can accept enrollments.");
    }

    return {
      id: mockBatch.id,
      code: mockBatch.code,
      status: mockBatch.status,
    };
  }

  const batch = await prisma.batch.findUnique({
    where: { id: normalizedBatchId },
    select: {
      id: true,
      code: true,
      status: true,
    },
  });

  if (!batch) {
    throw new Error("Batch not found.");
  }

  if (batch.status !== "PLANNED" && batch.status !== "IN_SESSION") {
    throw new Error("Only planned or in-session batches can accept enrollments.");
  }

  return batch;
}

export async function enrollLearnerToBatchService(batchId: string, learnerCode: string) {
  const batch = await resolveBatchForEnrollment(batchId);
  return addLearnerEnrollmentService(learnerCode.trim(), { batchCode: batch.code });
}

export async function bulkEnrollLearnersToBatchService(batchId: string, learnerCodes: string[]): Promise<BatchBulkEnrollmentResult> {
  const batch = await resolveBatchForEnrollment(batchId);
  const uniqueLearnerCodes = Array.from(new Set(learnerCodes.map((code) => code.trim()).filter((code) => code.length > 0)));
  const results: BatchBulkEnrollmentResult["results"] = [];

  let enrolled = 0;
  let skipped = 0;
  let failed = 0;

  for (const learnerCode of uniqueLearnerCodes) {
    try {
      await addLearnerEnrollmentService(learnerCode, { batchCode: batch.code });
      results.push({
        learnerCode,
        status: "ENROLLED",
        message: "Enrolled successfully.",
      });
      enrolled += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Enrollment failed.";

      if (message.toLowerCase().includes("already enrolled")) {
        results.push({
          learnerCode,
          status: "SKIPPED",
          message,
        });
        skipped += 1;
      } else {
        results.push({
          learnerCode,
          status: "FAILED",
          message,
        });
        failed += 1;
      }
    }
  }

  return {
    batchId: batch.id,
    batchCode: batch.code,
    processed: uniqueLearnerCodes.length,
    enrolled,
    skipped,
    failed,
    results,
  };
}
