import "server-only";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import type { ContentDetail, ContentListItem } from "@/services/course-content/types";

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
      contentType: true,
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
    contentType: c.contentType,
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
      contentType: true,
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
      createdAt: true,
      updatedAt: true,
      folder: { select: { name: true } },
      course: { select: { name: true } },
      createdBy: { select: { name: true } },
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
    contentType: content.contentType,
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
    createdByName: content.createdBy?.name ?? null,
    createdAt: content.createdAt,
    updatedAt: content.updatedAt,
    batchCount: content._count.batchContentMappings,
  };
}
