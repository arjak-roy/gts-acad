import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth/route-guards";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { uploadCourseContentSchema } from "@/lib/validation-schemas/course-content";
import { createContentService } from "@/services/course-content-service";
import {
  deleteStoredUploadAsset,
  getFileUploadServiceConfig,
  storeUploadedCourseContentAsset,
  validateUploadedFileAgainstGlobalSettings,
} from "@/services/file-upload";

export const runtime = "nodejs";

function buildTitleFromFileName(fileName: string) {
  const baseName = fileName.replace(/\.[^.]+$/, "");
  const normalized = baseName.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  const fallback = normalized || "Untitled content";

  return fallback.slice(0, 255);
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "course_content.create");
    const config = await getFileUploadServiceConfig();

    return apiSuccess({
      maximumFileUploadSizeMb: Math.round(config.globalSettings.maximumFileUploadSizeBytes / (1024 * 1024)),
      allowedFileTypes: config.globalSettings.allowedFileTypes,
      allowedImageTypes: config.globalSettings.allowedImageTypes,
      storageLocation: config.globalSettings.storageLocation,
      enableDocumentPreview: config.globalSettings.enableDocumentPreview,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "course_content.create");
    const formData = await request.formData();
    const singleTitle = String(formData.get("title") ?? "").trim();
    const explicitTitles = formData
      .getAll("titles")
      .map((entry) => String(entry ?? "").trim());

    const input = uploadCourseContentSchema.parse({
      courseId: String(formData.get("courseId") ?? ""),
      folderId: formData.get("folderId") ? String(formData.get("folderId") ?? "") : null,
      repositoryFolderId: formData.get("repositoryFolderId") ? String(formData.get("repositoryFolderId") ?? "") : null,
      description: String(formData.get("description") ?? ""),
      contentType: String(formData.get("contentType") ?? "OTHER"),
      status: String(formData.get("status") ?? "DRAFT"),
    });

    const course = isDatabaseConfigured
      ? await prisma.course.findUnique({
        where: { id: input.courseId },
        select: { id: true, code: true, name: true },
      })
      : { id: input.courseId, code: input.courseId, name: input.courseId };

    if (!course) {
      throw new Error("Course not found.");
    }

    const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (files.length === 0) {
      throw new Error("Select at least one file to upload.");
    }

    const created = [];
    const failed: Array<{ fileName: string; error: string }> = [];

    for (const [index, file] of files.entries()) {
      try {
        await validateUploadedFileAgainstGlobalSettings(file);
        const asset = await storeUploadedCourseContentAsset(file, {
          courseCode: course.code,
          courseName: course.name,
        });
        const requestedTitle = (explicitTitles[index] ?? (files.length === 1 ? singleTitle : "")).trim();

        try {
          const content = await createContentService({
            courseId: input.courseId,
            folderId: input.folderId || null,
            repositoryFolderId: input.repositoryFolderId || null,
            title: requestedTitle || buildTitleFromFileName(file.name),
            description: input.description,
            excerpt: "",
            contentType: input.contentType,
            fileUrl: asset.url,
            fileName: file.name.slice(0, 255),
            fileSize: file.size,
            mimeType: file.type || asset.mimeType,
            storagePath: asset.storagePath,
            storageProvider: asset.storageProvider,
            status: input.status,
            isScorm: false,
          }, { actorUserId: session.userId });

          created.push(content);
        } catch (error) {
          await deleteStoredUploadAsset(asset);
          throw error;
        }
      } catch (error) {
        failed.push({
          fileName: file.name,
          error: error instanceof Error ? error.message : "Failed to upload file.",
        });
      }
    }

    if (created.length === 0) {
      throw new Error(failed[0]?.error || "Unable to upload course content.");
    }

    return apiSuccess({
      items: created,
      createdCount: created.length,
      failed,
    }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}