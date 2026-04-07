import "server-only";

import { UploadStorageProvider } from "@prisma/client";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { AUDIT_ENTITY_TYPE, AUDIT_ACTION_TYPE } from "@/services/logs-actions/constants";
import type { CreateContentInput, UpdateContentInput } from "@/lib/validation-schemas/course-content";
import { createAuditLogEntry } from "@/services/logs-actions-service";
import type { ContentCreateResult } from "@/services/course-content/types";

export async function createContentService(
  input: CreateContentInput,
  options?: { actorUserId?: string },
): Promise<ContentCreateResult> {
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
    data: {
      courseId: input.courseId,
      folderId: input.folderId || null,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      contentType: input.contentType as ContentCreateResult["contentType"],
      fileUrl: input.fileUrl || null,
      fileName: input.fileName || null,
      fileSize: input.fileSize ?? null,
      mimeType: input.mimeType || null,
      storagePath: input.storagePath || null,
      storageProvider: input.storageProvider ? (input.storageProvider as UploadStorageProvider) : null,
      status: (input.status ?? "DRAFT") as ContentCreateResult["status"],
      isScorm: input.isScorm ?? false,
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
    select: { id: true, courseId: true, title: true },
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

  const content = await prisma.courseContent.update({
    where: { id: input.contentId },
    data: {
      ...(input.folderId !== undefined && { folderId: input.folderId || null }),
      ...(input.title !== undefined && { title: input.title.trim() }),
      ...(input.description !== undefined && { description: input.description.trim() || null }),
      ...(input.status !== undefined && { status: input.status as ContentCreateResult["status"] }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
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
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.COURSE_CONTENT,
    entityId: content.id,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `Content "${content.title}" updated.`,
    actorUserId: options?.actorUserId,
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
