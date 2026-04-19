import "server-only";

import { Prisma } from "@prisma/client";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import type {
  AssignCurriculumToBatchInput,
  CloneCurriculumInput,
  CreateCurriculumFromTemplateInput,
  CreateCurriculumInput,
  CreateCurriculumModuleInput,
  CreateCurriculumStageInput,
  CreateCurriculumStageItemInput,
  CreateCurriculumStageItemsInput,
  RemoveCurriculumFromBatchInput,
  ReorderCurriculumModulesInput,
  ReorderCurriculumStageItemsInput,
  ReorderCurriculumStagesInput,
  ReleaseCurriculumStageItemForBatchInput,
  RevokeCurriculumStageItemReleaseForBatchInput,
  SaveCurriculumAsTemplateInput,
  UpdateCurriculumInput,
  UpdateCurriculumModuleInput,
  UpdateCurriculumStageInput,
  UpdateCurriculumStageItemInput,
} from "@/lib/validation-schemas/curriculum";
import { AUDIT_ACTION_TYPE, AUDIT_ENTITY_TYPE } from "@/services/logs-actions/constants";
import { createAuditLogEntry } from "@/services/logs-actions-service";
import type {
  CurriculumCreateResult,
  CurriculumModuleMutationResult,
  CurriculumStageItemMutationResult,
  CurriculumStageMutationResult,
} from "@/services/curriculum/types";

type DbClient = Prisma.TransactionClient;

async function ensureCurriculumExists(tx: DbClient, curriculumId: string) {
  const curriculum = await tx.curriculum.findUnique({
    where: { id: curriculumId },
    select: { id: true, courseId: true, title: true },
  });

  if (!curriculum) {
    throw new Error("Curriculum not found.");
  }

  return curriculum;
}

async function ensureBatchExists(tx: DbClient, batchId: string) {
  const batch = await tx.batch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      code: true,
      name: true,
      program: {
        select: {
          courseId: true,
        },
      },
    },
  });

  if (!batch) {
    throw new Error("Batch not found.");
  }

  return batch;
}

async function ensureModuleExists(tx: DbClient, moduleId: string) {
  const moduleRecord = await tx.curriculumModule.findUnique({
    where: { id: moduleId },
    select: { id: true, curriculumId: true, title: true },
  });

  if (!moduleRecord) {
    throw new Error("Module not found.");
  }

  return moduleRecord;
}

async function ensureStageExists(tx: DbClient, stageId: string) {
  const stage = await tx.curriculumStage.findUnique({
    where: { id: stageId },
    select: {
      id: true,
      moduleId: true,
      title: true,
      module: {
        select: {
          curriculumId: true,
          curriculum: { select: { courseId: true } },
        },
      },
    },
  });

  if (!stage) {
    throw new Error("Stage not found.");
  }

  return stage;
}

async function ensureStageItemExists(tx: DbClient, itemId: string) {
  const item = await tx.curriculumStageItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      stageId: true,
      itemType: true,
      stage: {
        select: {
          module: {
            select: {
              curriculumId: true,
            },
          },
        },
      },
    },
  });

  if (!item) {
    throw new Error("Curriculum item not found.");
  }

  return item;
}

async function ensureBatchCanManageCurriculumStageItemRelease(tx: DbClient, options: {
  batchId: string;
  itemId: string;
}) {
  const [batch, item] = await Promise.all([
    ensureBatchExists(tx, options.batchId),
    tx.curriculumStageItem.findUnique({
      where: { id: options.itemId },
      select: {
        id: true,
        releaseConfig: {
          select: {
            releaseType: true,
          },
        },
        stage: {
          select: {
            title: true,
            module: {
              select: {
                title: true,
                curriculumId: true,
                curriculum: {
                  select: {
                    id: true,
                    title: true,
                    courseId: true,
                    status: true,
                    batchMappings: {
                      where: {
                        batchId: options.batchId,
                      },
                      select: {
                        id: true,
                      },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        },
        content: {
          select: {
            title: true,
          },
        },
        assessmentPool: {
          select: {
            title: true,
          },
        },
      },
    }),
  ]);

  if (!item) {
    throw new Error("Curriculum item not found.");
  }

  const curriculum = item.stage.module.curriculum;

  if (batch.program.courseId !== curriculum.courseId) {
    throw new Error("The selected curriculum item does not belong to the same course as this batch.");
  }

  const isAvailableToBatch = curriculum.status === "PUBLISHED" || item.stage.module.curriculum.batchMappings.length > 0;

  if (!isAvailableToBatch) {
    throw new Error("This batch does not currently have access to the selected curriculum item.");
  }

  if ((item.releaseConfig?.releaseType ?? "IMMEDIATE") !== "MANUAL") {
    throw new Error("Only manually released curriculum items can be managed from the batch workspace.");
  }

  return {
    batch,
    item: {
      id: item.id,
      title: item.content?.title ?? item.assessmentPool?.title ?? "Untitled item",
      stageTitle: item.stage.title,
    },
    curriculum: {
      id: curriculum.id,
      title: curriculum.title,
    },
  };
}

async function getNextModuleSortOrder(tx: DbClient, curriculumId: string) {
  const lastModule = await tx.curriculumModule.findFirst({
    where: { curriculumId },
    orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
    select: { sortOrder: true },
  });

  return (lastModule?.sortOrder ?? -1) + 1;
}

async function getNextStageSortOrder(tx: DbClient, moduleId: string) {
  const lastStage = await tx.curriculumStage.findFirst({
    where: { moduleId },
    orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
    select: { sortOrder: true },
  });

  return (lastStage?.sortOrder ?? -1) + 1;
}

async function getNextStageItemSortOrder(tx: DbClient, stageId: string) {
  const lastItem = await tx.curriculumStageItem.findFirst({
    where: { stageId },
    orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
    select: { sortOrder: true },
  });

  return (lastItem?.sortOrder ?? -1) + 1;
}

function normalizeReferenceIds(values: Array<string | null | undefined>) {
  return Array.from(new Set(
    values
      .map((value) => value?.trim() ?? "")
      .filter(Boolean),
  ));
}

function buildStageItemReleaseConfigData(
  releaseConfig: NonNullable<CreateCurriculumStageItemsInput["releaseConfig"]>,
) {
  return {
    releaseType: releaseConfig.releaseType,
    releaseAt: releaseConfig.releaseAt ?? null,
    releaseOffsetDays: releaseConfig.releaseOffsetDays ?? null,
    prerequisiteStageItemId: releaseConfig.prerequisiteStageItemId ?? null,
    minimumScorePercent: releaseConfig.minimumScorePercent ?? null,
    estimatedDurationMinutes: releaseConfig.estimatedDurationMinutes ?? null,
    dueAt: releaseConfig.dueAt ?? null,
    dueOffsetDays: releaseConfig.dueOffsetDays ?? null,
  };
}

async function validateStageItemReleasePrerequisite(options: {
  tx: DbClient;
  stageItemId: string;
  curriculumId: string;
  prerequisiteStageItemId: string | null | undefined;
}) {
  if (!options.prerequisiteStageItemId) {
    return;
  }

  if (options.prerequisiteStageItemId === options.stageItemId) {
    throw new Error("A curriculum item cannot depend on itself.");
  }

  const prerequisiteItem = await ensureStageItemExists(options.tx, options.prerequisiteStageItemId);

  if (prerequisiteItem.stage.module.curriculumId !== options.curriculumId) {
    throw new Error("Release prerequisites must belong to the same curriculum.");
  }
}

function ensureNoPrerequisiteCycle(options: {
  nodeId: string;
  prerequisiteId: string | null;
  prerequisiteById: Map<string, string | null>;
  entityLabel: string;
}) {
  let currentId = options.prerequisiteId;
  const visited = new Set<string>();

  while (currentId) {
    if (currentId === options.nodeId) {
      throw new Error(`${options.entityLabel} prerequisites cannot form a cycle.`);
    }

    if (visited.has(currentId)) {
      break;
    }

    visited.add(currentId);
    currentId = options.prerequisiteById.get(currentId) ?? null;
  }
}

async function validateModulePrerequisite(options: {
  tx: DbClient;
  curriculumId: string;
  moduleId?: string;
  prerequisiteModuleId: string | null | undefined;
}) {
  if (!options.prerequisiteModuleId) {
    return;
  }

  if (options.moduleId && options.prerequisiteModuleId === options.moduleId) {
    throw new Error("A module cannot depend on itself.");
  }

  const prerequisiteModule = await options.tx.curriculumModule.findUnique({
    where: { id: options.prerequisiteModuleId },
    select: { id: true, curriculumId: true },
  });

  if (!prerequisiteModule) {
    throw new Error("Prerequisite module not found.");
  }

  if (prerequisiteModule.curriculumId !== options.curriculumId) {
    throw new Error("Module prerequisites must belong to the same curriculum.");
  }

  if (!options.moduleId) {
    return;
  }

  const modules = await options.tx.curriculumModule.findMany({
    where: { curriculumId: options.curriculumId },
    select: { id: true, prerequisiteModuleId: true },
  });
  const prerequisiteById = new Map(modules.map((moduleRecord) => [moduleRecord.id, moduleRecord.prerequisiteModuleId]));
  prerequisiteById.set(options.moduleId, options.prerequisiteModuleId);

  ensureNoPrerequisiteCycle({
    nodeId: options.moduleId,
    prerequisiteId: options.prerequisiteModuleId,
    prerequisiteById,
    entityLabel: "Module",
  });
}

async function validateStagePrerequisite(options: {
  tx: DbClient;
  moduleId: string;
  stageId?: string;
  prerequisiteStageId: string | null | undefined;
}) {
  if (!options.prerequisiteStageId) {
    return;
  }

  if (options.stageId && options.prerequisiteStageId === options.stageId) {
    throw new Error("A stage cannot depend on itself.");
  }

  const prerequisiteStage = await options.tx.curriculumStage.findUnique({
    where: { id: options.prerequisiteStageId },
    select: { id: true, moduleId: true },
  });

  if (!prerequisiteStage) {
    throw new Error("Prerequisite stage not found.");
  }

  if (prerequisiteStage.moduleId !== options.moduleId) {
    throw new Error("Stage prerequisites must belong to the same module.");
  }

  if (!options.stageId) {
    return;
  }

  const stages = await options.tx.curriculumStage.findMany({
    where: { moduleId: options.moduleId },
    select: { id: true, prerequisiteStageId: true },
  });
  const prerequisiteById = new Map(stages.map((stageRecord) => [stageRecord.id, stageRecord.prerequisiteStageId]));
  prerequisiteById.set(options.stageId, options.prerequisiteStageId);

  ensureNoPrerequisiteCycle({
    nodeId: options.stageId,
    prerequisiteId: options.prerequisiteStageId,
    prerequisiteById,
    entityLabel: "Stage",
  });
}

async function upsertStageItemReleaseConfig(options: {
  tx: DbClient;
  stageItemId: string;
  curriculumId: string;
  releaseConfig: CreateCurriculumStageItemsInput["releaseConfig"] | UpdateCurriculumStageItemInput["releaseConfig"];
}) {
  if (!options.releaseConfig) {
    return;
  }

  await validateStageItemReleasePrerequisite({
    tx: options.tx,
    stageItemId: options.stageItemId,
    curriculumId: options.curriculumId,
    prerequisiteStageItemId: options.releaseConfig.prerequisiteStageItemId,
  });

  const data = buildStageItemReleaseConfigData(options.releaseConfig);

  await options.tx.curriculumStageItemRelease.upsert({
    where: { stageItemId: options.stageItemId },
    create: {
      stageItemId: options.stageItemId,
      ...data,
    },
    update: data,
  });
}

async function ensureUniqueModuleTitle(tx: DbClient, curriculumId: string, title: string, excludeId?: string) {
  const duplicate = await tx.curriculumModule.findFirst({
    where: {
      curriculumId,
      ...(excludeId ? { id: { not: excludeId } } : null),
      title: { equals: title.trim(), mode: "insensitive" },
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new Error("A module with this title already exists in the curriculum.");
  }
}

async function ensureUniqueStageTitle(tx: DbClient, moduleId: string, title: string, excludeId?: string) {
  const duplicate = await tx.curriculumStage.findFirst({
    where: {
      moduleId,
      ...(excludeId ? { id: { not: excludeId } } : null),
      title: { equals: title.trim(), mode: "insensitive" },
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new Error("A stage with this title already exists in the module.");
  }
}

async function resequenceModules(tx: DbClient, curriculumId: string) {
  const modules = await tx.curriculumModule.findMany({
    where: { curriculumId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });

  await Promise.all(modules.map((moduleRecord, index) => tx.curriculumModule.update({
    where: { id: moduleRecord.id },
    data: { sortOrder: index },
  })));
}

async function resequenceStages(tx: DbClient, moduleId: string) {
  const stages = await tx.curriculumStage.findMany({
    where: { moduleId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });

  await Promise.all(stages.map((stageRecord, index) => tx.curriculumStage.update({
    where: { id: stageRecord.id },
    data: { sortOrder: index },
  })));
}

async function resequenceStageItems(tx: DbClient, stageId: string) {
  const items = await tx.curriculumStageItem.findMany({
    where: { stageId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });

  await Promise.all(items.map((item, index) => tx.curriculumStageItem.update({
    where: { id: item.id },
    data: { sortOrder: index },
  })));
}

function validateReorderSet(currentIds: string[], requestedIds: string[], entityLabel: string) {
  if (currentIds.length !== requestedIds.length) {
    throw new Error(`Every ${entityLabel} must be included in the reorder request.`);
  }

  const current = new Set(currentIds);
  if (requestedIds.some((id) => !current.has(id))) {
    throw new Error(`Invalid ${entityLabel} reorder request.`);
  }
}

export async function createCurriculumService(
  input: CreateCurriculumInput,
  options?: { actorUserId?: string },
): Promise<CurriculumCreateResult> {
  if (!isDatabaseConfigured) {
    return {
      id: `mock-curriculum-${Date.now()}`,
      courseId: input.courseId,
      title: input.title.trim(),
      status: "DRAFT",
    };
  }

  const course = await prisma.course.findUnique({
    where: { id: input.courseId },
    select: { id: true },
  });

  if (!course) {
    throw new Error("Course not found.");
  }

  const curriculum = await prisma.$transaction(async (tx) => {
    await ensureUniqueCurriculumTitle(tx, input.courseId, input.title);

    return tx.curriculum.create({
      data: {
        courseId: input.courseId,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        createdById: options?.actorUserId ?? null,
      },
      select: {
        id: true,
        courseId: true,
        title: true,
        status: true,
      },
    });
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.CURRICULUM,
    entityId: curriculum.id,
    action: AUDIT_ACTION_TYPE.CREATED,
    message: `Curriculum "${curriculum.title}" created.`,
    actorUserId: options?.actorUserId,
    metadata: { courseId: input.courseId },
  });

  return curriculum;
}

export async function updateCurriculumService(
  input: UpdateCurriculumInput,
  options?: { actorUserId?: string },
): Promise<CurriculumCreateResult> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const curriculum = await prisma.$transaction(async (tx) => {
    const existing = await ensureCurriculumExists(tx, input.curriculumId);

    if (input.title !== undefined) {
      await ensureUniqueCurriculumTitle(tx, existing.courseId, input.title, input.curriculumId);
    }

    return tx.curriculum.update({
      where: { id: input.curriculumId },
      data: {
        ...(input.title !== undefined && { title: input.title.trim() }),
        ...(input.description !== undefined && { description: input.description.trim() || null }),
        ...(input.status !== undefined && { status: input.status }),
      },
      select: {
        id: true,
        courseId: true,
        title: true,
        status: true,
      },
    });
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.CURRICULUM,
    entityId: curriculum.id,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `Curriculum "${curriculum.title}" updated.`,
    actorUserId: options?.actorUserId,
  });

  return curriculum;
}

export async function deleteCurriculumService(
  curriculumId: string,
  options?: { actorUserId?: string },
): Promise<void> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const existing = await prisma.curriculum.findUnique({
    where: { id: curriculumId },
    select: { id: true, title: true },
  });

  if (!existing) {
    throw new Error("Curriculum not found.");
  }

  await prisma.curriculum.delete({ where: { id: curriculumId } });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.CURRICULUM,
    entityId: curriculumId,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `Curriculum "${existing.title}" deleted.`,
    actorUserId: options?.actorUserId,
  });
}

export async function createCurriculumModuleService(
  input: CreateCurriculumModuleInput,
  options?: { actorUserId?: string },
): Promise<CurriculumModuleMutationResult> {
  if (!isDatabaseConfigured) {
    return {
      id: `mock-module-${Date.now()}`,
      curriculumId: input.curriculumId,
      title: input.title.trim(),
      sortOrder: 0,
    };
  }

  const moduleRecord = await prisma.$transaction(async (tx) => {
    await ensureCurriculumExists(tx, input.curriculumId);
    await ensureUniqueModuleTitle(tx, input.curriculumId, input.title);
    await validateModulePrerequisite({
      tx,
      curriculumId: input.curriculumId,
      prerequisiteModuleId: input.prerequisiteModuleId,
    });

    const sortOrder = await getNextModuleSortOrder(tx, input.curriculumId);

    return tx.curriculumModule.create({
      data: {
        curriculumId: input.curriculumId,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        sortOrder,
        completionRule: input.completionRule ?? "ALL_REQUIRED",
        completionThreshold: input.completionThreshold ?? null,
        prerequisiteModuleId: input.prerequisiteModuleId ?? null,
      },
      select: {
        id: true,
        curriculumId: true,
        title: true,
        sortOrder: true,
      },
    });
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.CURRICULUM,
    entityId: input.curriculumId,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `Module "${moduleRecord.title}" created.`,
    actorUserId: options?.actorUserId,
    metadata: { moduleId: moduleRecord.id },
  });

  return moduleRecord;
}

export async function updateCurriculumModuleService(
  input: UpdateCurriculumModuleInput,
  options?: { actorUserId?: string },
): Promise<CurriculumModuleMutationResult> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const moduleRecord = await prisma.$transaction(async (tx) => {
    const existing = await ensureModuleExists(tx, input.moduleId);

    if (input.title !== undefined) {
      await ensureUniqueModuleTitle(tx, existing.curriculumId, input.title, input.moduleId);
    }

    if (input.prerequisiteModuleId !== undefined) {
      await validateModulePrerequisite({
        tx,
        curriculumId: existing.curriculumId,
        moduleId: input.moduleId,
        prerequisiteModuleId: input.prerequisiteModuleId,
      });
    }

    return tx.curriculumModule.update({
      where: { id: input.moduleId },
      data: {
        ...(input.title !== undefined && { title: input.title.trim() }),
        ...(input.description !== undefined && { description: input.description.trim() || null }),
        ...(input.completionRule !== undefined && { completionRule: input.completionRule }),
        ...(input.completionThreshold !== undefined && { completionThreshold: input.completionThreshold }),
        ...(input.prerequisiteModuleId !== undefined && { prerequisiteModuleId: input.prerequisiteModuleId }),
      },
      select: {
        id: true,
        curriculumId: true,
        title: true,
        sortOrder: true,
      },
    });
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.CURRICULUM,
    entityId: moduleRecord.curriculumId,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `Module "${moduleRecord.title}" updated.`,
    actorUserId: options?.actorUserId,
    metadata: { moduleId: moduleRecord.id },
  });

  return moduleRecord;
}

export async function deleteCurriculumModuleService(
  moduleId: string,
  options?: { actorUserId?: string },
): Promise<void> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const deleted = await prisma.$transaction(async (tx) => {
    const existing = await ensureModuleExists(tx, moduleId);
    await tx.curriculumModule.delete({ where: { id: moduleId } });
    await resequenceModules(tx, existing.curriculumId);
    return existing;
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.CURRICULUM,
    entityId: deleted.curriculumId,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `Module "${deleted.title}" deleted.`,
    actorUserId: options?.actorUserId,
    metadata: { moduleId },
  });
}

export async function reorderCurriculumModulesService(
  input: ReorderCurriculumModulesInput,
): Promise<void> {
  if (!isDatabaseConfigured) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await ensureCurriculumExists(tx, input.curriculumId);

    const currentModules = await tx.curriculumModule.findMany({
      where: { curriculumId: input.curriculumId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });

    validateReorderSet(currentModules.map((moduleRecord) => moduleRecord.id), input.moduleIds, "module");

    await Promise.all(input.moduleIds.map((moduleId, index) => tx.curriculumModule.update({
      where: { id: moduleId },
      data: { sortOrder: index },
    })));
  });
}

export async function createCurriculumStageService(
  input: CreateCurriculumStageInput,
  options?: { actorUserId?: string },
): Promise<CurriculumStageMutationResult> {
  if (!isDatabaseConfigured) {
    return {
      id: `mock-stage-${Date.now()}`,
      moduleId: input.moduleId,
      title: input.title.trim(),
      sortOrder: 0,
    };
  }

  const stage = await prisma.$transaction(async (tx) => {
    await ensureModuleExists(tx, input.moduleId);
    await ensureUniqueStageTitle(tx, input.moduleId, input.title);
    await validateStagePrerequisite({
      tx,
      moduleId: input.moduleId,
      prerequisiteStageId: input.prerequisiteStageId,
    });

    const sortOrder = await getNextStageSortOrder(tx, input.moduleId);

    return tx.curriculumStage.create({
      data: {
        moduleId: input.moduleId,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        sortOrder,
        completionRule: input.completionRule ?? "ALL_REQUIRED",
        completionThreshold: input.completionThreshold ?? null,
        prerequisiteStageId: input.prerequisiteStageId ?? null,
      },
      select: {
        id: true,
        moduleId: true,
        title: true,
        sortOrder: true,
      },
    });
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.CURRICULUM,
    entityId: stage.moduleId,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `Stage "${stage.title}" created.`,
    actorUserId: options?.actorUserId,
    metadata: { stageId: stage.id },
  });

  return stage;
}

export async function updateCurriculumStageService(
  input: UpdateCurriculumStageInput,
  options?: { actorUserId?: string },
): Promise<CurriculumStageMutationResult> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const stage = await prisma.$transaction(async (tx) => {
    const existing = await ensureStageExists(tx, input.stageId);

    if (input.title !== undefined) {
      await ensureUniqueStageTitle(tx, existing.moduleId, input.title, input.stageId);
    }

    if (input.prerequisiteStageId !== undefined) {
      await validateStagePrerequisite({
        tx,
        moduleId: existing.moduleId,
        stageId: input.stageId,
        prerequisiteStageId: input.prerequisiteStageId,
      });
    }

    return tx.curriculumStage.update({
      where: { id: input.stageId },
      data: {
        ...(input.title !== undefined && { title: input.title.trim() }),
        ...(input.description !== undefined && { description: input.description.trim() || null }),
        ...(input.completionRule !== undefined && { completionRule: input.completionRule }),
        ...(input.completionThreshold !== undefined && { completionThreshold: input.completionThreshold }),
        ...(input.prerequisiteStageId !== undefined && { prerequisiteStageId: input.prerequisiteStageId }),
      },
      select: {
        id: true,
        moduleId: true,
        title: true,
        sortOrder: true,
      },
    });
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.CURRICULUM,
    entityId: stage.moduleId,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `Stage "${stage.title}" updated.`,
    actorUserId: options?.actorUserId,
    metadata: { stageId: stage.id },
  });

  return stage;
}

export async function deleteCurriculumStageService(
  stageId: string,
  options?: { actorUserId?: string },
): Promise<void> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const deleted = await prisma.$transaction(async (tx) => {
    const existing = await ensureStageExists(tx, stageId);
    await tx.curriculumStage.delete({ where: { id: stageId } });
    await resequenceStages(tx, existing.moduleId);
    return existing;
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.CURRICULUM,
    entityId: deleted.module.curriculumId,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `Stage "${deleted.title}" deleted.`,
    actorUserId: options?.actorUserId,
    metadata: { stageId },
  });
}

export async function reorderCurriculumStagesService(
  input: ReorderCurriculumStagesInput,
): Promise<void> {
  if (!isDatabaseConfigured) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await ensureModuleExists(tx, input.moduleId);

    const currentStages = await tx.curriculumStage.findMany({
      where: { moduleId: input.moduleId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });

    validateReorderSet(currentStages.map((stage) => stage.id), input.stageIds, "stage");

    await Promise.all(input.stageIds.map((stageId, index) => tx.curriculumStage.update({
      where: { id: stageId },
      data: { sortOrder: index },
    })));
  });
}

export async function createCurriculumStageItemService(
  input: CreateCurriculumStageItemInput,
  options?: { actorUserId?: string },
): Promise<CurriculumStageItemMutationResult> {
  const [stageItem] = await createCurriculumStageItemsService({
    stageId: input.stageId,
    itemType: input.itemType,
    contentIds: input.contentId ? [input.contentId] : [],
    assessmentPoolIds: input.assessmentPoolId ? [input.assessmentPoolId] : [],
    isRequired: input.isRequired ?? false,
    releaseConfig: input.releaseConfig,
  }, options);

  return stageItem;
}

export async function createCurriculumStageItemsService(
  input: CreateCurriculumStageItemsInput,
  options?: { actorUserId?: string },
): Promise<CurriculumStageItemMutationResult[]> {
  if (!isDatabaseConfigured) {
    const referenceIds = input.itemType === "CONTENT"
      ? normalizeReferenceIds(input.contentIds)
      : normalizeReferenceIds(input.assessmentPoolIds);

    return referenceIds.map((referenceId, index) => ({
      id: `mock-stage-item-${Date.now()}-${index}`,
      stageId: input.stageId,
      itemType: input.itemType,
      contentId: input.itemType === "CONTENT" ? referenceId : null,
      assessmentPoolId: input.itemType === "ASSESSMENT" ? referenceId : null,
      sortOrder: index,
      isRequired: input.isRequired ?? false,
    }));
  }

  const stageItems = await prisma.$transaction(async (tx) => {
    const stage = await ensureStageExists(tx, input.stageId);
    const curriculumId = stage.module.curriculumId;
    const courseId = stage.module.curriculum.courseId;
    const contentIds = input.itemType === "CONTENT" ? normalizeReferenceIds(input.contentIds) : [];
    const assessmentPoolIds = input.itemType === "ASSESSMENT" ? normalizeReferenceIds(input.assessmentPoolIds) : [];
    const referenceIds = input.itemType === "CONTENT" ? contentIds : assessmentPoolIds;

    if (input.itemType === "CONTENT") {
      const contents = await tx.courseContent.findMany({
        where: {
          id: { in: contentIds },
          courseId,
        },
        select: { id: true },
      });

      if (contents.length !== contentIds.length) {
        throw new Error("One or more selected content items do not belong to this curriculum course.");
      }
    }

    if (input.itemType === "ASSESSMENT") {
      const pools = await tx.assessmentPool.findMany({
        where: { id: { in: assessmentPoolIds } },
        select: { id: true },
      });

      if (pools.length !== assessmentPoolIds.length) {
        throw new Error("One or more selected assessments could not be found.");
      }
    }

    const nextSortOrder = await getNextStageItemSortOrder(tx, input.stageId);
    const createdItems: CurriculumStageItemMutationResult[] = [];

    for (const [index, referenceId] of referenceIds.entries()) {
      const createdItem = await tx.curriculumStageItem.create({
        data: {
          stageId: input.stageId,
          itemType: input.itemType,
          contentId: input.itemType === "CONTENT" ? referenceId : null,
          assessmentPoolId: input.itemType === "ASSESSMENT" ? referenceId : null,
          sortOrder: nextSortOrder + index,
          isRequired: input.isRequired ?? false,
        },
        select: {
          id: true,
          stageId: true,
          itemType: true,
          contentId: true,
          assessmentPoolId: true,
          sortOrder: true,
          isRequired: true,
        },
      });

      await upsertStageItemReleaseConfig({
        tx,
        stageItemId: createdItem.id,
        curriculumId,
        releaseConfig: input.releaseConfig,
      });

      createdItems.push(createdItem);
    }

    return createdItems;
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.CURRICULUM,
    entityId: input.stageId,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `${stageItems.length} curriculum item${stageItems.length === 1 ? "" : "s"} added to stage.`,
    actorUserId: options?.actorUserId,
    metadata: {
      itemIds: stageItems.map((item) => item.id),
      itemType: input.itemType,
      contentIds: input.itemType === "CONTENT" ? normalizeReferenceIds(input.contentIds) : [],
      assessmentPoolIds: input.itemType === "ASSESSMENT" ? normalizeReferenceIds(input.assessmentPoolIds) : [],
    },
  });

  return stageItems;
}

export async function updateCurriculumStageItemService(
  input: UpdateCurriculumStageItemInput,
  options?: { actorUserId?: string },
): Promise<CurriculumStageItemMutationResult> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const item = await prisma.$transaction(async (tx) => {
    const existing = await ensureStageItemExists(tx, input.itemId);

    await upsertStageItemReleaseConfig({
      tx,
      stageItemId: input.itemId,
      curriculumId: existing.stage.module.curriculumId,
      releaseConfig: input.releaseConfig,
    });

    return tx.curriculumStageItem.update({
      where: { id: input.itemId },
      data: {
        ...(input.isRequired !== undefined && { isRequired: input.isRequired }),
      },
      select: {
        id: true,
        stageId: true,
        itemType: true,
        contentId: true,
        assessmentPoolId: true,
        sortOrder: true,
        isRequired: true,
      },
    });
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.CURRICULUM,
    entityId: item.stageId,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `Curriculum item updated.`,
    actorUserId: options?.actorUserId,
    metadata: { itemId: item.id },
  });

  return item;
}

export async function deleteCurriculumStageItemService(
  itemId: string,
  options?: { actorUserId?: string },
): Promise<void> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const deleted = await prisma.$transaction(async (tx) => {
    const existing = await ensureStageItemExists(tx, itemId);
    await tx.curriculumStageItem.delete({ where: { id: itemId } });
    await resequenceStageItems(tx, existing.stageId);
    return existing;
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.CURRICULUM,
    entityId: deleted.stageId,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `Curriculum item removed from stage.`,
    actorUserId: options?.actorUserId,
    metadata: { itemId },
  });
}

export async function reorderCurriculumStageItemsService(
  input: ReorderCurriculumStageItemsInput,
): Promise<void> {
  if (!isDatabaseConfigured) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await ensureStageExists(tx, input.stageId);

    const currentItems = await tx.curriculumStageItem.findMany({
      where: { stageId: input.stageId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });

    validateReorderSet(currentItems.map((item) => item.id), input.itemIds, "curriculum item");

    await Promise.all(input.itemIds.map((itemId, index) => tx.curriculumStageItem.update({
      where: { id: itemId },
      data: { sortOrder: index },
    })));
  });
}

export async function assignCurriculumToBatchService(
  input: AssignCurriculumToBatchInput,
  options?: { actorUserId?: string },
): Promise<void> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const assignment = await prisma.$transaction(async (tx) => {
    const curriculum = await ensureCurriculumExists(tx, input.curriculumId);
    const batch = await ensureBatchExists(tx, input.batchId);

    if (batch.program.courseId !== curriculum.courseId) {
      throw new Error("The selected batch does not belong to the same course as this curriculum.");
    }

    const result = await tx.batchCurriculumMapping.createMany({
      data: [{
        batchId: input.batchId,
        curriculumId: input.curriculumId,
        assignedById: options?.actorUserId ?? null,
      }],
      skipDuplicates: true,
    });

    return {
      curriculum,
      batch,
      created: result.count > 0,
    };
  });

  if (!assignment.created) {
    return;
  }

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.CURRICULUM,
    entityId: input.curriculumId,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `Curriculum "${assignment.curriculum.title}" assigned to batch ${assignment.batch.code}.`,
    actorUserId: options?.actorUserId,
    metadata: {
      batchId: input.batchId,
      batchCode: assignment.batch.code,
    },
  });
}

export async function removeCurriculumFromBatchService(
  input: RemoveCurriculumFromBatchInput,
  options?: { actorUserId?: string },
): Promise<void> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const removal = await prisma.$transaction(async (tx) => {
    const curriculum = await ensureCurriculumExists(tx, input.curriculumId);
    const batch = await ensureBatchExists(tx, input.batchId);

    if (batch.program.courseId !== curriculum.courseId) {
      throw new Error("The selected batch does not belong to the same course as this curriculum.");
    }

    const result = await tx.batchCurriculumMapping.deleteMany({
      where: {
        batchId: input.batchId,
        curriculumId: input.curriculumId,
      },
    });

    return {
      curriculum,
      batch,
      removed: result.count > 0,
    };
  });

  if (!removal.removed) {
    return;
  }

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.CURRICULUM,
    entityId: input.curriculumId,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `Curriculum "${removal.curriculum.title}" removed from batch ${removal.batch.code}.`,
    actorUserId: options?.actorUserId,
    metadata: {
      batchId: input.batchId,
      batchCode: removal.batch.code,
    },
  });
}

export async function releaseCurriculumStageItemForBatchService(
  input: ReleaseCurriculumStageItemForBatchInput,
  options?: { actorUserId?: string },
): Promise<void> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const release = await prisma.$transaction(async (tx) => {
    const context = await ensureBatchCanManageCurriculumStageItemRelease(tx, {
      batchId: input.batchId,
      itemId: input.itemId,
    });

    await tx.batchCurriculumStageItemRelease.upsert({
      where: {
        batchId_stageItemId: {
          batchId: input.batchId,
          stageItemId: input.itemId,
        },
      },
      create: {
        batchId: input.batchId,
        stageItemId: input.itemId,
        releasedById: options?.actorUserId ?? null,
        note: input.note?.trim() || null,
      },
      update: {
        releasedById: options?.actorUserId ?? null,
        note: input.note?.trim() || null,
        releasedAt: new Date(),
      },
    });

    return context;
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.CURRICULUM,
    entityId: release.curriculum.id,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `Curriculum item "${release.item.title}" manually released for batch ${release.batch.code}.`,
    actorUserId: options?.actorUserId,
    metadata: {
      batchId: input.batchId,
      batchCode: release.batch.code,
      itemId: input.itemId,
      stageTitle: release.item.stageTitle,
    },
  });
}

export async function revokeCurriculumStageItemReleaseForBatchService(
  input: RevokeCurriculumStageItemReleaseForBatchInput,
  options?: { actorUserId?: string },
): Promise<void> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const release = await prisma.$transaction(async (tx) => {
    const context = await ensureBatchCanManageCurriculumStageItemRelease(tx, {
      batchId: input.batchId,
      itemId: input.itemId,
    });

    await tx.batchCurriculumStageItemRelease.deleteMany({
      where: {
        batchId: input.batchId,
        stageItemId: input.itemId,
      },
    });

    return context;
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.CURRICULUM,
    entityId: release.curriculum.id,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `Manual release revoked for curriculum item "${release.item.title}" in batch ${release.batch.code}.`,
    actorUserId: options?.actorUserId,
    metadata: {
      batchId: input.batchId,
      batchCode: release.batch.code,
      itemId: input.itemId,
      stageTitle: release.item.stageTitle,
    },
  });
}

async function ensureUniqueCurriculumTitle(tx: DbClient, courseId: string, title: string, excludeId?: string) {
  const duplicate = await tx.curriculum.findFirst({
    where: {
      courseId,
      ...(excludeId ? { id: { not: excludeId } } : null),
      title: { equals: title.trim(), mode: "insensitive" },
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new Error("A curriculum with this title already exists for the selected course.");
  }
}

/* ------------------------------------------------------------------ */
/*  Deep-clone a curriculum (Gap 1: Curriculum Cloning)                */
/* ------------------------------------------------------------------ */

async function deepCloneCurriculum(
  tx: DbClient,
  options: {
    sourceCurriculumId: string;
    targetCourseId: string;
    title: string;
    isTemplate: boolean;
    actorUserId?: string;
  },
): Promise<CurriculumCreateResult> {
  const source = await tx.curriculum.findUnique({
    where: { id: options.sourceCurriculumId },
    select: {
      id: true,
      courseId: true,
      description: true,
      modules: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          sortOrder: true,
          completionRule: true,
          completionThreshold: true,
          prerequisiteModuleId: true,
          stages: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              title: true,
              description: true,
              sortOrder: true,
              completionRule: true,
              completionThreshold: true,
              prerequisiteStageId: true,
              items: {
                orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
                select: {
                  id: true,
                  itemType: true,
                  contentId: true,
                  assessmentPoolId: true,
                  sortOrder: true,
                  isRequired: true,
                  releaseConfig: {
                    select: {
                      releaseType: true,
                      releaseAt: true,
                      releaseOffsetDays: true,
                      minimumScorePercent: true,
                      estimatedDurationMinutes: true,
                      dueAt: true,
                      dueOffsetDays: true,
                      prerequisiteStageItemId: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!source) {
    throw new Error("Source curriculum not found.");
  }

  const isCrossCourse = source.courseId !== options.targetCourseId;

  const created = await tx.curriculum.create({
    data: {
      courseId: options.targetCourseId,
      title: options.title.trim(),
      description: source.description,
      status: "DRAFT",
      isTemplate: options.isTemplate,
      sourceCurriculumId: options.sourceCurriculumId,
      createdById: options.actorUserId ?? null,
    },
    select: { id: true, courseId: true, title: true, status: true },
  });

  // Build ID maps for prerequisite rewiring
  const oldModuleIdToNew = new Map<string, string>();
  const oldStageIdToNew = new Map<string, string>();
  const oldItemIdToNew = new Map<string, string>();

  for (const srcModule of source.modules) {
    const newModule = await tx.curriculumModule.create({
      data: {
        curriculumId: created.id,
        title: srcModule.title,
        description: srcModule.description,
        sortOrder: srcModule.sortOrder,
        completionRule: srcModule.completionRule,
        completionThreshold: srcModule.completionThreshold,
      },
      select: { id: true },
    });
    oldModuleIdToNew.set(srcModule.id, newModule.id);

    for (const srcStage of srcModule.stages) {
      const newStage = await tx.curriculumStage.create({
        data: {
          moduleId: newModule.id,
          title: srcStage.title,
          description: srcStage.description,
          sortOrder: srcStage.sortOrder,
          completionRule: srcStage.completionRule,
          completionThreshold: srcStage.completionThreshold,
        },
        select: { id: true },
      });
      oldStageIdToNew.set(srcStage.id, newStage.id);

      for (const srcItem of srcStage.items) {
        // For cross-course clones, skip content items (they belong to source course)
        // Assessments are course-agnostic so they can be referenced
        if (isCrossCourse && srcItem.itemType === "CONTENT" && srcItem.contentId) {
          continue;
        }

        const newItem = await tx.curriculumStageItem.create({
          data: {
            stageId: newStage.id,
            itemType: srcItem.itemType,
            contentId: srcItem.contentId,
            assessmentPoolId: srcItem.assessmentPoolId,
            sortOrder: srcItem.sortOrder,
            isRequired: srcItem.isRequired,
          },
          select: { id: true },
        });
        oldItemIdToNew.set(srcItem.id, newItem.id);

        if (srcItem.releaseConfig) {
          const rc = srcItem.releaseConfig;
          const newPrereqId = rc.prerequisiteStageItemId
            ? oldItemIdToNew.get(rc.prerequisiteStageItemId) ?? null
            : null;

          // Skip prerequisite-based release types if the prerequisite item wasn't cloned
          const releaseType =
            (rc.releaseType === "PREVIOUS_ITEM_COMPLETION" || rc.releaseType === "PREVIOUS_ITEM_SCORE") && !newPrereqId
              ? "IMMEDIATE"
              : rc.releaseType;

          await tx.curriculumStageItemRelease.create({
            data: {
              stageItemId: newItem.id,
              releaseType,
              releaseAt: rc.releaseAt,
              releaseOffsetDays: rc.releaseOffsetDays,
              prerequisiteStageItemId: newPrereqId,
              minimumScorePercent: releaseType === "PREVIOUS_ITEM_SCORE" ? rc.minimumScorePercent : null,
              estimatedDurationMinutes: rc.estimatedDurationMinutes,
              dueAt: rc.dueAt,
              dueOffsetDays: rc.dueOffsetDays,
            },
          });
        }
      }
    }
  }

  // Wire module prerequisites
  for (const srcModule of source.modules) {
    const newModuleId = oldModuleIdToNew.get(srcModule.id);

    if (!newModuleId) {
      continue;
    }

    if (srcModule.prerequisiteModuleId) {
      const newPrerequisiteModuleId = oldModuleIdToNew.get(srcModule.prerequisiteModuleId) ?? null;

      if (newPrerequisiteModuleId) {
        await tx.curriculumModule.update({
          where: { id: newModuleId },
          data: { prerequisiteModuleId: newPrerequisiteModuleId },
        });
      }
    }

    for (const srcStage of srcModule.stages) {
      const newStageId = oldStageIdToNew.get(srcStage.id);

      if (!newStageId || !srcStage.prerequisiteStageId) {
        continue;
      }

      const newPrerequisiteStageId = oldStageIdToNew.get(srcStage.prerequisiteStageId) ?? null;

      if (newPrerequisiteStageId) {
        await tx.curriculumStage.update({
          where: { id: newStageId },
          data: { prerequisiteStageId: newPrerequisiteStageId },
        });
      }
    }
  }

  return created;
}

export async function cloneCurriculumService(
  input: CloneCurriculumInput,
  options?: { actorUserId?: string },
): Promise<CurriculumCreateResult> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const created = await prisma.$transaction(async (tx) => {
    await ensureUniqueCurriculumTitle(tx, input.targetCourseId, input.title);
    return deepCloneCurriculum(tx, {
      sourceCurriculumId: input.sourceCurriculumId,
      targetCourseId: input.targetCourseId,
      title: input.title,
      isTemplate: false,
      actorUserId: options?.actorUserId,
    });
  }, { timeout: 30_000 });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.CURRICULUM,
    entityId: created.id,
    action: AUDIT_ACTION_TYPE.CREATED,
    message: `Curriculum "${created.title}" cloned from source.`,
    actorUserId: options?.actorUserId,
    metadata: { sourceCurriculumId: input.sourceCurriculumId },
  });

  return created;
}

/* ------------------------------------------------------------------ */
/*  Save curriculum as template (Gap 2: Templates)                     */
/* ------------------------------------------------------------------ */

export async function saveCurriculumAsTemplateService(
  input: SaveCurriculumAsTemplateInput,
  options?: { actorUserId?: string },
): Promise<CurriculumCreateResult> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const created = await prisma.$transaction(async (tx) => {
    const source = await ensureCurriculumExists(tx, input.curriculumId);
    const templateTitle = `[Template] ${source.title}`;
    await ensureUniqueCurriculumTitle(tx, source.courseId, templateTitle);

    return deepCloneCurriculum(tx, {
      sourceCurriculumId: input.curriculumId,
      targetCourseId: source.courseId,
      title: templateTitle,
      isTemplate: true,
      actorUserId: options?.actorUserId,
    });
  }, { timeout: 30_000 });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.CURRICULUM,
    entityId: created.id,
    action: AUDIT_ACTION_TYPE.CREATED,
    message: `Curriculum template "${created.title}" created.`,
    actorUserId: options?.actorUserId,
    metadata: { sourceCurriculumId: input.curriculumId },
  });

  return created;
}

export async function createCurriculumFromTemplateService(
  input: CreateCurriculumFromTemplateInput,
  options?: { actorUserId?: string },
): Promise<CurriculumCreateResult> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const created = await prisma.$transaction(async (tx) => {
    const template = await tx.curriculum.findUnique({
      where: { id: input.templateCurriculumId },
      select: { id: true, isTemplate: true },
    });

    if (!template) {
      throw new Error("Template not found.");
    }

    if (!template.isTemplate) {
      throw new Error("The selected curriculum is not a template.");
    }

    await ensureUniqueCurriculumTitle(tx, input.targetCourseId, input.title);

    return deepCloneCurriculum(tx, {
      sourceCurriculumId: input.templateCurriculumId,
      targetCourseId: input.targetCourseId,
      title: input.title,
      isTemplate: false,
      actorUserId: options?.actorUserId,
    });
  }, { timeout: 30_000 });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.CURRICULUM,
    entityId: created.id,
    action: AUDIT_ACTION_TYPE.CREATED,
    message: `Curriculum "${created.title}" created from template.`,
    actorUserId: options?.actorUserId,
    metadata: { templateCurriculumId: input.templateCurriculumId },
  });

  return created;
}