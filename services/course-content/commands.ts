import "server-only";

import { Prisma, UploadStorageProvider } from "@prisma/client";
import {
  estimateReadingMinutesFromDocument,
  extractAuthoredExcerpt,
  parseAuthoredContentDocument,
  renderAuthoredContentToHtml,
} from "@/lib/authored-content";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { AUDIT_ENTITY_TYPE, AUDIT_ACTION_TYPE } from "@/services/logs-actions/constants";
import type { CreateContentInput, UpdateContentInput } from "@/lib/validation-schemas/course-content";
import { deleteStoredUploadAsset } from "@/services/file-upload";
import { createAuditLogEntry } from "@/services/logs-actions-service";
import type { ContentCreateResult } from "@/services/course-content/types";

export async function createContentService(
  input: CreateContentInput,
  options?: { actorUserId?: string },
): Promise<ContentCreateResult> {
  const isAuthoredContent = input.contentType === "ARTICLE";
  const authoredBodyJson = isAuthoredContent ? parseAuthoredContentDocument(input.bodyJson) : null;

  if (isAuthoredContent && !authoredBodyJson) {
    throw new Error("Authored content requires body blocks.");
  }

  const excerpt = isAuthoredContent ? (input.excerpt?.trim() || extractAuthoredExcerpt(authoredBodyJson)) : null;
  const estimatedReadingMinutes = isAuthoredContent
    ? (input.estimatedReadingMinutes ?? estimateReadingMinutesFromDocument(authoredBodyJson))
    : null;
  const renderedHtml = isAuthoredContent ? renderAuthoredContentToHtml(authoredBodyJson) : null;
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

  if (authoredBodyJson) {
    createData.bodyJson = authoredBodyJson;
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

  return content;
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
  const nextBodyJson = isAuthoredContent
    ? parseAuthoredContentDocument(input.bodyJson !== undefined ? input.bodyJson : existing.bodyJson)
    : null;

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

  if (isAuthoredContent && !nextBodyJson) {
    throw new Error("Authored content requires body blocks.");
  }

  const nextExcerpt = isAuthoredContent
    ? (input.excerpt !== undefined ? input.excerpt.trim() : existing.excerpt || "") || extractAuthoredExcerpt(nextBodyJson)
    : null;
  const nextEstimatedReadingMinutes = isAuthoredContent
    ? (input.estimatedReadingMinutes ?? existing.estimatedReadingMinutes ?? estimateReadingMinutesFromDocument(nextBodyJson))
    : null;
  const nextRenderedHtml = isAuthoredContent ? renderAuthoredContentToHtml(nextBodyJson) : null;
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

  if (isAuthoredContent && nextBodyJson) {
    updateData.bodyJson = nextBodyJson;
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

  if (existing.storagePath) {
    await deleteStoredUploadAsset(
      {
        storageProvider: existing.storageProvider,
        storagePath: existing.storagePath,
      },
      { throwOnError: true },
    );
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

  return content;
}
