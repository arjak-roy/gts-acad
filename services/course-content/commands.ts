import "server-only";

import { Prisma, UploadStorageProvider } from "@prisma/client";
import {
  estimateReadingMinutesFromDocument,
  extractAuthoredExcerpt,
  parseAuthoredContentDocument,
  renderAuthoredContentToHtml,
  parseAuthoredContentAnyDocument,
  isV2Document,
  extractAnyExcerpt,
  estimateAnyReadingMinutes,
  renderAnyDocumentToHtml,
} from "@/lib/authored-content";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { AUDIT_ENTITY_TYPE, AUDIT_ACTION_TYPE } from "@/services/logs-actions/constants";
import type { CreateContentInput, UpdateContentInput } from "@/lib/validation-schemas/course-content";
import type { RestoreLearningResourceVersionInput } from "@/lib/validation-schemas/learning-resources";
import { deleteStoredUploadAssetIfUnreferenced } from "@/services/file-upload";
import { restoreLearningResourceVersionService, syncLearningResourceFromContentService } from "@/services/learning-resource-service";
import { createAuditLogEntry } from "@/services/logs-actions-service";
import type { ContentCreateResult } from "@/services/course-content/types";

export async function createContentService(
  input: CreateContentInput,
  options?: { actorUserId?: string },
): Promise<ContentCreateResult> {
  const isAuthoredContent = input.contentType === "ARTICLE";
  const parsedAnyBody = isAuthoredContent ? parseAuthoredContentAnyDocument(input.bodyJson) : null;
  const authoredBodyJson = isAuthoredContent && !parsedAnyBody ? parseAuthoredContentDocument(input.bodyJson) : null;
  const effectiveBody = parsedAnyBody ?? authoredBodyJson;

  if (isAuthoredContent && !effectiveBody) {
    throw new Error("Authored content requires body content.");
  }

  const excerpt = isAuthoredContent ? (input.excerpt?.trim() || extractAnyExcerpt(parsedAnyBody) || extractAuthoredExcerpt(authoredBodyJson)) : null;
  const estimatedReadingMinutes = isAuthoredContent
    ? (input.estimatedReadingMinutes ?? estimateAnyReadingMinutes(parsedAnyBody) ?? estimateReadingMinutesFromDocument(authoredBodyJson))
    : null;
  const renderedHtml = isAuthoredContent ? (renderAnyDocumentToHtml(parsedAnyBody) || renderAuthoredContentToHtml(authoredBodyJson)) : null;
  const createData = {} as Prisma.CourseContentUncheckedCreateInput;
  createData.courseId = input.courseId;
  createData.folderId = input.folderId || null;
  createData.title = input.title.trim();
  createData.description = input.description?.trim() || null;
  createData.excerpt = excerpt;
  createData.contentType = input.contentType as ContentCreateResult["contentType"];
  createData.renderedHtml = renderedHtml;
  createData.estimatedReadingMinutes = estimatedReadingMinutes;
  createData.fileUrl = isAuthoredContent ? null : input.fileUrl || null;
  createData.fileName = isAuthoredContent ? null : input.fileName || null;
  createData.fileSize = isAuthoredContent ? null : input.fileSize ?? null;
  createData.mimeType = isAuthoredContent ? null : input.mimeType || null;
  createData.storagePath = isAuthoredContent ? null : input.storagePath || null;
  createData.storageProvider = isAuthoredContent ? null : input.storageProvider ? (input.storageProvider as UploadStorageProvider) : null;
  createData.status = (input.status ?? "DRAFT") as ContentCreateResult["status"];
  createData.isScorm = isAuthoredContent ? false : input.isScorm ?? false;
  createData.createdById = options?.actorUserId ?? null;

  if (effectiveBody) {
    createData.bodyJson = effectiveBody;
  }

  if (!isDatabaseConfigured) {
    return {
      id: `mock-content-${Date.now()}`,
      courseId: input.courseId,
      folderId: input.folderId ?? null,
      title: input.title,
      contentType: input.contentType as ContentCreateResult["contentType"],
      status: (input.status ?? "DRAFT") as ContentCreateResult["status"],
      fileName: input.fileName || null,
      resourceId: null,
    };
  }

  const course = await prisma.course.findUnique({
    where: { id: input.courseId },
    select: { id: true },
  });

  if (!course) {
    throw new Error("Course not found.");
  }

  if (input.folderId) {
    const folder = await prisma.courseContentFolder.findFirst({
      where: { id: input.folderId, courseId: input.courseId },
      select: { id: true },
    });

    if (!folder) {
      throw new Error("Folder not found for the selected course.");
    }
  }

  const content = await prisma.courseContent.create({
    data: createData,
    select: {
      id: true,
      courseId: true,
      folderId: true,
      title: true,
      contentType: true,
      status: true,
      fileName: true,
      fileUrl: true,
      fileSize: true,
      mimeType: true,
      storagePath: true,
      storageProvider: true,
    },
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.COURSE_CONTENT,
    entityId: content.id,
    action: AUDIT_ACTION_TYPE.CREATED,
    message: `Content "${content.title}" created.`,
    actorUserId: options?.actorUserId,
    metadata: { courseId: input.courseId, contentType: input.contentType },
  });

  const syncResult = await syncLearningResourceFromContentService(content.id, {
    actorUserId: options?.actorUserId,
    changeSummary: "Created from repository upload.",
    repositoryFolderId: input.repositoryFolderId ?? null,
  });

  return {
    ...content,
    resourceId: syncResult?.id ?? null,
  };
}

export async function updateContentService(
  input: UpdateContentInput,
  options?: { actorUserId?: string },
): Promise<ContentCreateResult> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const existing = await prisma.courseContent.findUnique({
    where: { id: input.contentId },
    select: {
      id: true,
      courseId: true,
      title: true,
      contentType: true,
      bodyJson: true,
      excerpt: true,
      estimatedReadingMinutes: true,
      fileUrl: true,
      fileName: true,
      storagePath: true,
    },
  });

  if (!existing) {
    throw new Error("Content not found.");
  }

  if (input.folderId) {
    const folder = await prisma.courseContentFolder.findFirst({
      where: { id: input.folderId, courseId: existing.courseId },
      select: { id: true },
    });

    if (!folder) {
      throw new Error("Folder not found for the selected course.");
    }
  }

  const nextContentType = input.contentType ?? existing.contentType;
  const normalizedFileUrl = input.fileUrl !== undefined ? input.fileUrl.trim() : undefined;
  const isStoredUpload = Boolean(existing.storagePath);
  const isAuthoredContent = nextContentType === "ARTICLE";
  const rawBodyJson = input.bodyJson !== undefined ? input.bodyJson : existing.bodyJson;
  const parsedAnyBody = isAuthoredContent ? parseAuthoredContentAnyDocument(rawBodyJson) : null;
  const nextBodyJson = isAuthoredContent && !parsedAnyBody ? parseAuthoredContentDocument(rawBodyJson) : null;
  const effectiveBody = parsedAnyBody ?? nextBodyJson;

  if (input.fileUrl !== undefined && isStoredUpload) {
    throw new Error("The source URL for uploaded content cannot be edited.");
  }

  if (isAuthoredContent && isStoredUpload) {
    throw new Error("Uploaded content cannot be converted into authored lesson content.");
  }

  if (nextContentType === "LINK" && isStoredUpload) {
    throw new Error("Uploaded content cannot be converted into link-only content.");
  }

  if (nextContentType === "LINK" && (normalizedFileUrl ?? existing.fileUrl ?? "").trim().length === 0) {
    throw new Error("Link content requires a destination URL.");
  }

  if (isAuthoredContent && !effectiveBody) {
    throw new Error("Authored content requires body content.");
  }

  const nextExcerpt = isAuthoredContent
    ? (input.excerpt !== undefined ? input.excerpt.trim() : existing.excerpt || "") || extractAnyExcerpt(parsedAnyBody) || extractAuthoredExcerpt(nextBodyJson)
    : null;
  const nextEstimatedReadingMinutes = isAuthoredContent
    ? (input.estimatedReadingMinutes ?? existing.estimatedReadingMinutes ?? estimateAnyReadingMinutes(parsedAnyBody) ?? estimateReadingMinutesFromDocument(nextBodyJson))
    : null;
  const nextRenderedHtml = isAuthoredContent ? (renderAnyDocumentToHtml(parsedAnyBody) || renderAuthoredContentToHtml(nextBodyJson)) : null;
  const updateData = {} as Prisma.CourseContentUncheckedUpdateInput;

  if (input.folderId !== undefined) {
    updateData.folderId = input.folderId || null;
  }

  if (input.title !== undefined) {
    updateData.title = input.title.trim();
  }

  if (input.description !== undefined) {
    updateData.description = input.description.trim() || null;
  }

  if (input.contentType !== undefined) {
    updateData.contentType = input.contentType as ContentCreateResult["contentType"];
  }

  if (input.fileUrl !== undefined && !isAuthoredContent) {
    updateData.fileUrl = normalizedFileUrl || null;
  }

  if (input.status !== undefined) {
    updateData.status = input.status as ContentCreateResult["status"];
  }

  if (input.sortOrder !== undefined) {
    updateData.sortOrder = input.sortOrder;
  }

  if (isAuthoredContent && effectiveBody) {
    updateData.bodyJson = effectiveBody;
    updateData.renderedHtml = nextRenderedHtml;
    updateData.excerpt = nextExcerpt;
    updateData.estimatedReadingMinutes = nextEstimatedReadingMinutes;
    updateData.fileUrl = null;
    updateData.fileName = null;
    updateData.fileSize = null;
    updateData.mimeType = null;
    updateData.storagePath = null;
    updateData.storageProvider = null;
    updateData.isScorm = false;
  }

  if (!isAuthoredContent && existing.contentType === "ARTICLE") {
    updateData.bodyJson = Prisma.DbNull;
    updateData.renderedHtml = null;
    updateData.excerpt = null;
    updateData.estimatedReadingMinutes = null;
  }

  const content = await prisma.courseContent.update({
    where: { id: input.contentId },
    data: updateData,
    select: {
      id: true,
      courseId: true,
      folderId: true,
      title: true,
      contentType: true,
      status: true,
      fileName: true,
    },
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.COURSE_CONTENT,
    entityId: content.id,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `Content "${content.title}" updated.`,
    actorUserId: options?.actorUserId,
    metadata: {
      contentType: content.contentType,
      folderId: content.folderId,
      hasExternalUrl: Boolean(normalizedFileUrl || existing.fileUrl),
    },
  });

  await syncLearningResourceFromContentService(content.id, {
    actorUserId: options?.actorUserId,
    changeSummary: input.status === "ARCHIVED"
      ? "Archived from repository explorer."
      : "Updated from repository explorer.",
  });

  return content;
}

export async function deleteContentService(
  contentId: string,
  options?: { actorUserId?: string },
): Promise<ContentCreateResult> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const existing = await prisma.courseContent.findUnique({
    where: { id: contentId },
    select: {
      id: true,
      courseId: true,
      folderId: true,
      title: true,
      contentType: true,
      status: true,
      fileName: true,
      storagePath: true,
      storageProvider: true,
    },
  });

  if (!existing) {
    throw new Error("Content not found.");
  }

  const content = await prisma.courseContent.delete({
    where: { id: contentId },
    select: {
      id: true,
      courseId: true,
      folderId: true,
      title: true,
      contentType: true,
      status: true,
      fileName: true,
    },
  });

  await deleteStoredUploadAssetIfUnreferenced(
    {
      storageProvider: existing.storageProvider,
      storagePath: existing.storagePath,
    },
    { throwOnError: true },
  );

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.COURSE_CONTENT,
    entityId: content.id,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `Content "${content.title}" deleted.`,
    actorUserId: options?.actorUserId,
    metadata: {
      deleted: true,
      contentType: existing.contentType,
      storageProvider: existing.storageProvider,
      storagePath: existing.storagePath,
    },
  });

  return content;
}

export async function archiveContentService(
  contentId: string,
  options?: { actorUserId?: string },
): Promise<ContentCreateResult> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const content = await prisma.courseContent.update({
    where: { id: contentId },
    data: { status: "ARCHIVED" },
    select: {
      id: true,
      courseId: true,
      folderId: true,
      title: true,
      contentType: true,
      status: true,
      fileName: true,
    },
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.COURSE_CONTENT,
    entityId: content.id,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `Content "${content.title}" archived.`,
    actorUserId: options?.actorUserId,
  });

  await syncLearningResourceFromContentService(content.id, {
    actorUserId: options?.actorUserId,
    changeSummary: "Archived from repository explorer.",
  });

  return content;
}

export async function restoreCourseContentVersionService(
  contentId: string,
  input: RestoreLearningResourceVersionInput,
  options?: { actorUserId?: string },
): Promise<ContentCreateResult> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const content = await prisma.courseContent.findUnique({
    where: { id: contentId },
    select: {
      id: true,
      courseId: true,
      folderId: true,
      title: true,
      learningResource: {
        select: { id: true },
      },
    },
  });

  if (!content) {
    throw new Error("Content not found.");
  }

  if (!content.learningResource?.id) {
    throw new Error("No version history is available for this content item yet.");
  }

  const restoredResource = await restoreLearningResourceVersionService(content.learningResource.id, input, options);

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.COURSE_CONTENT,
    entityId: content.id,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `Content "${content.title}" restored from version history.`,
    actorUserId: options?.actorUserId,
    metadata: {
      restoredFromVersionId: input.versionId,
      linkedResourceId: content.learningResource.id,
      versionNumber: restoredResource.currentVersionNumber,
    },
  });

  return {
    id: content.id,
    courseId: content.courseId,
    folderId: content.folderId,
    title: restoredResource.title,
    contentType: restoredResource.contentType,
    status: restoredResource.status,
    fileName: null,
  };
}

export async function cloneContentToCourseService(
  input: { sourceContentIds: string[]; targetCourseId: string; targetFolderId?: string | null },
  options?: { actorUserId?: string },
): Promise<ContentCreateResult[]> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  if (input.sourceContentIds.length === 0) {
    return [];
  }

  const targetCourse = await prisma.course.findUnique({
    where: { id: input.targetCourseId },
    select: { id: true },
  });

  if (!targetCourse) {
    throw new Error("Target course not found.");
  }

  if (input.targetFolderId) {
    const folder = await prisma.courseContentFolder.findFirst({
      where: { id: input.targetFolderId, courseId: input.targetCourseId },
      select: { id: true },
    });

    if (!folder) {
      throw new Error("Target folder not found for the selected course.");
    }
  }

  const sourceContents = await prisma.courseContent.findMany({
    where: { id: { in: input.sourceContentIds } },
    select: {
      id: true,
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
      isScorm: true,
      scormMetadata: true,
    },
  });

  if (sourceContents.length === 0) {
    throw new Error("No valid source content found.");
  }

  const results = await prisma.$transaction(
    sourceContents.map((source) =>
      prisma.courseContent.create({
        data: {
          courseId: input.targetCourseId,
          folderId: input.targetFolderId ?? null,
          title: source.title,
          description: source.description,
          excerpt: source.excerpt,
          contentType: source.contentType,
          bodyJson: source.bodyJson ?? undefined,
          renderedHtml: source.renderedHtml,
          estimatedReadingMinutes: source.estimatedReadingMinutes,
          fileUrl: source.fileUrl,
          fileName: source.fileName,
          fileSize: source.fileSize,
          mimeType: source.mimeType,
          storagePath: source.storagePath,
          storageProvider: source.storageProvider,
          isScorm: source.isScorm,
          scormMetadata: source.scormMetadata ?? undefined,
          sourceContentId: source.id,
          status: "DRAFT",
          createdById: options?.actorUserId ?? null,
        },
        select: {
          id: true,
          courseId: true,
          folderId: true,
          title: true,
          contentType: true,
          status: true,
          fileName: true,
        },
      }),
    ),
  );

  for (const content of results) {
    await createAuditLogEntry({
      entityType: AUDIT_ENTITY_TYPE.COURSE_CONTENT,
      entityId: content.id,
      action: AUDIT_ACTION_TYPE.CREATED,
      message: `Content "${content.title}" cloned from another course.`,
      actorUserId: options?.actorUserId,
      metadata: { targetCourseId: input.targetCourseId, clonedFrom: true },
    });
  }

  return results;
}
