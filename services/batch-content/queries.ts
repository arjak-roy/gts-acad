import "server-only";

import { LearningResourceTargetType } from "@prisma/client";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { getBatchCourseContext } from "@/services/lms/hierarchy";
import type { BatchAssessmentItem, BatchAvailableContentItem, BatchContentItem, BatchAssignmentSource } from "@/services/batch-content/types";
import type { ContentListItem } from "@/services/course-content/types";
import type { AssessmentPoolListItem } from "@/services/assessment-pool/types";

type ListBatchItemsOptions = {
  publishedOnly?: boolean;
  includeAssignedResources?: boolean;
};

type SharedAssignmentBatchContentRecord = {
  id: string;
  targetType: LearningResourceTargetType;
  assignedAt: Date;
  assignedBy: { name: string } | null;
  resource: {
    id: string;
    sourceContent: {
      id: string;
      title: string;
      description: string | null;
      excerpt: string | null;
      contentType: ContentListItem["contentType"];
      status: ContentListItem["status"];
      estimatedReadingMinutes: number | null;
      fileUrl: string | null;
      fileName: string | null;
      mimeType: string | null;
    } | null;
  };
};

function resolveAssignmentSource(options: {
  isInheritedFromCourse: boolean;
  isBatchMapped: boolean;
}): BatchAssignmentSource {
  if (options.isInheritedFromCourse && options.isBatchMapped) {
    return "COURSE_AND_BATCH";
  }

  if (options.isBatchMapped) {
    return "BATCH";
  }

  return "COURSE";
}

function mapSharedAssignmentToBatchContentItem(
  batchId: string,
  assignment: SharedAssignmentBatchContentRecord,
): BatchContentItem | null {
  const sourceContent = assignment.resource.sourceContent;

  if (!sourceContent) {
    return null;
  }

  return {
    id: `assignment:${assignment.id}`,
    batchId,
    contentId: sourceContent.id,
    resourceId: assignment.resource.id,
    resourceAssignmentId: assignment.targetType === "BATCH" ? assignment.id : null,
    contentTitle: sourceContent.title,
    contentDescription: sourceContent.description,
    contentExcerpt: sourceContent.excerpt,
    contentType: sourceContent.contentType,
    contentStatus: sourceContent.status,
    folderName: null,
    estimatedReadingMinutes: sourceContent.estimatedReadingMinutes,
    fileUrl: sourceContent.fileUrl,
    fileName: sourceContent.fileName,
    mimeType: sourceContent.mimeType,
    assignedByName: assignment.assignedBy?.name ?? null,
    assignedAt: assignment.assignedAt,
    assignmentSource: assignment.targetType === "BATCH" ? "BATCH" : "COURSE",
    isInheritedFromCourse: assignment.targetType === "COURSE",
    isBatchMapped: assignment.targetType === "BATCH",
    canRemoveBatchMapping: assignment.targetType === "BATCH",
  };
}

async function listAssignedContentForBatchService(
  batchId: string,
  courseId: string,
  options?: ListBatchItemsOptions,
): Promise<BatchContentItem[]> {
  const assignments = await prisma.learningResourceAssignment.findMany({
    where: {
      OR: [
        {
          targetType: "BATCH",
          targetId: batchId,
        },
        {
          targetType: "COURSE",
          targetId: courseId,
        },
      ],
      resource: {
        sourceContentId: {
          not: null,
        },
      },
    },
    orderBy: {
      assignedAt: "desc",
    },
    select: {
      id: true,
      targetType: true,
      assignedAt: true,
      assignedBy: {
        select: {
          name: true,
        },
      },
      resource: {
        select: {
          id: true,
          sourceContent: {
            select: {
              id: true,
              title: true,
              description: true,
              excerpt: true,
              contentType: true,
              status: true,
              estimatedReadingMinutes: true,
              fileUrl: true,
              fileName: true,
              mimeType: true,
            },
          },
        },
      },
    },
  });

  const sortedAssignments = [...assignments].sort((left, right) => {
    const leftPriority = left.targetType === "BATCH" ? 0 : 1;
    const rightPriority = right.targetType === "BATCH" ? 0 : 1;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return right.assignedAt.getTime() - left.assignedAt.getTime();
  });

  const itemsByContentId = new Map<string, BatchContentItem>();

  for (const assignment of sortedAssignments) {
    if (assignment.targetType !== "COURSE" && assignment.targetType !== "BATCH") {
      continue;
    }

    const sourceContent = assignment.resource.sourceContent;

    if (!sourceContent) {
      continue;
    }

    if (options?.publishedOnly && sourceContent.status !== "PUBLISHED") {
      continue;
    }

    if (itemsByContentId.has(sourceContent.id)) {
      continue;
    }

    const item = mapSharedAssignmentToBatchContentItem(batchId, assignment);

    if (item) {
      itemsByContentId.set(sourceContent.id, item);
    }
  }

  return Array.from(itemsByContentId.values());
}

export async function listBatchContentService(batchId: string, options?: ListBatchItemsOptions): Promise<BatchContentItem[]> {
  if (!isDatabaseConfigured) return [];

  const batch = await getBatchCourseContext(batchId);

  if (!batch) {
    return [];
  }

  const [mappedContents, inheritedCourseContents] = await Promise.all([
    prisma.batchContentMapping.findMany({
      where: {
        batchId,
        ...(options?.publishedOnly ? { content: { is: { status: "PUBLISHED" } } } : {}),
      },
      orderBy: { assignedAt: "desc" },
      select: {
        id: true,
        batchId: true,
        contentId: true,
        assignedAt: true,
        content: {
          select: {
            title: true,
            description: true,
            excerpt: true,
            contentType: true,
            status: true,
            estimatedReadingMinutes: true,
            fileUrl: true,
            fileName: true,
            mimeType: true,
            course: {
              select: {
                name: true,
              },
            },
            folder: {
              select: {
                name: true,
              },
            },
          },
        },
        assignedBy: { select: { name: true } },
      },
    }),
    prisma.courseContent.findMany({
      where: {
        courseId: batch.courseId,
        status: "PUBLISHED",
      },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        excerpt: true,
        contentType: true,
        status: true,
        estimatedReadingMinutes: true,
        fileUrl: true,
        fileName: true,
        mimeType: true,
        createdAt: true,
        folder: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);
  const assignedItems = options?.includeAssignedResources
    ? await listAssignedContentForBatchService(batchId, batch.courseId, options)
    : [];
  const assignedByContentId = new Map(assignedItems.map((item) => [item.contentId, item]));

  const mappedByContentId = new Map(mappedContents.map((mapping) => [mapping.contentId, mapping]));

  const inheritedItems: BatchContentItem[] = inheritedCourseContents.map((content) => {
    const mapping = mappedByContentId.get(content.id);
    const assignmentItem = assignedByContentId.get(content.id) ?? null;

    if (mapping) {
      mappedByContentId.delete(content.id);
    }

    return {
      id: mapping?.id ?? `course:${batchId}:${content.id}`,
      batchId,
      contentId: content.id,
      resourceId: assignmentItem?.resourceId ?? null,
      resourceAssignmentId: assignmentItem?.resourceAssignmentId ?? null,
      contentTitle: content.title,
      contentDescription: content.description,
      contentExcerpt: content.excerpt,
      contentType: content.contentType,
      contentStatus: content.status,
      folderName: content.folder?.name ?? null,
      estimatedReadingMinutes: content.estimatedReadingMinutes,
      fileUrl: content.fileUrl,
      fileName: content.fileName,
      mimeType: content.mimeType,
      assignedByName: assignmentItem?.assignedByName ?? mapping?.assignedBy?.name ?? null,
      assignedAt: assignmentItem?.assignedAt ? new Date(assignmentItem.assignedAt) : (mapping?.assignedAt ?? content.createdAt),
      assignmentSource: resolveAssignmentSource({
        isInheritedFromCourse: true,
        isBatchMapped: Boolean(mapping) || Boolean(assignmentItem?.resourceAssignmentId),
      }),
      isInheritedFromCourse: true,
      isBatchMapped: Boolean(mapping) || Boolean(assignmentItem?.resourceAssignmentId),
      canRemoveBatchMapping: Boolean(mapping) || Boolean(assignmentItem?.resourceAssignmentId),
    };
  });

  const batchOnlyItems = Array.from(mappedByContentId.values()).map((mapping) => ({
    id: mapping.id,
    batchId: mapping.batchId,
    contentId: mapping.contentId,
    resourceId: null,
    resourceAssignmentId: null,
    contentTitle: mapping.content.title,
    contentDescription: mapping.content.description,
    contentExcerpt: mapping.content.excerpt,
    contentType: mapping.content.contentType,
    contentStatus: mapping.content.status,
    folderName: mapping.content.folder?.name ?? null,
    estimatedReadingMinutes: mapping.content.estimatedReadingMinutes,
    fileUrl: mapping.content.fileUrl,
    fileName: mapping.content.fileName,
    mimeType: mapping.content.mimeType,
    assignedByName: mapping.assignedBy?.name ?? null,
    assignedAt: mapping.assignedAt,
    assignmentSource: resolveAssignmentSource({
      isInheritedFromCourse: false,
      isBatchMapped: true,
    }),
    isInheritedFromCourse: false,
    isBatchMapped: true,
    canRemoveBatchMapping: true,
  }));

  const nativeItems = [...inheritedItems, ...batchOnlyItems];

  if (!options?.includeAssignedResources) {
    return nativeItems;
  }

  const nativeContentIds = new Set(nativeItems.map((item) => item.contentId));
  const overlayItems = assignedItems.filter((item) => !nativeContentIds.has(item.contentId));

  return [...nativeItems, ...overlayItems];
}

export async function listBatchAssessmentsService(batchId: string, options?: ListBatchItemsOptions): Promise<BatchAssessmentItem[]> {
  if (!isDatabaseConfigured) return [];

  const batch = await getBatchCourseContext(batchId);

  if (!batch) {
    return [];
  }

  const [mappedAssessments, inheritedCourseAssessments] = await Promise.all([
    prisma.batchAssessmentMapping.findMany({
      where: {
        batchId,
        ...(options?.publishedOnly ? { assessmentPool: { is: { status: "PUBLISHED" } } } : {}),
      },
      orderBy: { assignedAt: "desc" },
      select: {
        id: true,
        batchId: true,
        assessmentPoolId: true,
        scheduledAt: true,
        assignedAt: true,
        assessmentPool: {
          select: {
            title: true,
            code: true,
            questionType: true,
            difficultyLevel: true,
            status: true,
            totalMarks: true,
            timeLimitMinutes: true,
            _count: { select: { questions: true } },
          },
        },
        assignedBy: { select: { name: true } },
      },
    }),
    prisma.courseAssessmentLink.findMany({
      where: {
        courseId: batch.courseId,
        assessmentPool: {
          is: {
            status: "PUBLISHED",
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        assessmentPoolId: true,
        createdAt: true,
        assessmentPool: {
          select: {
            title: true,
            code: true,
            questionType: true,
            difficultyLevel: true,
            status: true,
            totalMarks: true,
            timeLimitMinutes: true,
            _count: { select: { questions: true } },
          },
        },
      },
    }),
  ]);

  const mappedByPoolId = new Map(mappedAssessments.map((mapping) => [mapping.assessmentPoolId, mapping]));

  const inheritedItems: BatchAssessmentItem[] = inheritedCourseAssessments.map((link) => {
    const mapping = mappedByPoolId.get(link.assessmentPoolId);

    if (mapping) {
      mappedByPoolId.delete(link.assessmentPoolId);
    }

    return {
      id: mapping?.id ?? link.id,
      batchId,
      assessmentPoolId: link.assessmentPoolId,
      assessmentTitle: link.assessmentPool.title,
      assessmentCode: link.assessmentPool.code,
      questionType: link.assessmentPool.questionType,
      difficultyLevel: link.assessmentPool.difficultyLevel,
      status: link.assessmentPool.status,
      questionCount: link.assessmentPool._count.questions,
      totalMarks: link.assessmentPool.totalMarks,
      timeLimitMinutes: link.assessmentPool.timeLimitMinutes,
      assignedByName: mapping?.assignedBy?.name ?? null,
      scheduledAt: mapping?.scheduledAt ?? null,
      assignedAt: mapping?.assignedAt ?? link.createdAt,
      assignmentSource: resolveAssignmentSource({
        isInheritedFromCourse: true,
        isBatchMapped: Boolean(mapping),
      }),
      isInheritedFromCourse: true,
      isBatchMapped: Boolean(mapping),
      canRemoveBatchMapping: Boolean(mapping),
    };
  });

  const batchOnlyItems = Array.from(mappedByPoolId.values()).map((mapping) => ({
    id: mapping.id,
    batchId: mapping.batchId,
    assessmentPoolId: mapping.assessmentPoolId,
    assessmentTitle: mapping.assessmentPool.title,
    assessmentCode: mapping.assessmentPool.code,
    questionType: mapping.assessmentPool.questionType,
    difficultyLevel: mapping.assessmentPool.difficultyLevel,
    status: mapping.assessmentPool.status,
    questionCount: mapping.assessmentPool._count.questions,
    totalMarks: mapping.assessmentPool.totalMarks,
    timeLimitMinutes: mapping.assessmentPool.timeLimitMinutes,
    assignedByName: mapping.assignedBy?.name ?? null,
    scheduledAt: mapping.scheduledAt,
    assignedAt: mapping.assignedAt,
    assignmentSource: resolveAssignmentSource({
      isInheritedFromCourse: false,
      isBatchMapped: true,
    }),
    isInheritedFromCourse: false,
    isBatchMapped: true,
    canRemoveBatchMapping: true,
  }));

  return [...inheritedItems, ...batchOnlyItems];
}

export async function getAvailableContentForBatchService(
  batchId: string,
): Promise<BatchAvailableContentItem[]> {
  if (!isDatabaseConfigured) return [];

  const batch = await getBatchCourseContext(batchId);

  if (!batch) return [];

  const [existingAssignments, resources] = await Promise.all([
    prisma.learningResourceAssignment.findMany({
      where: {
        OR: [
          { targetType: "COURSE", targetId: batch.courseId },
          { targetType: "BATCH", targetId: batchId },
        ],
      },
      select: {
        resourceId: true,
      },
    }),
    prisma.learningResource.findMany({
      where: {
        deletedAt: null,
        status: "PUBLISHED",
      },
      orderBy: [{ title: "asc" }],
      select: {
        id: true,
        sourceContentId: true,
        title: true,
        contentType: true,
        fileName: true,
        folder: { select: { name: true } },
        sourceContent: {
          select: {
            courseId: true,
            status: true,
            course: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const excludedResourceIds = new Set(existingAssignments.map((assignment) => assignment.resourceId));

  return resources
    .filter((resource) => {
      if (excludedResourceIds.has(resource.id)) {
        return false;
      }

      if (resource.sourceContent?.courseId === batch.courseId && resource.sourceContent.status === "PUBLISHED") {
        return false;
      }

      return true;
    })
    .map((resource) => ({
      id: resource.id,
      sourceContentId: resource.sourceContentId,
      title: resource.title,
      contentType: resource.contentType,
      fileName: resource.fileName,
      folderName: resource.folder?.name ?? null,
      sourceCourseName: resource.sourceContent?.course.name ?? null,
      hasSourceContent: Boolean(resource.sourceContentId),
    }));
}

export async function getAvailableAssessmentsForBatchService(
  batchId: string,
): Promise<AssessmentPoolListItem[]> {
  if (!isDatabaseConfigured) return [];

  const batch = await getBatchCourseContext(batchId);

  if (!batch) return [];

  const [assignedMappings, inheritedCourseLinks] = await Promise.all([
    prisma.batchAssessmentMapping.findMany({
      where: { batchId },
      select: { assessmentPoolId: true },
    }),
    prisma.courseAssessmentLink.findMany({
      where: { courseId: batch.courseId },
      select: { assessmentPoolId: true },
    }),
  ]);

  const excludedIds = new Set([
    ...assignedMappings.map((mapping) => mapping.assessmentPoolId),
    ...inheritedCourseLinks.map((link) => link.assessmentPoolId),
  ]);

  const pools = await prisma.assessmentPool.findMany({
    where: {
      status: "PUBLISHED",
      id: { notIn: [...excludedIds] },
      OR: [
        { courseAssessmentLinks: { some: { courseId: batch.courseId } } },
        { courseAssessmentLinks: { none: {} } },
      ],
    },
    orderBy: { title: "asc" },
    select: {
      id: true,
      code: true,
      title: true,
      description: true,
      questionType: true,
      difficultyLevel: true,
      totalMarks: true,
      passingMarks: true,
      timeLimitMinutes: true,
      status: true,
      isAiGenerated: true,
      createdAt: true,
      _count: { select: { questions: true, courseAssessmentLinks: true } },
    },
  });

  return pools.map((p) => ({
    id: p.id,
    code: p.code,
    title: p.title,
    description: p.description,
    questionType: p.questionType,
    difficultyLevel: p.difficultyLevel,
    totalMarks: p.totalMarks,
    passingMarks: p.passingMarks,
    timeLimitMinutes: p.timeLimitMinutes,
    status: p.status,
    isAiGenerated: p.isAiGenerated,
    questionCount: p._count.questions,
    courseLinksCount: p._count.courseAssessmentLinks,
    createdAt: p.createdAt,
  }));
}
