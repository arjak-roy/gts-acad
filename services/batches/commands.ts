import "server-only";

import { AuditActionType, AuditEntityType } from "@prisma/client";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { CreateBatchInput, UpdateBatchInput } from "@/lib/validation-schemas/batches";
import { createAuditLogEntry } from "@/services/logs-actions-service";
import { formatMockTrainerNames, mapBatchRecord, normalizeTrainerIds, resolveProgramAndTrainersWithAutoMapping } from "@/services/batches/internal-helpers";
import { MOCK_BATCHES } from "@/services/batches/mock-data";
import { BatchCreateResult, BatchOption } from "@/services/batches/types";

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
  const normalizedCampus = input.campus.trim() || null;
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

  if (!isDatabaseConfigured) {
    return {
      id: `mock-${Date.now()}`,
      code: normalizedCode,
      name: normalizedName,
      programName: normalizedProgramName,
      campus: normalizedCampus,
      startDate: startDate.toISOString(),
      endDate: endDate?.toISOString() ?? null,
      capacity: input.capacity,
      mode: input.mode,
      status: input.status,
      trainerIds: normalizedTrainerIds,
      trainerNames: formatMockTrainerNames(normalizedTrainerIds),
    };
  }

  const [existingCode, resolved] = await Promise.all([
    prisma.batch.findUnique({ where: { code: normalizedCode }, select: { id: true } }),
    resolveProgramAndTrainersWithAutoMapping(normalizedProgramName, normalizedTrainerIds),
  ]);

  if (existingCode) {
    throw new Error("Batch code already exists.");
  }

  if (resolved.trainersToAddToProgram.length > 0) {
    await Promise.all(
      resolved.trainersToAddToProgram.map((trainerId) =>
        prisma.trainerProfile.update({
          where: { id: trainerId },
          data: {
            programs: {
              push: normalizedProgramName,
            },
          },
        }),
      ),
    );
  }

  const batch = await prisma.batch.create({
    data: {
      code: normalizedCode,
      name: normalizedName,
      programId: resolved.program.id,
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
    include: {
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
    },
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
    campus: mapped.campus,
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
  const normalizedCampus = input.campus.trim() || null;
  const startDate = new Date(input.startDate);
  const endDate = input.endDate.trim() ? new Date(input.endDate) : null;

  if (Number.isNaN(startDate.getTime())) {
    throw new Error("Invalid start date.");
  }

  if (endDate && Number.isNaN(endDate.getTime())) {
    throw new Error("Invalid end date.");
  }

  if (!isDatabaseConfigured) {
    return {
      id: normalizedBatchId,
      code: normalizedCode,
      name: normalizedName,
      programName: normalizedProgramName,
      campus: normalizedCampus,
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

  const [duplicateCode, resolved] = await Promise.all([
    prisma.batch.findFirst({ where: { code: normalizedCode, NOT: { id: normalizedBatchId } }, select: { id: true } }),
    resolveProgramAndTrainersWithAutoMapping(normalizedProgramName, normalizedTrainerIds),
  ]);

  if (duplicateCode) {
    throw new Error("Batch code already exists.");
  }

  if (resolved.trainersToAddToProgram.length > 0) {
    await Promise.all(
      resolved.trainersToAddToProgram.map((trainerId) =>
        prisma.trainerProfile.update({
          where: { id: trainerId },
          data: {
            programs: {
              push: normalizedProgramName,
            },
          },
        }),
      ),
    );
  }

  const batch = await prisma.batch.update({
    where: { id: normalizedBatchId },
    data: {
      code: normalizedCode,
      name: normalizedName,
      programId: resolved.program.id,
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
    include: {
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
    },
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
    campus: mapped.campus,
    startDate: mapped.startDate ?? startDate.toISOString(),
    endDate: mapped.endDate ?? null,
    capacity: mapped.capacity ?? input.capacity,
    mode: mapped.mode ?? input.mode,
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
    include: {
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
    },
  });

  return mapBatchRecord(batch);
}
