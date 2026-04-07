import "server-only";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import type { CreateCourseContentFolderInput, UpdateCourseContentFolderInput } from "@/lib/validation-schemas/course-content";
import { AUDIT_ACTION_TYPE, AUDIT_ENTITY_TYPE } from "@/services/logs-actions/constants";
import { createAuditLogEntry } from "@/services/logs-actions-service";
import type { CourseContentFolderListItem } from "@/services/course-content/types";

export async function createCourseContentFolderService(
  input: CreateCourseContentFolderInput,
  options?: { actorUserId?: string },
): Promise<CourseContentFolderListItem> {
  if (!isDatabaseConfigured) {
    return {
      id: `mock-folder-${Date.now()}`,
      courseId: input.courseId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      sortOrder: input.sortOrder ?? 0,
      contentCount: 0,
      createdAt: new Date(),
    };
  }

  const course = await prisma.course.findUnique({
    where: { id: input.courseId },
    select: { id: true },
  });

  if (!course) {
    throw new Error("Course not found.");
  }

  const existing = await prisma.courseContentFolder.findFirst({
    where: {
      courseId: input.courseId,
      name: { equals: input.name.trim(), mode: "insensitive" },
    },
    select: { id: true },
  });

  if (existing) {
    throw new Error("A folder with this name already exists for the selected course.");
  }

  const folder = await prisma.courseContentFolder.create({
    data: {
      courseId: input.courseId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      sortOrder: input.sortOrder ?? 0,
      createdById: options?.actorUserId ?? null,
    },
    select: {
      id: true,
      courseId: true,
      name: true,
      description: true,
      sortOrder: true,
      createdAt: true,
    },
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.COURSE_CONTENT_FOLDER,
    entityId: folder.id,
    action: AUDIT_ACTION_TYPE.CREATED,
    message: `Folder "${folder.name}" created.`,
    actorUserId: options?.actorUserId,
    metadata: { courseId: input.courseId },
  });

  return {
    ...folder,
    contentCount: 0,
  };
}

export async function updateCourseContentFolderService(
  input: UpdateCourseContentFolderInput,
  options?: { actorUserId?: string },
): Promise<CourseContentFolderListItem> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const existing = await prisma.courseContentFolder.findUnique({
    where: { id: input.folderId },
    select: { id: true, courseId: true, name: true, _count: { select: { contents: true } } },
  });

  if (!existing) {
    throw new Error("Folder not found.");
  }

  if (input.name !== undefined) {
    const duplicate = await prisma.courseContentFolder.findFirst({
      where: {
        courseId: existing.courseId,
        id: { not: input.folderId },
        name: { equals: input.name.trim(), mode: "insensitive" },
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new Error("A folder with this name already exists for the selected course.");
    }
  }

  const folder = await prisma.courseContentFolder.update({
    where: { id: input.folderId },
    data: {
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.description !== undefined && { description: input.description.trim() || null }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
    },
    select: {
      id: true,
      courseId: true,
      name: true,
      description: true,
      sortOrder: true,
      createdAt: true,
    },
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.COURSE_CONTENT_FOLDER,
    entityId: folder.id,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `Folder "${folder.name}" updated.`,
    actorUserId: options?.actorUserId,
  });

  return {
    ...folder,
    contentCount: existing._count.contents,
  };
}

export async function deleteCourseContentFolderService(
  folderId: string,
  options?: { actorUserId?: string },
): Promise<void> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const existing = await prisma.courseContentFolder.findUnique({
    where: { id: folderId },
    select: { id: true, name: true, _count: { select: { contents: true } } },
  });

  if (!existing) {
    throw new Error("Folder not found.");
  }

  if (existing._count.contents > 0) {
    throw new Error("Move or archive the folder contents before deleting the folder.");
  }

  await prisma.courseContentFolder.delete({ where: { id: folderId } });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.COURSE_CONTENT_FOLDER,
    entityId: folderId,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `Folder "${existing.name}" deleted.`,
    actorUserId: options?.actorUserId,
  });
}