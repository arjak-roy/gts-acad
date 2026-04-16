import "server-only";

import type { CurriculumProgressStatus, QuestionType } from "@prisma/client";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { listCurriculumItemProgressForLearnerService } from "@/services/curriculum/progress";
import { resolveCurriculumStageItemAvailability } from "@/services/curriculum/release";
import { getBatchCourseContext } from "@/services/lms/hierarchy";
import { MOCK_BATCHES } from "@/services/batches/mock-data";
import type {
  BatchAssignedCurriculumDetail,
  BatchCurriculumWorkspace,
  CurriculumAssignmentSource,
  CurriculumBatchMappingItem,
  CurriculumDetail,
  CurriculumStageItemDetail,
  CurriculumSummary,
} from "@/services/curriculum/types";

type BatchManualReleaseSnapshot = {
  isReleased: boolean;
  releasedAt: Date | null;
  releasedByName: string | null;
  note: string | null;
};

type GetCurriculaForBatchOptions = {
  publishedOnly?: boolean;
};

type CurriculumSummaryRecord = {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  createdAt: Date;
  updatedAt: Date;
  course: { code: string; name: string };
  modules: Array<{
    id: string;
    stages: Array<{
      id: string;
      _count: {
        items: number;
      };
    }>;
  }>;
  _count: {
    batchMappings: number;
  };
};

type CurriculumDetailRecord = {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  createdAt: Date;
  updatedAt: Date;
  course: { code: string; name: string };
  createdBy: { name: string } | null;
  modules: Array<{
    id: string;
    title: string;
    description: string | null;
    sortOrder: number;
    stages: Array<{
      id: string;
      title: string;
      description: string | null;
      sortOrder: number;
      items: Array<{
        id: string;
        itemType: "CONTENT" | "ASSESSMENT";
        contentId: string | null;
        assessmentPoolId: string | null;
        sortOrder: number;
        isRequired: boolean;
        releaseConfig: {
          releaseType: "IMMEDIATE" | "ABSOLUTE_DATE" | "BATCH_RELATIVE" | "PREVIOUS_ITEM_COMPLETION" | "PREVIOUS_ITEM_SCORE" | "MANUAL";
          releaseAt: Date | null;
          releaseOffsetDays: number | null;
          prerequisiteStageItemId: string | null;
          minimumScorePercent: number | null;
          estimatedDurationMinutes: number | null;
          dueAt: Date | null;
          dueOffsetDays: number | null;
        } | null;
        content: {
          title: string;
          description: string | null;
          contentType: "ARTICLE" | "PDF" | "DOCUMENT" | "VIDEO" | "SCORM" | "LINK" | "OTHER";
          status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
          folder: { name: string } | null;
          course: { name: string };
        } | null;
        assessmentPool: {
          code: string;
          title: string;
          description: string | null;
          questionType: QuestionType;
          difficultyLevel: "EASY" | "MEDIUM" | "HARD";
          status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
        } | null;
      }>;
    }>;
  }>;
  _count: {
    batchMappings: number;
  };
};

function buildCurriculumCounts(modules: CurriculumSummaryRecord["modules"] | CurriculumDetailRecord["modules"]) {
  const moduleCount = modules.length;
  const stageCount = modules.reduce((sum, moduleRecord) => sum + moduleRecord.stages.length, 0);
  const itemCount = modules.reduce(
    (sum, moduleRecord) => sum + moduleRecord.stages.reduce((stageSum, stage) => {
      if ("items" in stage) {
        return stageSum + stage.items.length;
      }

      return stageSum + stage._count.items;
    }, 0),
    0,
  );

  return {
    moduleCount,
    stageCount,
    itemCount,
  };
}

function resolveCurriculumAssignmentSource(options: {
  isInheritedFromCourse: boolean;
  isBatchMapped: boolean;
}): CurriculumAssignmentSource {
  if (options.isInheritedFromCourse && options.isBatchMapped) {
    return "COURSE_AND_BATCH";
  }

  if (options.isBatchMapped) {
    return "BATCH";
  }

  return "COURSE";
}

function buildSyntheticCurriculumMappingId(batchId: string, curriculumId: string) {
  return `course:${batchId}:${curriculumId}`;
}

function collectCurriculumStageItemIds(curriculum: CurriculumDetail) {
  return curriculum.modules.flatMap((moduleRecord) =>
    moduleRecord.stages.flatMap((stage) => stage.items.map((item) => item.id)),
  );
}

function collectCurriculumAssessmentPoolIds(curriculum: CurriculumDetail) {
  return curriculum.modules.flatMap((moduleRecord) =>
    moduleRecord.stages.flatMap((stage) => stage.items.flatMap((item) => item.assessmentPoolId ? [item.assessmentPoolId] : [])),
  );
}

function buildCurriculumItemMetadata(curriculum: CurriculumDetail) {
  const orderedItems = curriculum.modules.flatMap((moduleRecord) =>
    moduleRecord.stages.flatMap((stage) => stage.items),
  );

  return new Map(orderedItems.map((item, index) => [
    item.id,
    {
      title: item.referenceTitle,
      previousStageItemId: index > 0 ? orderedItems[index - 1]?.id ?? null : null,
      previousTitle: index > 0 ? orderedItems[index - 1]?.referenceTitle ?? null : null,
    },
  ]));
}

function applyLearnerStateToCurriculum(
  curriculum: CurriculumDetail,
  options: {
    batchStartDate: Date;
    progressByStageItemId: Map<string, {
      status: CurriculumProgressStatus;
      progressPercent: number;
      startedAt: Date | null;
      completedAt: Date | null;
    }>;
    scoreByStageItemId: Map<string, number | null>;
    manualReleaseAtByStageItemId: Map<string, Date>;
  },
): CurriculumDetail {
  const itemMetadata = buildCurriculumItemMetadata(curriculum);

  return {
    ...curriculum,
    modules: curriculum.modules.map((moduleRecord) => ({
      ...moduleRecord,
      stages: moduleRecord.stages.map((stage) => ({
        ...stage,
        items: stage.items.map((item) => ({
          ...(() => {
            const progressRecord = options.progressByStageItemId.get(item.id);
            const metadata = itemMetadata.get(item.id);
            const explicitPrerequisiteStageItemId = item.release.prerequisiteStageItemId;
            const effectivePrerequisiteStageItemId = explicitPrerequisiteStageItemId ?? metadata?.previousStageItemId ?? null;
            const effectivePrerequisiteTitle = effectivePrerequisiteStageItemId
              ? itemMetadata.get(effectivePrerequisiteStageItemId)?.title ?? null
              : metadata?.previousTitle ?? null;
            const availability = resolveCurriculumStageItemAvailability({
              batchStartDate: options.batchStartDate,
              progressStatus: progressRecord?.status ?? "NOT_STARTED",
              manualReleaseAt: options.manualReleaseAtByStageItemId.get(item.id) ?? null,
              release: {
                releaseType: item.release.releaseType,
                releaseAt: item.release.releaseAt,
                releaseOffsetDays: item.release.releaseOffsetDays,
                prerequisiteStageItemId: explicitPrerequisiteStageItemId,
                prerequisiteTitle: explicitPrerequisiteStageItemId ? effectivePrerequisiteTitle : null,
                minimumScorePercent: item.release.minimumScorePercent,
                estimatedDurationMinutes: item.release.estimatedDurationMinutes,
                dueAt: item.release.dueAt,
                dueOffsetDays: item.release.dueOffsetDays,
              },
              defaultPrerequisiteStageItemId: metadata?.previousStageItemId ?? null,
              defaultPrerequisiteTitle: metadata?.previousTitle ?? null,
              prerequisiteProgressStatus: effectivePrerequisiteStageItemId
                ? options.progressByStageItemId.get(effectivePrerequisiteStageItemId)?.status ?? "NOT_STARTED"
                : null,
              prerequisiteScorePercent: effectivePrerequisiteStageItemId
                ? options.scoreByStageItemId.get(effectivePrerequisiteStageItemId) ?? null
                : null,
            });

            return {
              ...item,
              progressStatus: progressRecord?.status ?? "NOT_STARTED",
              progressPercent: progressRecord?.progressPercent ?? 0,
              startedAt: progressRecord?.startedAt ?? null,
              completedAt: progressRecord?.completedAt ?? null,
              availabilityStatus: availability.availabilityStatus,
              availabilityReason: availability.availabilityReason,
              release: availability.release,
            } satisfies CurriculumStageItemDetail;
          })(),
        })),
      })),
    })),
  };
}

function applyBatchManualReleaseStateToCurriculum(
  curriculum: CurriculumDetail,
  manualReleaseByStageItemId: Map<string, BatchManualReleaseSnapshot>,
): CurriculumDetail {
  return {
    ...curriculum,
    modules: curriculum.modules.map((moduleRecord) => ({
      ...moduleRecord,
      stages: moduleRecord.stages.map((stage) => ({
        ...stage,
        items: stage.items.map((item) => ({
          ...item,
          batchManualRelease: manualReleaseByStageItemId.get(item.id) ?? null,
        })),
      })),
    })),
  };
}

async function getCurriculumDetailMap(curriculumIds: string[]) {
  const uniqueCurriculumIds = Array.from(new Set(curriculumIds));

  if (uniqueCurriculumIds.length === 0) {
    return new Map<string, CurriculumDetail>();
  }

  const curricula = await Promise.all(uniqueCurriculumIds.map(async (curriculumId) => {
    const curriculum = await getCurriculumByIdService(curriculumId);
    return curriculum ? [curriculumId, curriculum] as const : null;
  }));

  return new Map(curricula.filter((entry): entry is readonly [string, CurriculumDetail] => Boolean(entry)));
}

function mapCurriculumSummary(summary: CurriculumSummaryRecord): CurriculumSummary {
  const counts = buildCurriculumCounts(summary.modules);

  return {
    id: summary.id,
    courseId: summary.courseId,
    courseCode: summary.course.code,
    courseName: summary.course.name,
    title: summary.title,
    description: summary.description,
    status: summary.status,
    moduleCount: counts.moduleCount,
    stageCount: counts.stageCount,
    itemCount: counts.itemCount,
    batchCount: summary._count.batchMappings,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
  };
}

function mapCurriculum(detail: CurriculumDetailRecord): CurriculumDetail {
  const modules = detail.modules.map((moduleRecord) => {
    const stages = moduleRecord.stages.map((stage) => ({
      id: stage.id,
      title: stage.title,
      description: stage.description,
      sortOrder: stage.sortOrder,
      itemCount: stage.items.length,
      items: stage.items.map((item): CurriculumStageItemDetail => ({
        id: item.id,
        itemType: item.itemType,
        contentId: item.contentId,
        assessmentPoolId: item.assessmentPoolId,
        sortOrder: item.sortOrder,
        isRequired: item.isRequired,
        referenceCode: item.assessmentPool?.code ?? null,
        referenceTitle: item.content?.title ?? item.assessmentPool?.title ?? "Untitled item",
        referenceDescription: item.content?.description ?? item.assessmentPool?.description ?? null,
        courseName: item.content?.course.name ?? detail.course.name,
        status: item.content?.status ?? item.assessmentPool?.status ?? null,
        contentType: item.content?.contentType ?? null,
        questionType: item.assessmentPool?.questionType ?? null,
        difficultyLevel: item.assessmentPool?.difficultyLevel ?? null,
        folderName: item.content?.folder?.name ?? null,
        progressStatus: "NOT_STARTED",
        progressPercent: 0,
        startedAt: null,
        completedAt: null,
        availabilityStatus: "AVAILABLE",
        availabilityReason: {
          type: "AVAILABLE_NOW",
          message: "Available now.",
          unlocksAt: null,
          prerequisiteStageItemId: null,
          prerequisiteTitle: null,
          requiredScorePercent: null,
          batchOffsetDays: null,
        },
        release: {
          releaseType: item.releaseConfig?.releaseType ?? "IMMEDIATE",
          releaseAt: item.releaseConfig?.releaseAt ?? null,
          releaseOffsetDays: item.releaseConfig?.releaseOffsetDays ?? null,
          prerequisiteStageItemId: item.releaseConfig?.prerequisiteStageItemId ?? null,
          prerequisiteTitle: null,
          minimumScorePercent: item.releaseConfig?.minimumScorePercent ?? null,
          estimatedDurationMinutes: item.releaseConfig?.estimatedDurationMinutes ?? null,
          dueAt: item.releaseConfig?.dueAt ?? null,
          dueOffsetDays: item.releaseConfig?.dueOffsetDays ?? null,
          resolvedUnlockAt: null,
          resolvedDueAt: null,
        },
        batchManualRelease: null,
      })),
    }));

    return {
      id: moduleRecord.id,
      title: moduleRecord.title,
      description: moduleRecord.description,
      sortOrder: moduleRecord.sortOrder,
      stageCount: stages.length,
      itemCount: stages.reduce((sum, stage) => sum + stage.itemCount, 0),
      stages,
    };
  });

  const counts = buildCurriculumCounts(detail.modules);

  return {
    id: detail.id,
    courseId: detail.courseId,
    courseCode: detail.course.code,
    courseName: detail.course.name,
    title: detail.title,
    description: detail.description,
    status: detail.status,
    moduleCount: counts.moduleCount,
    stageCount: counts.stageCount,
    itemCount: counts.itemCount,
    batchCount: detail._count.batchMappings,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    createdByName: detail.createdBy?.name ?? null,
    modules,
  };
}

export async function listCurriculaByCourseService(courseId: string): Promise<CurriculumSummary[]> {
  if (!isDatabaseConfigured) {
    return [];
  }

  const curricula = await prisma.curriculum.findMany({
    where: { courseId },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      courseId: true,
      title: true,
      description: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      course: { select: { code: true, name: true } },
      modules: {
        select: {
          id: true,
          stages: {
            select: {
              id: true,
              _count: { select: { items: true } },
            },
          },
        },
      },
      _count: {
        select: {
          batchMappings: true,
        },
      },
    },
  });

  return curricula.map((curriculum) => mapCurriculumSummary(curriculum));
}

export async function getCurriculumByIdService(curriculumId: string): Promise<CurriculumDetail | null> {
  if (!isDatabaseConfigured) {
    return null;
  }

  const curriculum = await prisma.curriculum.findUnique({
    where: { id: curriculumId },
    select: {
      id: true,
      courseId: true,
      title: true,
      description: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      course: { select: { code: true, name: true } },
      createdBy: { select: { name: true } },
      modules: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          sortOrder: true,
          stages: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              title: true,
              description: true,
              sortOrder: true,
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
                      prerequisiteStageItemId: true,
                      minimumScorePercent: true,
                      estimatedDurationMinutes: true,
                      dueAt: true,
                      dueOffsetDays: true,
                    },
                  },
                  content: {
                    select: {
                      title: true,
                      description: true,
                      contentType: true,
                      status: true,
                      folder: { select: { name: true } },
                      course: { select: { name: true } },
                    },
                  },
                  assessmentPool: {
                    select: {
                      code: true,
                      title: true,
                      description: true,
                      questionType: true,
                      difficultyLevel: true,
                      status: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      _count: {
        select: {
          batchMappings: true,
        },
      },
    },
  });

  return curriculum ? mapCurriculum(curriculum) : null;
}

export async function getCurriculumBatchMappingsService(curriculumId: string): Promise<CurriculumBatchMappingItem[]> {
  if (!isDatabaseConfigured) {
    return [];
  }

  const curriculum = await prisma.curriculum.findUnique({
    where: { id: curriculumId },
    select: {
      id: true,
      courseId: true,
      status: true,
    },
  });

  if (!curriculum) {
    throw new Error("Curriculum not found.");
  }

  const batches = await prisma.batch.findMany({
    where: {
      program: {
        courseId: curriculum.courseId,
      },
    },
    orderBy: [{ startDate: "desc" }, { code: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      campus: true,
      status: true,
      startDate: true,
      endDate: true,
      program: {
        select: {
          id: true,
          name: true,
        },
      },
      batchCurriculumMappings: {
        where: {
          curriculumId,
        },
        take: 1,
        select: {
          id: true,
          assignedAt: true,
          assignedBy: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  return batches.map((batch) => {
    const mapping = batch.batchCurriculumMappings[0] ?? null;
    const isInheritedFromCourse = curriculum.status === "PUBLISHED";
    const isBatchMapped = Boolean(mapping);
    const assignmentSource = resolveCurriculumAssignmentSource({
      isInheritedFromCourse,
      isBatchMapped,
    });

    return {
      mappingId: mapping?.id ?? null,
      batchId: batch.id,
      batchCode: batch.code,
      batchName: batch.name,
      programId: batch.program.id,
      programName: batch.program.name,
      campus: batch.campus,
      status: batch.status,
      startDate: batch.startDate,
      endDate: batch.endDate,
      isMapped: isBatchMapped,
      hasEffectiveAccess: isInheritedFromCourse || isBatchMapped,
      assignedAt: mapping?.assignedAt ?? null,
      assignedByName: mapping?.assignedBy?.name ?? null,
      assignmentSource,
      isInheritedFromCourse,
      canRemoveBatchMapping: isBatchMapped,
      canAddBatchMapping: !isInheritedFromCourse && !isBatchMapped,
    };
  });
}

export async function getCurriculaForBatchService(batchId: string, options?: GetCurriculaForBatchOptions): Promise<BatchCurriculumWorkspace> {
  if (!isDatabaseConfigured) {
    const batch = MOCK_BATCHES.find((item) => item.id === batchId);

    if (!batch) {
      throw new Error("Batch not found.");
    }

    return {
      batchId: batch.id,
      batchCode: batch.code,
      batchName: batch.name,
      programId: null,
      programName: batch.programName,
      courseId: null,
      courseCode: null,
      courseName: null,
      assignedCurricula: [],
      availableCurricula: [],
    };
  }

  const batch = await getBatchCourseContext(batchId);

  if (!batch) {
    throw new Error("Batch not found.");
  }

  const [mappedCurricula, courseCurricula] = await Promise.all([
    prisma.batchCurriculumMapping.findMany({
      where: {
        batchId,
        ...(options?.publishedOnly ? { curriculum: { is: { status: "PUBLISHED" } } } : {}),
      },
      orderBy: [{ assignedAt: "desc" }],
      select: {
        id: true,
        assignedAt: true,
        assignedBy: {
          select: {
            name: true,
          },
        },
        curriculum: {
          select: {
            id: true,
          },
        },
      },
    }),
    listCurriculaByCourseService(batch.courseId),
  ]);

  const mappedByCurriculumId = new Map(mappedCurricula.map((mapping) => [mapping.curriculum.id, mapping]));
  const inheritedCurricula = courseCurricula.filter((curriculum) => curriculum.status === "PUBLISHED");
  const detailMap = await getCurriculumDetailMap([
    ...inheritedCurricula.map((curriculum) => curriculum.id),
    ...mappedCurricula.map((mapping) => mapping.curriculum.id),
  ]);
  const stageItemIds = Array.from(new Set(
    Array.from(detailMap.values()).flatMap((curriculum) => collectCurriculumStageItemIds(curriculum)),
  ));
  const manualReleaseByStageItemId = new Map<string, BatchManualReleaseSnapshot>();

  if (stageItemIds.length > 0) {
    const manualReleaseRecords = await prisma.batchCurriculumStageItemRelease.findMany({
      where: {
        batchId,
        stageItemId: {
          in: stageItemIds,
        },
      },
      select: {
        stageItemId: true,
        releasedAt: true,
        releasedById: true,
        note: true,
      },
    });

    const releaserIds = Array.from(new Set(
      manualReleaseRecords.flatMap((record) => record.releasedById ? [record.releasedById] : []),
    ));
    const releaserNameById = releaserIds.length === 0
      ? new Map<string, string | null>()
      : new Map((await prisma.user.findMany({
        where: {
          id: {
            in: releaserIds,
          },
        },
        select: {
          id: true,
          name: true,
        },
      })).map((user) => [user.id, user.name ?? null]));

    for (const record of manualReleaseRecords) {
      manualReleaseByStageItemId.set(record.stageItemId, {
        isReleased: true,
        releasedAt: record.releasedAt,
        releasedByName: record.releasedById ? (releaserNameById.get(record.releasedById) ?? null) : null,
        note: record.note ?? null,
      });
    }
  }

  const inheritedAssignments = inheritedCurricula
    .map((curriculumSummary): BatchAssignedCurriculumDetail | null => {
      const curriculum = detailMap.get(curriculumSummary.id);

      if (!curriculum) {
        return null;
      }

      const mapping = mappedByCurriculumId.get(curriculumSummary.id);

      if (mapping) {
        mappedByCurriculumId.delete(curriculumSummary.id);
      }

      return {
        mappingId: mapping?.id ?? buildSyntheticCurriculumMappingId(batch.batchId, curriculum.id),
        assignedAt: mapping?.assignedAt ?? curriculum.createdAt,
        assignedByName: mapping?.assignedBy?.name ?? null,
        assignmentSource: resolveCurriculumAssignmentSource({
          isInheritedFromCourse: true,
          isBatchMapped: Boolean(mapping),
        }),
        isInheritedFromCourse: true,
        isBatchMapped: Boolean(mapping),
        canRemoveBatchMapping: Boolean(mapping),
        curriculum: applyBatchManualReleaseStateToCurriculum(curriculum, manualReleaseByStageItemId),
      };
    })
    .filter((item): item is BatchAssignedCurriculumDetail => Boolean(item));

  const batchOnlyAssignments = Array.from(mappedByCurriculumId.values())
    .map((mapping): BatchAssignedCurriculumDetail | null => {
      const curriculum = detailMap.get(mapping.curriculum.id);

      if (!curriculum) {
        return null;
      }

      return {
        mappingId: mapping.id,
        assignedAt: mapping.assignedAt,
        assignedByName: mapping.assignedBy?.name ?? null,
        assignmentSource: resolveCurriculumAssignmentSource({
          isInheritedFromCourse: false,
          isBatchMapped: true,
        }),
        isInheritedFromCourse: false,
        isBatchMapped: true,
        canRemoveBatchMapping: true,
        curriculum: applyBatchManualReleaseStateToCurriculum(curriculum, manualReleaseByStageItemId),
      };
    })
    .filter((item): item is BatchAssignedCurriculumDetail => Boolean(item));

  const mappedCurriculumIds = new Set(mappedCurricula.map((mapping) => mapping.curriculum.id));
  const availableCurricula = options?.publishedOnly
    ? []
    : courseCurricula.filter((curriculum) => curriculum.status !== "PUBLISHED" && !mappedCurriculumIds.has(curriculum.id));

  return {
    batchId: batch.batchId,
    batchCode: batch.batchCode,
    batchName: batch.batchName,
    programId: batch.programId,
    programName: batch.programName ?? null,
    courseId: batch.courseId,
    courseCode: batch.courseCode,
    courseName: batch.courseName,
    assignedCurricula: [...inheritedAssignments, ...batchOnlyAssignments],
    availableCurricula,
  };
}

export async function getCandidateCurriculaForBatchService(options: {
  batchId: string;
  learnerId: string;
}): Promise<BatchCurriculumWorkspace> {
  const workspace = await getCurriculaForBatchService(options.batchId, { publishedOnly: true });
  const batch = await getBatchCourseContext(options.batchId);
  const stageItemIds = Array.from(new Set(
    workspace.assignedCurricula.flatMap((assignment) => collectCurriculumStageItemIds(assignment.curriculum)),
  ));

  if (!batch || stageItemIds.length === 0) {
    return {
      ...workspace,
      availableCurricula: [],
    };
  }

  const assessmentPoolIds = Array.from(new Set(
    workspace.assignedCurricula.flatMap((assignment) => collectCurriculumAssessmentPoolIds(assignment.curriculum)),
  ));

  const [progressRecords, manualReleases, assessmentAttempts] = await Promise.all([
    listCurriculumItemProgressForLearnerService({
      learnerId: options.learnerId,
      batchId: options.batchId,
      stageItemIds,
    }),
    prisma.batchCurriculumStageItemRelease.findMany({
      where: {
        batchId: options.batchId,
        stageItemId: {
          in: stageItemIds,
        },
      },
      select: {
        stageItemId: true,
        releasedAt: true,
      },
    }),
    assessmentPoolIds.length === 0
      ? Promise.resolve([])
      : prisma.assessmentAttempt.findMany({
        where: {
          learnerId: options.learnerId,
          batchId: options.batchId,
          assessmentPoolId: {
            in: assessmentPoolIds,
          },
        },
        orderBy: [{ gradedAt: "desc" }, { submittedAt: "desc" }, { startedAt: "desc" }],
        select: {
          assessmentPoolId: true,
          percentage: true,
        },
      }),
  ]);

  const progressByStageItemId = new Map(progressRecords.map((record) => [record.stageItemId, record]));
  const manualReleaseAtByStageItemId = new Map(manualReleases.map((record) => [record.stageItemId, record.releasedAt]));
  const scoreByAssessmentPoolId = new Map<string, number | null>();

  for (const attempt of assessmentAttempts) {
    if (!scoreByAssessmentPoolId.has(attempt.assessmentPoolId)) {
      scoreByAssessmentPoolId.set(attempt.assessmentPoolId, attempt.percentage ?? null);
    }
  }

  return {
    ...workspace,
    availableCurricula: [],
    assignedCurricula: workspace.assignedCurricula.map((assignment) => ({
      ...assignment,
      curriculum: applyLearnerStateToCurriculum(assignment.curriculum, {
        batchStartDate: batch.startDate,
        progressByStageItemId,
        scoreByStageItemId: new Map(
          assignment.curriculum.modules.flatMap((moduleRecord) =>
            moduleRecord.stages.flatMap((stage) =>
              stage.items.map((item) => [item.id, item.assessmentPoolId ? (scoreByAssessmentPoolId.get(item.assessmentPoolId) ?? null) : null] as const),
            ),
          ),
        ),
        manualReleaseAtByStageItemId,
      }),
    })),
  };
}