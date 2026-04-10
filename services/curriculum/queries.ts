import "server-only";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { listCurriculumItemProgressForLearnerService } from "@/services/curriculum/progress";
import { getBatchCourseContext } from "@/services/lms/hierarchy";
import { MOCK_BATCHES } from "@/services/batches/mock-data";
import type {
  BatchAssignedCurriculumDetail,
  BatchCurriculumWorkspace,
  CurriculumAssignmentSource,
  CurriculumBatchMappingItem,
  CurriculumDetail,
  CurriculumSummary,
} from "@/services/curriculum/types";

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
          questionType: "MCQ" | "NUMERIC" | "ESSAY" | "FILL_IN_THE_BLANK" | "MULTI_INPUT_REASONING" | "TWO_PART_ANALYSIS";
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

function applyProgressToCurriculum(
  curriculum: CurriculumDetail,
  progressByStageItemId: Map<string, { status: string }>,
): CurriculumDetail {
  return {
    ...curriculum,
    modules: curriculum.modules.map((moduleRecord) => ({
      ...moduleRecord,
      stages: moduleRecord.stages.map((stage) => ({
        ...stage,
        items: stage.items.map((item) => ({
          ...item,
          status: progressByStageItemId.get(item.id)?.status ?? "NOT_STARTED",
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
      items: stage.items.map((item) => ({
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
        curriculum,
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
        curriculum,
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
  const stageItemIds = Array.from(new Set(
    workspace.assignedCurricula.flatMap((assignment) => collectCurriculumStageItemIds(assignment.curriculum)),
  ));

  if (stageItemIds.length === 0) {
    return {
      ...workspace,
      availableCurricula: [],
    };
  }

  const progressRecords = await listCurriculumItemProgressForLearnerService({
    learnerId: options.learnerId,
    batchId: options.batchId,
    stageItemIds,
  });

  const progressByStageItemId = new Map(progressRecords.map((record) => [record.stageItemId, record]));

  return {
    ...workspace,
    availableCurricula: [],
    assignedCurricula: workspace.assignedCurricula.map((assignment) => ({
      ...assignment,
      curriculum: applyProgressToCurriculum(assignment.curriculum, progressByStageItemId),
    })),
  };
}