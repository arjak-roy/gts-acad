import "server-only";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { parseAuthoredContentAnyDocument } from "@/lib/authored-content";
import { getCandidateCurriculaForBatchService } from "@/services/curriculum/queries";
import { markCurriculumContentCompletedForLearnerService } from "@/services/curriculum/progress";
import { listCourseIdsForBatchIds } from "@/services/lms/hierarchy";
import { getCandidateProfileByUserIdService } from "@/services/learners-service";
import { listLearningResourceVersionsService, type LearningResourceVersionDetail } from "@/services/learning-resource-service";
import type {
  AssignedSharedContentListItem,
  CandidateContentAccessContext,
  CandidateContentAccessResult,
  CandidateContentDetail,
  ContentDetail,
  ContentListItem,
} from "@/services/course-content/types";

type SharedContentSourceRecord = {
  id: string;
  courseId: string;
  folderId: string | null;
  title: string;
  description: string | null;
  excerpt: string | null;
  contentType: ContentListItem["contentType"];
  estimatedReadingMinutes: number | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  storagePath: string | null;
  storageProvider: ContentListItem["storageProvider"];
  sortOrder: number;
  status: ContentListItem["status"];
  isScorm: boolean;
  createdAt: Date;
  folder: { name: string } | null;
  course: { name: string };
};

function mapSharedContentToCourseItem(args: {
  sourceContent: SharedContentSourceRecord;
  targetCourseId: string;
  targetCourseName: string;
  resourceId: string;
  resourceStatus: AssignedSharedContentListItem["resourceStatus"];
  resourceVisibility: AssignedSharedContentListItem["resourceVisibility"];
  assignedAt: Date;
  folderId: string | null;
  folderName: string | null;
  shareKind: AssignedSharedContentListItem["shareKind"];
}): AssignedSharedContentListItem {
  const { sourceContent } = args;

  return {
    id: sourceContent.id,
    courseId: args.targetCourseId,
    courseName: args.targetCourseName,
    folderId: args.folderId,
    folderName: args.folderName,
    title: sourceContent.title,
    description: sourceContent.description,
    excerpt: sourceContent.excerpt,
    contentType: sourceContent.contentType,
    estimatedReadingMinutes: sourceContent.estimatedReadingMinutes,
    fileUrl: sourceContent.fileUrl,
    fileName: sourceContent.fileName,
    fileSize: sourceContent.fileSize,
    mimeType: sourceContent.mimeType,
    storagePath: sourceContent.storagePath,
    storageProvider: sourceContent.storageProvider,
    sortOrder: sourceContent.sortOrder,
    status: sourceContent.status,
    isScorm: sourceContent.isScorm,
    createdAt: sourceContent.createdAt,
    targetCourseId: args.targetCourseId,
    sourceCourseId: sourceContent.courseId,
    sourceCourseName: sourceContent.course.name,
    sourceFolderId: sourceContent.folderId,
    sourceFolderName: sourceContent.folder?.name ?? null,
    resourceId: args.resourceId,
    resourceStatus: args.resourceStatus,
    resourceVisibility: args.resourceVisibility,
    assignedAt: args.assignedAt,
    isSharedAssignment: true,
    shareKind: args.shareKind,
  };
}

function dedupeCandidateContentContexts(contexts: CandidateContentAccessContext[]) {
  return Array.from(
    new Map(contexts.map((context) => [`${context.batchId}:${context.stageItemId}`, context])).values(),
  );
}

function compareCandidateContentContext(
  left: CandidateContentAccessContext,
  right: CandidateContentAccessContext,
) {
  const leftStatusRank = left.availabilityStatus === "AVAILABLE" ? 0 : left.availabilityStatus === "LOCKED" ? 1 : 2;
  const rightStatusRank = right.availabilityStatus === "AVAILABLE" ? 0 : right.availabilityStatus === "LOCKED" ? 1 : 2;

  if (leftStatusRank !== rightStatusRank) {
    return leftStatusRank - rightStatusRank;
  }

  const leftUnlockAt = left.availabilityReason.unlocksAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const rightUnlockAt = right.availabilityReason.unlocksAt?.getTime() ?? Number.MAX_SAFE_INTEGER;

  if (leftUnlockAt !== rightUnlockAt) {
    return leftUnlockAt - rightUnlockAt;
  }

  return `${left.batchId}:${left.stageItemId}`.localeCompare(`${right.batchId}:${right.stageItemId}`);
}

function selectBlockingCandidateContentContext(contexts: CandidateContentAccessContext[]) {
  const blockingContexts = contexts.filter((context) => context.availabilityStatus !== "AVAILABLE");

  if (blockingContexts.length === 0) {
    return null;
  }

  return [...blockingContexts].sort(compareCandidateContentContext)[0] ?? null;
}

export async function resolveCandidateCurriculumContentContextsService(options: {
  learnerId: string;
  batchIds: string[];
  contentId: string;
}): Promise<CandidateContentAccessContext[]> {
  if (!isDatabaseConfigured || options.batchIds.length === 0) {
    return [];
  }

  const workspaces = await Promise.all(
    Array.from(new Set(options.batchIds)).map((batchId) => getCandidateCurriculaForBatchService({
      batchId,
      learnerId: options.learnerId,
    })),
  );

  const contexts = workspaces.flatMap((workspace) => workspace.assignedCurricula.flatMap((assignment) =>
    assignment.curriculum.modules.flatMap((moduleRecord) =>
      moduleRecord.stages.flatMap((stage) =>
        stage.items.flatMap((item) => item.itemType === "CONTENT" && item.contentId === options.contentId
          ? [{
              batchId: workspace.batchId,
              batchCode: workspace.batchCode,
              batchName: workspace.batchName,
              curriculumId: assignment.curriculum.id,
              curriculumTitle: assignment.curriculum.title,
              moduleId: moduleRecord.id,
              moduleTitle: moduleRecord.title,
              stageId: stage.id,
              stageTitle: stage.title,
              stageItemId: item.id,
              itemTitle: item.referenceTitle,
              availabilityStatus: item.availabilityStatus,
              availabilityReason: item.availabilityReason,
              progressStatus: item.progressStatus,
              progressPercent: item.progressPercent,
            } satisfies CandidateContentAccessContext]
          : []),
      ),
    ),
  ));

  return dedupeCandidateContentContexts(contexts).sort(compareCandidateContentContext);
}

export type CourseContentSearchItem = {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  contentType: string;
  status: string;
  courseName: string;
};

export async function searchCourseContentService(query: string, limit: number): Promise<CourseContentSearchItem[]> {
  if (!isDatabaseConfigured) return [];

  try {
    const items = await prisma.courseContent.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { excerpt: { contains: query, mode: "insensitive" } },
          { course: { name: { contains: query, mode: "insensitive" } } },
        ],
      },
      orderBy: [{ updatedAt: "desc" }],
      take: limit,
      select: {
        id: true,
        courseId: true,
        title: true,
        description: true,
        contentType: true,
        status: true,
        course: { select: { name: true } },
      },
    });

    return items.map((item) => ({
      id: item.id,
      courseId: item.courseId,
      title: item.title,
      description: item.description,
      contentType: item.contentType,
      status: item.status,
      courseName: item.course.name,
    }));
  } catch (error) {
    console.warn("Course content search fallback activated", error);
    return [];
  }
}

export async function listCourseContentService(courseId?: string, folderId?: string): Promise<ContentListItem[]> {
  if (!isDatabaseConfigured) {
    return [];
  }

  const where: {
    courseId?: string;
    folderId?: string;
  } = {};

  if (courseId) {
    where.courseId = courseId;
  }

  if (folderId) {
    where.folderId = folderId;
  }

  const contents = await prisma.courseContent.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      courseId: true,
      folderId: true,
      title: true,
      description: true,
      excerpt: true,
      contentType: true,
      estimatedReadingMinutes: true,
      fileUrl: true,
      fileName: true,
      fileSize: true,
      mimeType: true,
      storagePath: true,
      storageProvider: true,
      sortOrder: true,
      status: true,
      isScorm: true,
      createdAt: true,
      folder: { select: { name: true } },
      course: { select: { name: true } },
    },
  });

  return contents.map((c) => ({
    id: c.id,
    courseId: c.courseId,
    courseName: c.course.name,
    folderId: c.folderId,
    folderName: c.folder?.name ?? null,
    title: c.title,
    description: c.description,
    excerpt: c.excerpt,
    contentType: c.contentType,
    estimatedReadingMinutes: c.estimatedReadingMinutes,
    fileUrl: c.fileUrl,
    fileName: c.fileName,
    fileSize: c.fileSize,
    mimeType: c.mimeType,
    storagePath: c.storagePath,
    storageProvider: c.storageProvider,
    sortOrder: c.sortOrder,
    status: c.status,
    isScorm: c.isScorm,
    createdAt: c.createdAt,
  }));
}

export async function getContentByIdService(contentId: string): Promise<ContentDetail | null> {
  if (!isDatabaseConfigured) {
    return null;
  }

  const content = await prisma.courseContent.findUnique({
    where: { id: contentId },
    select: {
      id: true,
      courseId: true,
      folderId: true,
      title: true,
      description: true,
      excerpt: true,
      contentType: true,
      bodyJson: true,
      renderedHtml: true,
      estimatedReadingMinutes: true,
      fileUrl: true,
      fileName: true,
      fileSize: true,
      mimeType: true,
      storagePath: true,
      storageProvider: true,
      sortOrder: true,
      status: true,
      isScorm: true,
      scormMetadata: true,
      isAiGenerated: true,
      aiGenerationMetadata: true,
      createdAt: true,
      updatedAt: true,
      folder: { select: { name: true } },
      course: { select: { name: true } },
      createdBy: { select: { name: true } },
      learningResource: { select: { id: true, currentVersionNumber: true } },
      _count: { select: { batchContentMappings: true } },
    },
  });

  if (!content) return null;

  return {
    id: content.id,
    courseId: content.courseId,
    courseName: content.course.name,
    folderId: content.folderId,
    folderName: content.folder?.name ?? null,
    title: content.title,
    description: content.description,
    excerpt: content.excerpt,
    contentType: content.contentType,
    bodyJson: parseAuthoredContentAnyDocument(content.bodyJson),
    renderedHtml: content.renderedHtml,
    estimatedReadingMinutes: content.estimatedReadingMinutes,
    fileUrl: content.fileUrl,
    fileName: content.fileName,
    fileSize: content.fileSize,
    mimeType: content.mimeType,
    storagePath: content.storagePath,
    storageProvider: content.storageProvider,
    sortOrder: content.sortOrder,
    status: content.status,
    isScorm: content.isScorm,
    scormMetadata: content.scormMetadata,
    isAiGenerated: content.isAiGenerated,
    aiGenerationMetadata: content.aiGenerationMetadata,
    createdByName: content.createdBy?.name ?? null,
    linkedResourceId: content.learningResource?.id ?? null,
    linkedResourceCurrentVersionNumber: content.learningResource?.currentVersionNumber ?? null,
    createdAt: content.createdAt,
    updatedAt: content.updatedAt,
    batchCount: content._count.batchContentMappings,
  };
}

export async function listCourseContentVersionsService(contentId: string): Promise<LearningResourceVersionDetail[]> {
  if (!isDatabaseConfigured) {
    return [];
  }

  const content = await prisma.courseContent.findUnique({
    where: { id: contentId },
    select: {
      learningResource: {
        select: { id: true },
      },
    },
  });

  if (!content?.learningResource?.id) {
    return [];
  }

  return listLearningResourceVersionsService(content.learningResource.id);
}

export async function listAssignedSharedCourseContentService(courseId?: string): Promise<AssignedSharedContentListItem[]> {
  if (!isDatabaseConfigured) {
    return [];
  }

  const assignments = await prisma.learningResourceAssignment.findMany({
    where: {
      targetType: "COURSE",
      ...(courseId ? { targetId: courseId } : {}),
      resource: {
        sourceContentId: {
          not: null,
        },
      },
    },
    orderBy: [{ assignedAt: "desc" }],
    select: {
      targetId: true,
      assignedAt: true,
      resource: {
        select: {
          id: true,
          status: true,
          visibility: true,
          sourceContent: {
            select: {
              id: true,
              courseId: true,
              folderId: true,
              title: true,
              description: true,
              excerpt: true,
              contentType: true,
              estimatedReadingMinutes: true,
              fileUrl: true,
              fileName: true,
              fileSize: true,
              mimeType: true,
              storagePath: true,
              storageProvider: true,
              sortOrder: true,
              status: true,
              isScorm: true,
              createdAt: true,
              folder: { select: { name: true } },
              course: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const targetCourseIds = Array.from(new Set(assignments.map((assignment) => assignment.targetId)));
  const targetCourses = targetCourseIds.length > 0
    ? await prisma.course.findMany({
      where: {
        id: {
          in: targetCourseIds,
        },
      },
      select: {
        id: true,
        name: true,
      },
    })
    : [];
  const targetCourseMap = new Map(targetCourses.map((course) => [course.id, course.name]));

  return assignments.flatMap((assignment) => {
    const sourceContent = assignment.resource.sourceContent;

    if (!sourceContent || sourceContent.courseId === assignment.targetId) {
      return [];
    }

    return [mapSharedContentToCourseItem({
      sourceContent,
      targetCourseId: assignment.targetId,
      targetCourseName: targetCourseMap.get(assignment.targetId) ?? "Assigned Course",
      resourceId: assignment.resource.id,
      resourceStatus: assignment.resource.status,
      resourceVisibility: assignment.resource.visibility,
      assignedAt: assignment.assignedAt,
      folderId: null,
      folderName: null,
      shareKind: "COURSE_ASSIGNMENT",
    })];
  });
}

export async function getCandidateAccessibleContentByIdService(
  userId: string,
  contentId: string,
): Promise<CandidateContentAccessResult | null> {
  const profile = await getCandidateProfileByUserIdService(userId);

  if (!profile) {
    return null;
  }

  const batchIds = Array.from(new Set(profile?.activeEnrollments.map((enrollment) => enrollment.batchId) ?? []));

  if (!isDatabaseConfigured || batchIds.length === 0) {
    return null;
  }

  const courseIds = await listCourseIdsForBatchIds(batchIds);

  if (courseIds.length === 0) {
    return null;
  }

  let content = await prisma.courseContent.findFirst({
    where: {
      id: contentId,
      status: "PUBLISHED",
      OR: [
        {
          courseId: {
            in: courseIds,
          },
        },
        {
          batchContentMappings: {
            some: {
              batchId: { in: batchIds },
            },
          },
        },
        {
          curriculumStageItems: {
            some: {
              stage: {
                module: {
                  curriculum: {
                    status: "PUBLISHED",
                    batchMappings: {
                      some: {
                        batchId: { in: batchIds },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      courseId: true,
      title: true,
      description: true,
      excerpt: true,
      contentType: true,
      estimatedReadingMinutes: true,
      fileUrl: true,
      fileName: true,
      mimeType: true,
      renderedHtml: true,
      bodyJson: true,
      updatedAt: true,
    },
  });

  if (!content) {
    const assignmentAccess = await prisma.learningResourceAssignment.findFirst({
      where: {
        OR: [
          {
            targetType: "COURSE",
            targetId: {
              in: courseIds,
            },
          },
          {
            targetType: "BATCH",
            targetId: {
              in: batchIds,
            },
          },
        ],
        resource: {
          sourceContentId: contentId,
        },
      },
      select: {
        id: true,
      },
    });

    if (assignmentAccess) {
      content = await prisma.courseContent.findFirst({
        where: {
          id: contentId,
          status: "PUBLISHED",
        },
        select: {
          id: true,
          courseId: true,
          title: true,
          description: true,
          excerpt: true,
          contentType: true,
          estimatedReadingMinutes: true,
          fileUrl: true,
          fileName: true,
          mimeType: true,
          renderedHtml: true,
          bodyJson: true,
          updatedAt: true,
        },
      });
    }
  }

  if (!content) {
    return null;
  }

  const contexts = await resolveCandidateCurriculumContentContextsService({
    learnerId: profile.id,
    batchIds,
    contentId: content.id,
  });
  const availableContexts = contexts.filter((context) => context.availabilityStatus === "AVAILABLE");

  if (contexts.length > 0 && availableContexts.length === 0) {
    const blockingContext = selectBlockingCandidateContentContext(contexts);

    if (!blockingContext) {
      return null;
    }

    return {
      kind: "blocked",
      contentId: content.id,
      title: content.title,
      availabilityStatus: blockingContext.availabilityStatus === "SCHEDULED" ? "SCHEDULED" : "LOCKED",
      availabilityReason: blockingContext.availabilityReason,
      contexts,
    };
  }

  if (availableContexts.length > 0) {
    try {
      await markCurriculumContentCompletedForLearnerService({
        learnerId: profile.id,
        targets: availableContexts.map((context) => ({
          batchId: context.batchId,
          stageItemId: context.stageItemId,
        })),
      });
    } catch (error) {
      console.warn("Candidate content access succeeded, but curriculum completion sync failed", error);
    }
  }

  return {
    kind: "content",
    content: {
      id: content.id,
      title: content.title,
      description: content.description,
      excerpt: content.excerpt,
      contentType: content.contentType,
      estimatedReadingMinutes: content.estimatedReadingMinutes,
      fileUrl: content.fileUrl,
      fileName: content.fileName,
      mimeType: content.mimeType,
      renderedHtml: content.renderedHtml,
      bodyJson: parseAuthoredContentAnyDocument(content.bodyJson),
      updatedAt: content.updatedAt,
    },
    contexts,
  };
}
