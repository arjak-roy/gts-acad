import "server-only";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import type { CourseContentFolderDetail, CourseContentFolderListItem } from "@/services/course-content/types";

export async function listCourseContentFoldersService(courseId?: string): Promise<CourseContentFolderListItem[]> {
  if (!isDatabaseConfigured) {
    return [];
  }

  const folders = await prisma.courseContentFolder.findMany({
    where: courseId ? { courseId } : undefined,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      courseId: true,
      name: true,
      description: true,
      sortOrder: true,
      createdAt: true,
      _count: { select: { contents: true } },
    },
  });

  return folders.map((folder) => ({
    id: folder.id,
    courseId: folder.courseId,
    name: folder.name,
    description: folder.description,
    sortOrder: folder.sortOrder,
    contentCount: folder._count.contents,
    createdAt: folder.createdAt,
  }));
}

export async function getCourseContentFolderByIdService(folderId: string): Promise<CourseContentFolderDetail | null> {
  if (!isDatabaseConfigured) {
    return null;
  }

  const folder = await prisma.courseContentFolder.findUnique({
    where: { id: folderId },
    select: {
      id: true,
      courseId: true,
      name: true,
      description: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { name: true } },
      _count: { select: { contents: true } },
    },
  });

  if (!folder) {
    return null;
  }

  return {
    id: folder.id,
    courseId: folder.courseId,
    name: folder.name,
    description: folder.description,
    sortOrder: folder.sortOrder,
    contentCount: folder._count.contents,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
    createdByName: folder.createdBy?.name ?? null,
  };
}