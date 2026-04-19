import "server-only";

import { Prisma } from "@prisma/client";

import { parseAuthoredContentDocument } from "@/lib/authored-content";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import type { ListLearningResourcesQueryInput } from "@/lib/validation-schemas/learning-resources";
import type {
  LearningResourceAssignmentItem,
  LearningResourceCategorySummary,
  LearningResourceDetail,
  LearningResourceListItem,
  LearningResourceListPage,
  LearningResourceLookupOption,
  LearningResourceLookups,
  LearningResourceTagSummary,
  LearningResourceVersionDetail,
} from "@/services/learning-resources/types";

function countUsage(events: Array<{ eventType: "PREVIEW" | "DOWNLOAD" }>) {
  return events.reduce(
    (counts, event) => {
      if (event.eventType === "DOWNLOAD") {
        counts.downloads += 1;
      } else {
        counts.previews += 1;
      }

      return counts;
    },
    { previews: 0, downloads: 0 },
  );
}

async function resolveAssignmentTargetLabels(
  assignments: Array<{ targetType: "COURSE" | "BATCH" | "ASSESSMENT_POOL" | "SCHEDULE_EVENT"; targetId: string }>,
) {
  if (assignments.length === 0 || !isDatabaseConfigured) {
    return new Map<string, string>();
  }

  const courseIds = assignments.filter((assignment) => assignment.targetType === "COURSE").map((assignment) => assignment.targetId);
  const batchIds = assignments.filter((assignment) => assignment.targetType === "BATCH").map((assignment) => assignment.targetId);
  const assessmentIds = assignments.filter((assignment) => assignment.targetType === "ASSESSMENT_POOL").map((assignment) => assignment.targetId);
  const scheduleEventIds = assignments.filter((assignment) => assignment.targetType === "SCHEDULE_EVENT").map((assignment) => assignment.targetId);

  const [courses, batches, assessments, scheduleEvents] = await Promise.all([
    courseIds.length > 0
      ? prisma.course.findMany({
        where: { id: { in: courseIds } },
        select: { id: true, name: true },
      })
      : Promise.resolve([]),
    batchIds.length > 0
      ? prisma.batch.findMany({
        where: { id: { in: batchIds } },
        select: { id: true, code: true, name: true },
      })
      : Promise.resolve([]),
    assessmentIds.length > 0
      ? prisma.assessmentPool.findMany({
        where: { id: { in: assessmentIds } },
        select: {
          id: true,
          title: true,
          code: true,
        },
      })
      : Promise.resolve([]),
    scheduleEventIds.length > 0
      ? prisma.batchScheduleEvent.findMany({
        where: { id: { in: scheduleEventIds } },
        select: {
          id: true,
          title: true,
          batch: { select: { code: true, name: true } },
        },
      })
      : Promise.resolve([]),
  ]);

  const labels = new Map<string, string>();

  for (const course of courses) {
    labels.set(`COURSE:${course.id}`, course.name);
  }

  for (const batch of batches) {
    labels.set(`BATCH:${batch.id}`, `${batch.code} · ${batch.name}`);
  }

  for (const assessment of assessments) {
    labels.set(
      `ASSESSMENT_POOL:${assessment.id}`,
      `${assessment.title} · ${assessment.code}`,
    );
  }

  for (const event of scheduleEvents) {
    labels.set(`SCHEDULE_EVENT:${event.id}`, `${event.title} · ${event.batch.code}`);
  }

  return labels;
}

function mapCategories(
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    parentId: string | null;
    sortOrder: number;
    isActive: boolean;
    parent: { name: string } | null;
  }>,
): LearningResourceCategorySummary[] {
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    parentId: category.parentId,
    parentName: category.parent?.name ?? null,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
  }));
}

function mapTags(tags: Array<{ id: string; name: string; slug: string }>): LearningResourceTagSummary[] {
  return tags.map((tag) => ({ id: tag.id, name: tag.name, slug: tag.slug }));
}

export async function listLearningResourcesService(
  filters: ListLearningResourcesQueryInput = {
    page: 1,
    pageSize: 25,
    sortBy: "updatedAt",
    sortDir: "desc",
    showDeleted: false,
  },
): Promise<LearningResourceListPage> {
  if (!isDatabaseConfigured) {
    return {
      items: [],
      total: 0,
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 25,
      totalPages: 0,
    };
  }

  const search = filters.search?.trim();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const skip = (page - 1) * pageSize;
  const sortBy = filters.sortBy ?? "updatedAt";
  const sortDir = filters.sortDir ?? "desc";
  const showDeleted = filters.showDeleted ?? false;

  const whereClauses: Prisma.LearningResourceWhereInput[] = showDeleted ? [{ deletedAt: { not: null } }] : [{ deletedAt: null }];

  if (filters.status) {
    whereClauses.push({ status: filters.status });
  }

  if (filters.visibility) {
    whereClauses.push({ visibility: filters.visibility });
  }

  if (filters.contentType) {
    whereClauses.push({ contentType: filters.contentType });
  }

  if (filters.createdById) {
    whereClauses.push({ createdById: filters.createdById });
  }

  if (filters.categoryId) {
    whereClauses.push({
      OR: [
        { categoryId: filters.categoryId },
        { subcategoryId: filters.categoryId },
      ],
    });
  }

  if (filters.tag) {
    whereClauses.push({
      tags: {
        some: {
          tag: {
            slug: filters.tag,
          },
        },
      },
    });
  }

  if (search) {
    whereClauses.push({
      OR: [
        { title: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { description: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { excerpt: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { fileName: { contains: search, mode: Prisma.QueryMode.insensitive } },
      ],
    });
  }

  const where: Prisma.LearningResourceWhereInput | undefined = whereClauses.length > 0
    ? { AND: whereClauses }
    : undefined;

  const [total, resources] = await Promise.all([
    prisma.learningResource.count({ where }),
    prisma.learningResource.findMany({
      where,
      orderBy: [{ [sortBy]: sortDir }, { updatedAt: "desc" }, { createdAt: "desc" }],
      skip,
      take: pageSize,
      select: {
        id: true,
        sourceContentId: true,
        title: true,
        description: true,
        excerpt: true,
        contentType: true,
        status: true,
        visibility: true,
        estimatedReadingMinutes: true,
        fileUrl: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        currentVersionNumber: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        category: { select: { name: true } },
        subcategory: { select: { name: true } },
        tags: { select: { tag: { select: { name: true } } } },
        assignments: { select: { id: true } },
        usages: { select: { eventType: true } },
      },
    }),
  ]);

  const items: LearningResourceListItem[] = resources.map((resource) => {
    const usage = countUsage(resource.usages);

    return {
      id: resource.id,
      sourceContentId: resource.sourceContentId,
      title: resource.title,
      description: resource.description,
      excerpt: resource.excerpt,
      contentType: resource.contentType,
      status: resource.status,
      visibility: resource.visibility,
      categoryName: resource.category?.name ?? null,
      subcategoryName: resource.subcategory?.name ?? null,
      tagNames: resource.tags.map((tagLink) => tagLink.tag.name),
      estimatedReadingMinutes: resource.estimatedReadingMinutes,
      fileUrl: resource.fileUrl,
      fileName: resource.fileName,
      fileSize: resource.fileSize,
      mimeType: resource.mimeType,
      currentVersionNumber: resource.currentVersionNumber,
      publishedAt: resource.publishedAt,
      createdAt: resource.createdAt,
      updatedAt: resource.updatedAt,
      deletedAt: resource.deletedAt,
      assignmentCount: resource.assignments.length,
      previewCount: usage.previews,
      downloadCount: usage.downloads,
    };
  });

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getLearningResourceByIdService(resourceId: string): Promise<LearningResourceDetail | null> {
  if (!isDatabaseConfigured) {
    return null;
  }

  const resource = await prisma.learningResource.findFirst({
    where: { id: resourceId, deletedAt: null },
    select: {
      id: true,
      sourceContentId: true,
      title: true,
      description: true,
      excerpt: true,
      contentType: true,
      status: true,
      visibility: true,
      categoryId: true,
      subcategoryId: true,
      bodyJson: true,
      renderedHtml: true,
      estimatedReadingMinutes: true,
      fileUrl: true,
      fileName: true,
      fileSize: true,
      mimeType: true,
      storagePath: true,
      storageProvider: true,
      currentVersionNumber: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      category: { select: { name: true } },
      subcategory: { select: { name: true } },
      createdBy: { select: { name: true } },
      updatedBy: { select: { name: true } },
      tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
      attachments: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          fileUrl: true,
          fileName: true,
          fileSize: true,
          mimeType: true,
          storagePath: true,
          storageProvider: true,
          sortOrder: true,
          createdAt: true,
        },
      },
      assignments: {
        orderBy: { assignedAt: "desc" },
        select: {
          id: true,
          targetType: true,
          targetId: true,
          notes: true,
          assignedAt: true,
          assignedBy: { select: { name: true } },
        },
      },
      usages: { select: { eventType: true } },
      _count: { select: { versions: true } },
    },
  });

  if (!resource) {
    return null;
  }

  const usage = countUsage(resource.usages);
  const targetLabels = await resolveAssignmentTargetLabels(
    resource.assignments.map((assignment) => ({ targetType: assignment.targetType, targetId: assignment.targetId })),
  );

  const assignments: LearningResourceAssignmentItem[] = resource.assignments.map((assignment) => ({
    id: assignment.id,
    targetType: assignment.targetType,
    targetId: assignment.targetId,
    targetLabel: targetLabels.get(`${assignment.targetType}:${assignment.targetId}`) ?? assignment.targetId,
    notes: assignment.notes,
    assignedByName: assignment.assignedBy?.name ?? null,
    assignedAt: assignment.assignedAt,
  }));

  return {
    id: resource.id,
    sourceContentId: resource.sourceContentId,
    title: resource.title,
    description: resource.description,
    excerpt: resource.excerpt,
    contentType: resource.contentType,
    status: resource.status,
    visibility: resource.visibility,
    categoryId: resource.categoryId,
    subcategoryId: resource.subcategoryId,
    categoryName: resource.category?.name ?? null,
    subcategoryName: resource.subcategory?.name ?? null,
    tagNames: resource.tags.map((tagLink) => tagLink.tag.name),
    estimatedReadingMinutes: resource.estimatedReadingMinutes,
    fileUrl: resource.fileUrl,
    fileName: resource.fileName,
    fileSize: resource.fileSize,
    mimeType: resource.mimeType,
    currentVersionNumber: resource.currentVersionNumber,
    publishedAt: resource.publishedAt,
    createdAt: resource.createdAt,
    updatedAt: resource.updatedAt,
    deletedAt: resource.deletedAt,
    assignmentCount: assignments.length,
    previewCount: usage.previews,
    downloadCount: usage.downloads,
    bodyJson: parseAuthoredContentDocument(resource.bodyJson),
    renderedHtml: resource.renderedHtml,
    storagePath: resource.storagePath,
    storageProvider: resource.storageProvider,
    tags: mapTags(resource.tags.map((tagLink) => tagLink.tag)),
    attachments: resource.attachments.map((attachment) => ({
      id: attachment.id,
      title: attachment.title,
      fileUrl: attachment.fileUrl,
      fileName: attachment.fileName,
      fileSize: attachment.fileSize,
      mimeType: attachment.mimeType,
      storagePath: attachment.storagePath,
      storageProvider: attachment.storageProvider,
      sortOrder: attachment.sortOrder,
      createdAt: attachment.createdAt,
    })),
    assignments,
    versionsCount: resource._count.versions,
    createdByName: resource.createdBy?.name ?? null,
    updatedByName: resource.updatedBy?.name ?? null,
  };
}

export async function listLearningResourceVersionsService(resourceId: string): Promise<LearningResourceVersionDetail[]> {
  if (!isDatabaseConfigured) {
    return [];
  }

  const resourceExists = await prisma.learningResource.findFirst({
    where: { id: resourceId, deletedAt: null },
    select: { id: true },
  });

  if (!resourceExists) {
    return [];
  }

  const versions = await prisma.learningResourceVersion.findMany({
    where: { resourceId },
    orderBy: { versionNumber: "desc" },
    select: {
      id: true,
      versionNumber: true,
      title: true,
      changeSummary: true,
      snapshot: true,
      createdAt: true,
      updatedBy: { select: { name: true } },
    },
  });

  return versions.map((version) => ({
    id: version.id,
    versionNumber: version.versionNumber,
    title: version.title,
    changeSummary: version.changeSummary,
    updatedByName: version.updatedBy?.name ?? null,
    createdAt: version.createdAt,
    snapshot: version.snapshot as LearningResourceVersionDetail["snapshot"],
  }));
}

export async function listLearningResourceLookupsService(): Promise<LearningResourceLookups> {
  if (!isDatabaseConfigured) {
    return {
      categories: [],
      tags: [],
      courses: [],
      batches: [],
      assessments: [],
      scheduleEvents: [],
    };
  }

  const [categories, tags, courses, batches, assessments, scheduleEvents] = await Promise.all([
    prisma.learningResourceCategory.findMany({
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        sortOrder: true,
        isActive: true,
        parent: { select: { name: true } },
      },
    }),
    prisma.learningResourceTag.findMany({
      orderBy: { name: "asc" },
      take: 200,
      select: { id: true, name: true, slug: true },
    }),
    prisma.course.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      take: 100,
      select: { id: true, code: true, name: true },
    }),
    prisma.batch.findMany({
      orderBy: [{ startDate: "desc" }, { name: "asc" }],
      take: 100,
      select: {
        id: true,
        code: true,
        name: true,
        program: { select: { course: { select: { name: true } } } },
      },
    }),
    prisma.assessmentPool.findMany({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { title: "asc" },
      take: 100,
      select: {
        id: true,
        code: true,
        title: true,
      },
    }),
    prisma.batchScheduleEvent.findMany({
      orderBy: [{ startsAt: "desc" }, { title: "asc" }],
      take: 100,
      select: {
        id: true,
        title: true,
        startsAt: true,
        batch: { select: { code: true, name: true } },
      },
    }),
  ]);

  const mapOption = (id: string, label: string, meta: string | null = null): LearningResourceLookupOption => ({ id, label, meta });

  return {
    categories: mapCategories(categories),
    tags: mapTags(tags),
    courses: courses.map((course) => mapOption(course.id, course.name, course.code)),
    batches: batches.map((batch) => mapOption(batch.id, `${batch.code} · ${batch.name}`, batch.program.course.name)),
    assessments: assessments.map((assessment) => mapOption(assessment.id, assessment.title, assessment.code)),
    scheduleEvents: scheduleEvents.map((event) => mapOption(
      event.id,
      event.title,
      `${event.batch.code} · ${new Date(event.startsAt).toLocaleDateString("en-IN")}`,
    )),
  };
}
