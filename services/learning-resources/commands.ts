import "server-only";

import { Prisma, UploadStorageProvider } from "@prisma/client";

import {
  estimateAnyReadingMinutes,
  extractAnyExcerpt,
  parseAuthoredContentAnyDocument,
  renderAnyDocumentToHtml,
} from "@/lib/authored-content";
import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import type {
  AssignLearningResourceInput,
  CreateLearningResourceInput,
  CreateLearningResourceFolderInput,
  ImportLearningResourceInput,
  RecordLearningResourceUsageInput,
  RestoreLearningResourceVersionInput,
  UpdateLearningResourceFolderInput,
  UpdateLearningResourceInput,
} from "@/lib/validation-schemas/learning-resources";
import { deleteStoredUploadAssetIfUnreferenced, resolveStoredAssetResponse } from "@/services/file-upload";
import { sanitizeStoragePathSegment } from "@/services/file-upload/naming";
import { createAuditLogEntry } from "@/services/logs-actions-service";
import { AUDIT_ACTION_TYPE, AUDIT_ENTITY_TYPE } from "@/services/logs-actions/constants";
import type {
  LearningResourceCreateResult,
  LearningResourceFolderSummary,
  LearningResourceSnapshotAttachment,
  LearningResourceVersionSnapshot,
} from "@/services/learning-resources/types";

type TransactionClient = Prisma.TransactionClient;

type StoredAssetLike = {
  storagePath: string | null;
  storageProvider: UploadStorageProvider | null;
};

type AttachmentPayload = LearningResourceSnapshotAttachment;

type LinkedCourseContentRecord = {
  id: string;
  title: string;
  description: string | null;
  excerpt: string | null;
  contentType: LearningResourceCreateResult["contentType"];
  bodyJson: Prisma.JsonValue | null;
  renderedHtml: string | null;
  estimatedReadingMinutes: number | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  storagePath: string | null;
  storageProvider: UploadStorageProvider | null;
  status: LearningResourceCreateResult["status"];
  course: { name: string };
  folder: { name: string } | null;
};

type SyncLinkedResourceTxResult = {
  resource: LearningResourceCreateResult;
  action: "created" | "updated" | "unchanged";
  assetsToDelete: StoredAssetLike[];
};

type SyncLearningResourceFromContentOptions = {
  actorUserId?: string;
  changeSummary?: string;
  repositoryFolderId?: string | null;
};

const LEARNING_RESOURCE_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 60_000,
} as const;

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function normalizeTagNames(values: string[] | undefined) {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean)));
}

type LearningResourceFolderRecord = {
  id: string;
  parentId: string | null;
  name: string;
  description: string | null;
  sortOrder: number;
};

function mapLearningResourceFolderSummaries(
  folders: LearningResourceFolderRecord[],
): LearningResourceFolderSummary[] {
  const folderById = new Map(folders.map((folder) => [folder.id, folder]));
  const pathCache = new Map<string, string>();

  const resolvePathLabel = (folder: LearningResourceFolderRecord): string => {
    const cached = pathCache.get(folder.id);

    if (cached) {
      return cached;
    }

    const parent = folder.parentId ? folderById.get(folder.parentId) : null;
    const pathLabel = parent ? `${resolvePathLabel(parent)} / ${folder.name}` : folder.name;
    pathCache.set(folder.id, pathLabel);
    return pathLabel;
  };

  return folders.map((folder) => ({
    id: folder.id,
    parentId: folder.parentId,
    name: folder.name,
    description: folder.description,
    sortOrder: folder.sortOrder,
    pathLabel: resolvePathLabel(folder),
  }));
}

function assertLearningResourceFolderParentIsValid(
  folders: LearningResourceFolderRecord[],
  folderId: string,
  parentId: string | null,
) {
  if (!parentId) {
    return;
  }

  if (parentId === folderId) {
    throw new Error("A folder cannot be its own parent.");
  }

  const folderById = new Map(folders.map((folder) => [folder.id, folder]));
  let cursor = folderById.get(parentId) ?? null;

  while (cursor) {
    if (cursor.id === folderId) {
      throw new Error("A folder cannot be moved inside one of its descendants.");
    }

    cursor = cursor.parentId ? (folderById.get(cursor.parentId) ?? null) : null;
  }
}

async function listLearningResourceFolderRecordsTx(tx: TransactionClient): Promise<LearningResourceFolderRecord[]> {
  return tx.learningResourceFolder.findMany({
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      parentId: true,
      name: true,
      description: true,
      sortOrder: true,
    },
  });
}

type AssignmentBridgeResourceRecord = {
  id: string;
  title: string;
  description: string | null;
  excerpt: string | null;
  contentType: LearningResourceCreateResult["contentType"];
  status: LearningResourceCreateResult["status"];
  bodyJson: Prisma.JsonValue | null;
  renderedHtml: string | null;
  estimatedReadingMinutes: number | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  storagePath: string | null;
  storageProvider: UploadStorageProvider | null;
  sourceContentId: string | null;
};

async function createCourseContentFromLearningResourceTx(
  tx: TransactionClient,
  resource: AssignmentBridgeResourceRecord,
  courseId: string,
  actorUserId?: string,
) {
  return tx.courseContent.create({
    data: {
      courseId,
      folderId: null,
      title: resource.title,
      description: resource.description,
      excerpt: resource.excerpt,
      contentType: resource.contentType,
      bodyJson: resource.bodyJson ? (resource.bodyJson as Prisma.InputJsonValue) : Prisma.DbNull,
      renderedHtml: resource.renderedHtml,
      estimatedReadingMinutes: resource.estimatedReadingMinutes,
      fileUrl: resource.fileUrl,
      fileName: resource.fileName,
      fileSize: resource.fileSize,
      mimeType: resource.mimeType,
      storagePath: resource.storagePath,
      storageProvider: resource.storageProvider,
      status: resource.status,
      isScorm: resource.contentType === "SCORM",
      createdById: actorUserId ?? null,
    },
    select: {
      id: true,
    },
  });
}

async function resolveAssignmentTargetCourseIdTx(
  tx: TransactionClient,
  targetType: AssignLearningResourceInput["assignments"][number]["targetType"],
  targetId: string,
) {
  if (targetType === "COURSE") {
    return targetId;
  }

  if (targetType !== "BATCH") {
    return null;
  }

  const batch = await tx.batch.findUnique({
    where: { id: targetId },
    select: {
      program: {
        select: {
          courseId: true,
        },
      },
    },
  });

  return batch?.program.courseId ?? null;
}

async function ensureLearningResourceSourceContentForAssignmentTx(
  tx: TransactionClient,
  resourceId: string,
  assignment: AssignLearningResourceInput["assignments"][number],
  actorUserId?: string,
) {
  if (assignment.targetType !== "COURSE" && assignment.targetType !== "BATCH") {
    return null;
  }

  const resource = await tx.learningResource.findUnique({
    where: { id: resourceId },
    select: {
      id: true,
      title: true,
      description: true,
      excerpt: true,
      contentType: true,
      status: true,
      bodyJson: true,
      renderedHtml: true,
      estimatedReadingMinutes: true,
      fileUrl: true,
      fileName: true,
      fileSize: true,
      mimeType: true,
      storagePath: true,
      storageProvider: true,
      sourceContentId: true,
    },
  });

  if (!resource) {
    throw new Error("Learning resource not found.");
  }

  if (resource.sourceContentId) {
    return resource.sourceContentId;
  }

  const courseId = await resolveAssignmentTargetCourseIdTx(tx, assignment.targetType, assignment.targetId);

  if (!courseId) {
    throw new Error("A course-backed assignment target is required to publish this learning resource.");
  }

  const createdContent = await createCourseContentFromLearningResourceTx(tx, resource, courseId, actorUserId);

  await tx.learningResource.update({
    where: { id: resource.id },
    data: {
      sourceContentId: createdContent.id,
      updatedById: actorUserId ?? null,
    },
  });

  return createdContent.id;
}

function normalizeAttachments(attachments: Array<{
  title?: string;
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  storagePath?: string;
  storageProvider?: "LOCAL_PUBLIC" | "S3";
}> | undefined): AttachmentPayload[] {
  return (attachments ?? []).map((attachment, index) => ({
    title: normalizeOptionalText(attachment.title),
    fileUrl: normalizeOptionalText(attachment.fileUrl),
    fileName: attachment.fileName.trim(),
    fileSize: attachment.fileSize ?? null,
    mimeType: normalizeOptionalText(attachment.mimeType),
    storagePath: normalizeOptionalText(attachment.storagePath),
    storageProvider: attachment.storageProvider ? (attachment.storageProvider as UploadStorageProvider) : null,
    sortOrder: index,
  }));
}

function storedAssetKey(asset: StoredAssetLike) {
  if (!asset.storagePath) {
    return null;
  }

  return `${asset.storageProvider ?? "LOCAL_PUBLIC"}:${asset.storagePath}`;
}

function buildSnapshot(args: {
  title: string;
  description: string | null;
  excerpt: string | null;
  contentType: LearningResourceCreateResult["contentType"];
  status: LearningResourceCreateResult["status"];
  visibility: LearningResourceCreateResult["visibility"];
  categoryName: string | null;
  subcategoryName: string | null;
  tags: string[];
  bodyJson: LearningResourceVersionSnapshot["bodyJson"];
  renderedHtml: string | null;
  estimatedReadingMinutes: number | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  storagePath: string | null;
  storageProvider: UploadStorageProvider | null;
  attachments: AttachmentPayload[];
}): LearningResourceVersionSnapshot {
  return {
    title: args.title,
    description: args.description,
    excerpt: args.excerpt,
    contentType: args.contentType,
    status: args.status,
    visibility: args.visibility,
    categoryName: args.categoryName,
    subcategoryName: args.subcategoryName,
    tags: args.tags,
    bodyJson: args.bodyJson,
    renderedHtml: args.renderedHtml,
    estimatedReadingMinutes: args.estimatedReadingMinutes,
    fileUrl: args.fileUrl,
    fileName: args.fileName,
    fileSize: args.fileSize,
    mimeType: args.mimeType,
    storagePath: args.storagePath,
    storageProvider: args.storageProvider,
    attachments: args.attachments,
  };
}

function buildLinkedContentSnapshot(content: LinkedCourseContentRecord) {
  const authoredBodyJson = content.contentType === "ARTICLE"
    ? parseAuthoredContentAnyDocument(content.bodyJson)
    : null;

  if (content.contentType === "ARTICLE" && !authoredBodyJson) {
    throw new Error("Authored content requires body content before it can be synced into the repository.");
  }

  return {
    title: content.title,
    description: normalizeOptionalText(content.description),
    excerpt: normalizeOptionalText(content.excerpt),
    contentType: content.contentType,
    status: content.status,
    categoryName: content.course.name,
    subcategoryName: content.folder?.name ?? null,
    bodyJson: authoredBodyJson,
    renderedHtml: content.renderedHtml ?? null,
    estimatedReadingMinutes: content.contentType === "ARTICLE"
      ? content.estimatedReadingMinutes ?? estimateAnyReadingMinutes(authoredBodyJson)
      : null,
    fileUrl: content.contentType === "ARTICLE" ? null : normalizeOptionalText(content.fileUrl),
    fileName: content.contentType === "ARTICLE" ? null : normalizeOptionalText(content.fileName),
    fileSize: content.contentType === "ARTICLE" ? null : content.fileSize ?? null,
    mimeType: content.contentType === "ARTICLE" ? null : normalizeOptionalText(content.mimeType),
    storagePath: content.contentType === "ARTICLE" ? null : normalizeOptionalText(content.storagePath),
    storageProvider: content.contentType === "ARTICLE" ? null : content.storageProvider ?? null,
  };
}

function buildLinkedContentUpdateData(args: {
  title: string;
  description: string | null;
  excerpt: string | null;
  contentType: LearningResourceCreateResult["contentType"];
  status: LearningResourceCreateResult["status"];
  bodyJson: LearningResourceVersionSnapshot["bodyJson"];
  renderedHtml: string | null;
  estimatedReadingMinutes: number | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  storagePath: string | null;
  storageProvider: UploadStorageProvider | null;
}): Prisma.CourseContentUncheckedUpdateInput {
  return {
    title: args.title,
    description: args.description,
    excerpt: args.excerpt,
    contentType: args.contentType,
    status: args.status,
    bodyJson: args.bodyJson ? (args.bodyJson as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
    renderedHtml: args.renderedHtml,
    estimatedReadingMinutes: args.estimatedReadingMinutes,
    fileUrl: args.fileUrl,
    fileName: args.fileName,
    fileSize: args.fileSize,
    mimeType: args.mimeType,
    storagePath: args.storagePath,
    storageProvider: args.storageProvider,
    isScorm: args.contentType === "SCORM",
  };
}

async function syncSourceContentFromResourceTx(
  tx: TransactionClient,
  sourceContentId: string,
  args: Parameters<typeof buildLinkedContentUpdateData>[0],
) {
  await tx.courseContent.update({
    where: { id: sourceContentId },
    data: buildLinkedContentUpdateData(args),
  });
}

function hasLinkedContentSnapshotChanges(
  existing: {
    folderId: string | null;
    title: string;
    description: string | null;
    excerpt: string | null;
    contentType: LearningResourceCreateResult["contentType"];
    status: LearningResourceCreateResult["status"];
    category: { name: string } | null;
    subcategory: { name: string } | null;
    bodyJson: Prisma.JsonValue | null;
    renderedHtml: string | null;
    estimatedReadingMinutes: number | null;
    fileUrl: string | null;
    fileName: string | null;
    fileSize: number | null;
    mimeType: string | null;
    storagePath: string | null;
    storageProvider: UploadStorageProvider | null;
    attachments: Array<{ storagePath: string | null; storageProvider: UploadStorageProvider | null }>;
  },
  next: ReturnType<typeof buildLinkedContentSnapshot>,
  repositoryFolderId: string | null,
) {
  return existing.folderId !== repositoryFolderId
    || existing.title !== next.title
    || existing.description !== next.description
    || existing.excerpt !== next.excerpt
    || existing.contentType !== next.contentType
    || existing.status !== next.status
    || (existing.category?.name ?? null) !== next.categoryName
    || (existing.subcategory?.name ?? null) !== next.subcategoryName
    || JSON.stringify(existing.bodyJson ?? null) !== JSON.stringify(next.bodyJson ?? null)
    || existing.renderedHtml !== next.renderedHtml
    || existing.estimatedReadingMinutes !== next.estimatedReadingMinutes
    || existing.fileUrl !== next.fileUrl
    || existing.fileName !== next.fileName
    || existing.fileSize !== next.fileSize
    || existing.mimeType !== next.mimeType
    || existing.storagePath !== next.storagePath
    || existing.storageProvider !== next.storageProvider
    || existing.attachments.length > 0;
}

async function upsertLinkedLearningResourceFromContentTx(
  tx: TransactionClient,
  content: LinkedCourseContentRecord,
  options?: SyncLearningResourceFromContentOptions,
): Promise<SyncLinkedResourceTxResult> {
  const nextSnapshot = buildLinkedContentSnapshot(content);
  const nextRepositoryFolderId = normalizeOptionalText(options?.repositoryFolderId);
  const existing = await tx.learningResource.findUnique({
    where: { sourceContentId: content.id },
    select: {
      id: true,
      folderId: true,
      title: true,
      description: true,
      excerpt: true,
      contentType: true,
      status: true,
      visibility: true,
      category: { select: { name: true } },
      subcategory: { select: { name: true } },
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
      tags: { select: { tag: { select: { name: true } } } },
      attachments: {
        select: {
          storagePath: true,
          storageProvider: true,
        },
      },
    },
  });

  const { category, subcategory } = await resolveCategoryHierarchy(
    tx,
    nextSnapshot.categoryName,
    nextSnapshot.subcategoryName,
  );
  const repositoryFolder = await assertLearningResourceFolderExists(tx, nextRepositoryFolderId);

  if (!existing) {
    const resource = await tx.learningResource.create({
      data: {
        sourceContentId: content.id,
        folderId: repositoryFolder?.id ?? null,
        title: nextSnapshot.title,
        description: nextSnapshot.description,
        excerpt: nextSnapshot.excerpt,
        contentType: nextSnapshot.contentType,
        status: nextSnapshot.status,
        visibility: "PRIVATE",
        categoryId: category?.id ?? null,
        subcategoryId: subcategory?.id ?? null,
        bodyJson: nextSnapshot.bodyJson ? (nextSnapshot.bodyJson as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
        renderedHtml: nextSnapshot.renderedHtml,
        estimatedReadingMinutes: nextSnapshot.estimatedReadingMinutes,
        fileUrl: nextSnapshot.fileUrl,
        fileName: nextSnapshot.fileName,
        fileSize: nextSnapshot.fileSize,
        mimeType: nextSnapshot.mimeType,
        storagePath: nextSnapshot.storagePath,
        storageProvider: nextSnapshot.storageProvider,
        currentVersionNumber: 1,
        publishedAt: nextSnapshot.status === "PUBLISHED" ? new Date() : null,
        createdById: options?.actorUserId ?? null,
        updatedById: options?.actorUserId ?? null,
      },
      select: {
        id: true,
        title: true,
        contentType: true,
        status: true,
        visibility: true,
        currentVersionNumber: true,
      },
    });

    await tx.learningResourceVersion.create({
      data: {
        resourceId: resource.id,
        versionNumber: 1,
        title: resource.title,
        changeSummary: normalizeOptionalText(options?.changeSummary) ?? "Created from repository content.",
        snapshot: buildSnapshot({
          title: resource.title,
          description: nextSnapshot.description,
          excerpt: nextSnapshot.excerpt,
          contentType: resource.contentType,
          status: resource.status,
          visibility: resource.visibility,
          categoryName: category?.name ?? null,
          subcategoryName: subcategory?.name ?? null,
          tags: [],
          bodyJson: nextSnapshot.bodyJson,
          renderedHtml: nextSnapshot.renderedHtml,
          estimatedReadingMinutes: nextSnapshot.estimatedReadingMinutes,
          fileUrl: nextSnapshot.fileUrl,
          fileName: nextSnapshot.fileName,
          fileSize: nextSnapshot.fileSize,
          mimeType: nextSnapshot.mimeType,
          storagePath: nextSnapshot.storagePath,
          storageProvider: nextSnapshot.storageProvider,
          attachments: [],
        }),
        updatedById: options?.actorUserId,
      },
    });

    return {
      resource,
      action: "created",
      assetsToDelete: [],
    };
  }

  const assetsToDelete = buildAssetsToDelete(
    [
      { storagePath: existing.storagePath, storageProvider: existing.storageProvider },
      ...existing.attachments,
    ],
    [
      { storagePath: nextSnapshot.storagePath, storageProvider: nextSnapshot.storageProvider },
    ],
  );
  const effectiveFolderId = nextRepositoryFolderId ?? existing.folderId;

  if (!hasLinkedContentSnapshotChanges(existing, nextSnapshot, effectiveFolderId)) {
    return {
      resource: {
        id: existing.id,
        title: existing.title,
        contentType: existing.contentType,
        status: existing.status,
        visibility: existing.visibility,
        currentVersionNumber: existing.currentVersionNumber,
      },
      action: "unchanged",
      assetsToDelete,
    };
  }

  const nextVersionNumber = existing.currentVersionNumber + 1;
  const nextTagNames = existing.tags.map((tagLink) => tagLink.tag.name);

  const resource = await tx.learningResource.update({
    where: { id: existing.id },
    data: {
      ...(nextRepositoryFolderId !== undefined && { folderId: effectiveFolderId }),
      title: nextSnapshot.title,
      description: nextSnapshot.description,
      excerpt: nextSnapshot.excerpt,
      contentType: nextSnapshot.contentType,
      status: nextSnapshot.status,
      categoryId: category?.id ?? null,
      subcategoryId: subcategory?.id ?? null,
      bodyJson: nextSnapshot.bodyJson ? (nextSnapshot.bodyJson as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
      renderedHtml: nextSnapshot.renderedHtml,
      estimatedReadingMinutes: nextSnapshot.estimatedReadingMinutes,
      fileUrl: nextSnapshot.fileUrl,
      fileName: nextSnapshot.fileName,
      fileSize: nextSnapshot.fileSize,
      mimeType: nextSnapshot.mimeType,
      storagePath: nextSnapshot.storagePath,
      storageProvider: nextSnapshot.storageProvider,
      publishedAt: nextSnapshot.status === "PUBLISHED" ? new Date() : null,
      currentVersionNumber: nextVersionNumber,
      updatedById: options?.actorUserId ?? null,
    },
    select: {
      id: true,
      title: true,
      contentType: true,
      status: true,
      visibility: true,
      currentVersionNumber: true,
    },
  });

  await replaceAttachments(tx, resource.id, []);
  await createVersionRecord(tx, {
    resourceId: resource.id,
    versionNumber: nextVersionNumber,
    title: resource.title,
    changeSummary: normalizeOptionalText(options?.changeSummary) ?? "Synced from repository content.",
    snapshot: buildSnapshot({
      title: resource.title,
      description: nextSnapshot.description,
      excerpt: nextSnapshot.excerpt,
      contentType: resource.contentType,
      status: resource.status,
      visibility: resource.visibility,
      categoryName: category?.name ?? null,
      subcategoryName: subcategory?.name ?? null,
      tags: nextTagNames,
      bodyJson: nextSnapshot.bodyJson,
      renderedHtml: nextSnapshot.renderedHtml,
      estimatedReadingMinutes: nextSnapshot.estimatedReadingMinutes,
      fileUrl: nextSnapshot.fileUrl,
      fileName: nextSnapshot.fileName,
      fileSize: nextSnapshot.fileSize,
      mimeType: nextSnapshot.mimeType,
      storagePath: nextSnapshot.storagePath,
      storageProvider: nextSnapshot.storageProvider,
      attachments: [],
    }),
    updatedById: options?.actorUserId,
  });

  return {
    resource,
    action: "updated",
    assetsToDelete,
  };
}

async function resolveCategoryHierarchy(
  tx: TransactionClient,
  categoryName: string | null,
  subcategoryName: string | null,
) {
  const normalizedCategoryName = normalizeOptionalText(categoryName);
  const normalizedSubcategoryName = normalizeOptionalText(subcategoryName);

  if (!normalizedCategoryName) {
    return {
      category: null,
      subcategory: null,
    };
  }

  const categorySlug = sanitizeStoragePathSegment(normalizedCategoryName);
  const category = await tx.learningResourceCategory.upsert({
    where: { slug: categorySlug },
    update: {
      name: normalizedCategoryName,
      parentId: null,
      isActive: true,
    },
    create: {
      name: normalizedCategoryName,
      slug: categorySlug,
      parentId: null,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  if (!normalizedSubcategoryName) {
    return {
      category,
      subcategory: null,
    };
  }

  const subcategorySlug = `${category.slug}-${sanitizeStoragePathSegment(normalizedSubcategoryName)}`;
  const subcategory = await tx.learningResourceCategory.upsert({
    where: { slug: subcategorySlug },
    update: {
      name: normalizedSubcategoryName,
      parentId: category.id,
      isActive: true,
    },
    create: {
      name: normalizedSubcategoryName,
      slug: subcategorySlug,
      parentId: category.id,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  return { category, subcategory };
}

async function assertLearningResourceFolderExists(
  tx: TransactionClient,
  folderId: string | null | undefined,
) {
  const normalizedFolderId = normalizeOptionalText(folderId);

  if (!normalizedFolderId) {
    return null;
  }

  const folder = await tx.learningResourceFolder.findUnique({
    where: { id: normalizedFolderId },
    select: { id: true },
  });

  if (!folder) {
    throw new Error("Repository folder not found.");
  }

  return folder;
}

export async function createLearningResourceFolderService(
  input: CreateLearningResourceFolderInput,
  options?: { actorUserId?: string },
): Promise<LearningResourceFolderSummary> {
  if (!isDatabaseConfigured) {
    return {
      id: `mock-learning-resource-folder-${Date.now()}`,
      parentId: input.parentId ?? null,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      sortOrder: input.sortOrder ?? 0,
      pathLabel: input.name.trim(),
    };
  }

  const folder = await prisma.$transaction(async (tx) => {
    const existingFolders = await listLearningResourceFolderRecordsTx(tx);
    const normalizedParentId = normalizeOptionalText(input.parentId);
    const normalizedName = input.name.trim();

    if (normalizedParentId && !existingFolders.some((entry) => entry.id === normalizedParentId)) {
      throw new Error("Parent repository folder not found.");
    }

    const duplicate = existingFolders.find((entry) => (
      entry.parentId === normalizedParentId
      && entry.name.localeCompare(normalizedName, undefined, { sensitivity: "accent" }) === 0
    ));

    if (duplicate) {
      throw new Error("A repository folder with this name already exists at the selected location.");
    }

    const created = await tx.learningResourceFolder.create({
      data: {
        parentId: normalizedParentId,
        name: normalizedName,
        description: normalizeOptionalText(input.description),
        sortOrder: input.sortOrder ?? 0,
        createdById: options?.actorUserId ?? null,
      },
      select: {
        id: true,
        parentId: true,
        name: true,
        description: true,
        sortOrder: true,
      },
    });

    const summary = mapLearningResourceFolderSummaries([...existingFolders, created]).find((entry) => entry.id === created.id);

    if (!summary) {
      throw new Error("Repository folder could not be created.");
    }

    return summary;
  }, LEARNING_RESOURCE_TRANSACTION_OPTIONS);

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.LEARNING_RESOURCE_FOLDER,
    entityId: folder.id,
    action: AUDIT_ACTION_TYPE.CREATED,
    message: `Repository folder "${folder.pathLabel}" created.`,
    actorUserId: options?.actorUserId,
    metadata: {
      parentId: folder.parentId,
      sortOrder: folder.sortOrder,
    },
  });

  return folder;
}

export async function updateLearningResourceFolderService(
  input: UpdateLearningResourceFolderInput,
  options?: { actorUserId?: string },
): Promise<LearningResourceFolderSummary> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const folder = await prisma.$transaction(async (tx) => {
    const existingFolders = await listLearningResourceFolderRecordsTx(tx);
    const existing = existingFolders.find((entry) => entry.id === input.folderId) ?? null;

    if (!existing) {
      throw new Error("Repository folder not found.");
    }

    const nextParentId = input.parentId !== undefined ? normalizeOptionalText(input.parentId) : existing.parentId;
    const nextName = input.name?.trim() ?? existing.name;
    const nextDescription = input.description !== undefined ? normalizeOptionalText(input.description) : existing.description;
    const nextSortOrder = input.sortOrder ?? existing.sortOrder;

    if (nextParentId && !existingFolders.some((entry) => entry.id === nextParentId)) {
      throw new Error("Parent repository folder not found.");
    }

    assertLearningResourceFolderParentIsValid(existingFolders, existing.id, nextParentId);

    const duplicate = existingFolders.find((entry) => (
      entry.id !== existing.id
      && entry.parentId === nextParentId
      && entry.name.localeCompare(nextName, undefined, { sensitivity: "accent" }) === 0
    ));

    if (duplicate) {
      throw new Error("A repository folder with this name already exists at the selected location.");
    }

    const updated = await tx.learningResourceFolder.update({
      where: { id: input.folderId },
      data: {
        ...(input.parentId !== undefined && { parentId: nextParentId }),
        ...(input.name !== undefined && { name: nextName }),
        ...(input.description !== undefined && { description: nextDescription }),
        ...(input.sortOrder !== undefined && { sortOrder: nextSortOrder }),
      },
      select: {
        id: true,
        parentId: true,
        name: true,
        description: true,
        sortOrder: true,
      },
    });

    const summary = mapLearningResourceFolderSummaries(
      existingFolders.map((entry) => (entry.id === updated.id ? updated : entry)),
    ).find((entry) => entry.id === updated.id);

    if (!summary) {
      throw new Error("Repository folder could not be updated.");
    }

    return summary;
  }, LEARNING_RESOURCE_TRANSACTION_OPTIONS);

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.LEARNING_RESOURCE_FOLDER,
    entityId: folder.id,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `Repository folder "${folder.pathLabel}" updated.`,
    actorUserId: options?.actorUserId,
    metadata: {
      parentId: folder.parentId,
      sortOrder: folder.sortOrder,
    },
  });

  return folder;
}

export async function deleteLearningResourceFolderService(
  folderId: string,
  options?: { actorUserId?: string },
): Promise<void> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const existing = await prisma.learningResourceFolder.findUnique({
    where: { id: folderId },
    select: {
      id: true,
      name: true,
      parentId: true,
      _count: {
        select: {
          children: true,
          resources: true,
        },
      },
    },
  });

  if (!existing) {
    throw new Error("Repository folder not found.");
  }

  if (existing._count.children > 0) {
    throw new Error("Move or delete child repository folders before deleting this folder.");
  }

  if (existing._count.resources > 0) {
    throw new Error("Move or delete the repository resources in this folder before deleting it.");
  }

  await prisma.learningResourceFolder.delete({ where: { id: folderId } });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.LEARNING_RESOURCE_FOLDER,
    entityId: folderId,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `Repository folder "${existing.name}" deleted.`,
    actorUserId: options?.actorUserId,
    metadata: {
      parentId: existing.parentId,
      deleted: true,
    },
  });
}

async function syncTags(tx: TransactionClient, resourceId: string, tagNames: string[]) {
  const normalizedTagNames = normalizeTagNames(tagNames);

  await tx.learningResourceTagMap.deleteMany({ where: { resourceId } });

  if (normalizedTagNames.length === 0) {
    return normalizedTagNames;
  }

  await tx.learningResourceTag.createMany({
    data: normalizedTagNames.map((name) => ({
      name,
      slug: sanitizeStoragePathSegment(name),
    })),
    skipDuplicates: true,
  });

  const tags = await tx.learningResourceTag.findMany({
    where: {
      slug: {
        in: normalizedTagNames.map((name) => sanitizeStoragePathSegment(name)),
      },
    },
    select: { id: true },
  });

  await tx.learningResourceTagMap.createMany({
    data: tags.map((tag) => ({ resourceId, tagId: tag.id })),
    skipDuplicates: true,
  });

  return normalizedTagNames;
}

async function replaceAttachments(tx: TransactionClient, resourceId: string, attachments: AttachmentPayload[]) {
  await tx.learningResourceAttachment.deleteMany({ where: { resourceId } });

  if (attachments.length === 0) {
    return;
  }

  await tx.learningResourceAttachment.createMany({
    data: attachments.map((attachment) => ({
      resourceId,
      title: attachment.title,
      fileUrl: attachment.fileUrl,
      fileName: attachment.fileName,
      fileSize: attachment.fileSize,
      mimeType: attachment.mimeType,
      storagePath: attachment.storagePath,
      storageProvider: attachment.storageProvider,
      sortOrder: attachment.sortOrder,
    })),
  });
}

async function createVersionRecord(
  tx: TransactionClient,
  args: {
    resourceId: string;
    versionNumber: number;
    title: string;
    changeSummary: string | null;
    snapshot: LearningResourceVersionSnapshot;
    updatedById?: string;
  },
) {
  await tx.learningResourceVersion.create({
    data: {
      resourceId: args.resourceId,
      versionNumber: args.versionNumber,
      title: args.title,
      changeSummary: args.changeSummary,
      snapshot: args.snapshot as unknown as Prisma.InputJsonValue,
      updatedById: args.updatedById ?? null,
    },
  });
}

async function getCurrentResourceSnapshotRecord(tx: TransactionClient, resourceId: string) {
  return tx.learningResource.findFirst({
    where: { id: resourceId, deletedAt: null },
    select: {
      id: true,
      title: true,
      description: true,
      excerpt: true,
      contentType: true,
      status: true,
      visibility: true,
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
      category: { select: { name: true } },
      subcategory: { select: { name: true } },
      tags: { select: { tag: { select: { name: true } } } },
      attachments: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          title: true,
          fileUrl: true,
          fileName: true,
          fileSize: true,
          mimeType: true,
          storagePath: true,
          storageProvider: true,
          sortOrder: true,
        },
      },
      sourceContent: {
        select: {
          course: { select: { name: true } },
        },
      },
    },
  });
}

function buildCurrentResourceSnapshot(
  resource: NonNullable<Awaited<ReturnType<typeof getCurrentResourceSnapshotRecord>>>,
): LearningResourceVersionSnapshot {
  return buildSnapshot({
    title: resource.title,
    description: resource.description,
    excerpt: resource.excerpt,
    contentType: resource.contentType,
    status: resource.status,
    visibility: resource.visibility,
    categoryName: resource.category?.name ?? null,
    subcategoryName: resource.subcategory?.name ?? null,
    tags: resource.tags.map((tagLink) => tagLink.tag.name),
    bodyJson: parseAuthoredContentAnyDocument(resource.bodyJson),
    renderedHtml: resource.renderedHtml,
    estimatedReadingMinutes: resource.estimatedReadingMinutes,
    fileUrl: resource.fileUrl,
    fileName: resource.fileName,
    fileSize: resource.fileSize,
    mimeType: resource.mimeType,
    storagePath: resource.storagePath,
    storageProvider: resource.storageProvider,
    attachments: resource.attachments.map((attachment) => ({
      title: attachment.title,
      fileUrl: attachment.fileUrl,
      fileName: attachment.fileName,
      fileSize: attachment.fileSize,
      mimeType: attachment.mimeType,
      storagePath: attachment.storagePath,
      storageProvider: attachment.storageProvider,
      sortOrder: attachment.sortOrder,
    })),
  });
}

async function assertAssignmentTargetExists(
  tx: TransactionClient,
  targetType: AssignLearningResourceInput["assignments"][number]["targetType"],
  targetId: string,
) {
  let exists = false;

  if (targetType === "COURSE") {
    exists = Boolean(await tx.course.findUnique({ where: { id: targetId }, select: { id: true } }));
  } else if (targetType === "BATCH") {
    exists = Boolean(await tx.batch.findUnique({ where: { id: targetId }, select: { id: true } }));
  } else if (targetType === "ASSESSMENT_POOL") {
    exists = Boolean(await tx.assessmentPool.findUnique({ where: { id: targetId }, select: { id: true } }));
  } else if (targetType === "SCHEDULE_EVENT") {
    exists = Boolean(await tx.batchScheduleEvent.findUnique({ where: { id: targetId }, select: { id: true } }));
  }

  if (!exists) {
    throw new Error(`Assignment target not found for ${targetType}.`);
  }
}

function buildAssetsToDelete(existing: StoredAssetLike[], next: StoredAssetLike[]) {
  const nextKeys = new Set(next.map(storedAssetKey).filter(Boolean));

  return existing.filter((asset) => {
    const key = storedAssetKey(asset);
    return key && !nextKeys.has(key);
  });
}

export async function createLearningResourceService(
  input: CreateLearningResourceInput,
  options?: { actorUserId?: string },
): Promise<LearningResourceCreateResult> {
  const isAuthoredContent = input.contentType === "ARTICLE";
  const authoredBodyJson = isAuthoredContent ? parseAuthoredContentAnyDocument(input.bodyJson) : null;

  if (isAuthoredContent && !authoredBodyJson) {
    throw new Error("Authored resources require body content.");
  }

  const normalizedFileUrl = isAuthoredContent ? null : normalizeOptionalText(input.fileUrl);
  if (!isAuthoredContent && !normalizedFileUrl) {
    throw new Error("A file or destination URL is required for this resource type.");
  }

  const excerpt = isAuthoredContent
    ? normalizeOptionalText(input.excerpt) ?? extractAnyExcerpt(authoredBodyJson)
    : normalizeOptionalText(input.excerpt);
  const estimatedReadingMinutes = isAuthoredContent
    ? input.estimatedReadingMinutes ?? estimateAnyReadingMinutes(authoredBodyJson)
    : null;
  const renderedHtml = isAuthoredContent ? renderAnyDocumentToHtml(authoredBodyJson) : null;
  const attachments = normalizeAttachments(input.attachments);
  const tagNames = normalizeTagNames(input.tags);

  if (!isDatabaseConfigured) {
    return {
      id: `mock-resource-${Date.now()}`,
      title: input.title,
      contentType: input.contentType,
      status: input.status,
      visibility: input.visibility,
      currentVersionNumber: 1,
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const { category, subcategory } = await resolveCategoryHierarchy(
      tx,
      input.categoryName,
      input.subcategoryName,
    );
    const folder = await assertLearningResourceFolderExists(tx, input.folderId);

    const resource = await tx.learningResource.create({
      data: {
        title: input.title.trim(),
        description: normalizeOptionalText(input.description),
        excerpt,
        contentType: input.contentType,
        status: input.status,
        visibility: input.visibility,
        folderId: folder?.id ?? null,
        categoryId: category?.id ?? null,
        subcategoryId: subcategory?.id ?? null,
        bodyJson: authoredBodyJson ? (authoredBodyJson as unknown as Prisma.InputJsonValue) : undefined,
        renderedHtml,
        estimatedReadingMinutes,
        fileUrl: normalizedFileUrl,
        fileName: isAuthoredContent ? null : normalizeOptionalText(input.fileName),
        fileSize: isAuthoredContent ? null : input.fileSize ?? null,
        mimeType: isAuthoredContent ? null : normalizeOptionalText(input.mimeType),
        storagePath: isAuthoredContent ? null : normalizeOptionalText(input.storagePath),
        storageProvider: isAuthoredContent ? null : input.storageProvider ?? null,
        currentVersionNumber: 1,
        publishedAt: input.status === "PUBLISHED" ? new Date() : null,
        createdById: options?.actorUserId ?? null,
        updatedById: options?.actorUserId ?? null,
      },
      select: {
        id: true,
        title: true,
        contentType: true,
        status: true,
        visibility: true,
        currentVersionNumber: true,
      },
    });

    await syncTags(tx, resource.id, tagNames);
    await replaceAttachments(tx, resource.id, attachments);
    await createVersionRecord(tx, {
      resourceId: resource.id,
      versionNumber: 1,
      title: resource.title,
      changeSummary: normalizeOptionalText(input.changeSummary) ?? "Initial version",
      snapshot: buildSnapshot({
        title: resource.title,
        description: normalizeOptionalText(input.description),
        excerpt,
        contentType: resource.contentType,
        status: resource.status,
        visibility: resource.visibility,
        categoryName: category?.name ?? null,
        subcategoryName: subcategory?.name ?? null,
        tags: tagNames,
        bodyJson: authoredBodyJson,
        renderedHtml,
        estimatedReadingMinutes,
        fileUrl: normalizedFileUrl,
        fileName: isAuthoredContent ? null : normalizeOptionalText(input.fileName),
        fileSize: isAuthoredContent ? null : input.fileSize ?? null,
        mimeType: isAuthoredContent ? null : normalizeOptionalText(input.mimeType),
        storagePath: isAuthoredContent ? null : normalizeOptionalText(input.storagePath),
        storageProvider: isAuthoredContent ? null : input.storageProvider ?? null,
        attachments,
      }),
      updatedById: options?.actorUserId,
    });

    return resource;
  }, LEARNING_RESOURCE_TRANSACTION_OPTIONS);

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.LEARNING_RESOURCE,
    entityId: result.id,
    action: AUDIT_ACTION_TYPE.CREATED,
    message: `Learning resource "${result.title}" created.`,
    actorUserId: options?.actorUserId,
    metadata: {
      contentType: result.contentType,
      status: result.status,
      visibility: result.visibility,
    },
  });

  return result;
}

export async function syncLearningResourceFromContentService(
  contentId: string,
  options?: SyncLearningResourceFromContentOptions,
): Promise<LearningResourceCreateResult> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const content = await prisma.courseContent.findUnique({
    where: { id: contentId },
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
      status: true,
      course: { select: { name: true } },
      folder: { select: { name: true } },
    },
  });

  if (!content) {
    throw new Error("Content not found.");
  }

  const result = await prisma.$transaction(
    (tx) => upsertLinkedLearningResourceFromContentTx(tx, content, options),
    LEARNING_RESOURCE_TRANSACTION_OPTIONS,
  );

  for (const asset of result.assetsToDelete) {
    await deleteStoredUploadAssetIfUnreferenced({
      storagePath: asset.storagePath,
      storageProvider: asset.storageProvider,
    });
  }

  if (result.action === "created") {
    await createAuditLogEntry({
      entityType: AUDIT_ENTITY_TYPE.LEARNING_RESOURCE,
      entityId: result.resource.id,
      action: AUDIT_ACTION_TYPE.CREATED,
      message: `Learning resource "${result.resource.title}" created from repository content.`,
      actorUserId: options?.actorUserId,
      metadata: {
        sourceContentId: content.id,
        contentType: result.resource.contentType,
        status: result.resource.status,
        visibility: result.resource.visibility,
      },
    });
  } else if (result.action === "updated") {
    await createAuditLogEntry({
      entityType: AUDIT_ENTITY_TYPE.LEARNING_RESOURCE,
      entityId: result.resource.id,
      action: AUDIT_ACTION_TYPE.UPDATED,
      message: `Learning resource "${result.resource.title}" synced from repository content.`,
      actorUserId: options?.actorUserId,
      metadata: {
        sourceContentId: content.id,
        contentType: result.resource.contentType,
        status: result.resource.status,
        visibility: result.resource.visibility,
        versionNumber: result.resource.currentVersionNumber,
      },
    });
  }

  return result.resource;
}

export async function syncLearningResourcesFromContentService(
  contentIds: string[],
  options?: { actorUserId?: string; changeSummary?: string },
): Promise<LearningResourceCreateResult[]> {
  const uniqueContentIds = Array.from(new Set(contentIds.map((value) => value.trim()).filter(Boolean)));
  const results: LearningResourceCreateResult[] = [];

  for (const contentId of uniqueContentIds) {
    results.push(await syncLearningResourceFromContentService(contentId, options));
  }

  return results;
}

export async function importCourseContentToLearningResourceService(
  input: ImportLearningResourceInput,
  options?: { actorUserId?: string },
): Promise<LearningResourceCreateResult> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const content = await prisma.courseContent.findUnique({
    where: { id: input.contentId },
    select: {
      id: true,
      title: true,
      description: true,
      excerpt: true,
      contentType: true,
      bodyJson: true,
      estimatedReadingMinutes: true,
      fileUrl: true,
      fileName: true,
      fileSize: true,
      mimeType: true,
      storagePath: true,
      storageProvider: true,
      status: true,
      course: { select: { name: true } },
      folder: { select: { name: true } },
    },
  });

  if (!content) {
    throw new Error("Content not found.");
  }

  const importedBodyJson = content.contentType === "ARTICLE"
    ? parseAuthoredContentAnyDocument(content.bodyJson)
    : null;

  if (content.contentType === "ARTICLE" && !importedBodyJson) {
    throw new Error("Authored course content cannot be imported without body content.");
  }

  const importedResource = await createLearningResourceService({
    title: normalizeOptionalText(input.title) ?? content.title,
    description: content.description ?? "",
    excerpt: content.excerpt ?? "",
    contentType: content.contentType,
    status: input.status ?? content.status,
    visibility: input.visibility ?? "PRIVATE",
    categoryName: normalizeOptionalText(input.categoryName) ?? content.course.name,
    subcategoryName: normalizeOptionalText(input.subcategoryName) ?? content.folder?.name ?? "",
    tags: [],
    fileUrl: content.fileUrl ?? "",
    fileName: content.fileName ?? "",
    fileSize: content.fileSize ?? undefined,
    mimeType: content.mimeType ?? "",
    storagePath: content.storagePath ?? "",
    storageProvider: content.storageProvider ?? undefined,
    bodyJson: importedBodyJson,
    estimatedReadingMinutes: importedBodyJson ? (content.estimatedReadingMinutes ?? undefined) : undefined,
    attachments: [],
    changeSummary: normalizeOptionalText(input.changeSummary)
      ?? `Imported from Content Library: ${content.course.name}${content.folder?.name ? ` / ${content.folder.name}` : ""}`,
  }, options);

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.LEARNING_RESOURCE,
    entityId: importedResource.id,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `Learning resource "${importedResource.title}" imported from content library.`,
    actorUserId: options?.actorUserId,
    metadata: {
      importedFromContentId: content.id,
      importedFromCourse: content.course.name,
      importedFromFolder: content.folder?.name ?? null,
    },
  });

  return importedResource;
}

export async function updateLearningResourceService(
  input: UpdateLearningResourceInput,
  options?: { actorUserId?: string },
): Promise<LearningResourceCreateResult> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const existing = await prisma.learningResource.findFirst({
    where: { id: input.resourceId, deletedAt: null },
    select: {
      id: true,
      sourceContentId: true,
      folderId: true,
      title: true,
      description: true,
      excerpt: true,
      contentType: true,
      status: true,
      visibility: true,
      category: { select: { name: true } },
      subcategory: { select: { name: true } },
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
      tags: { select: { tag: { select: { name: true } } } },
      attachments: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          title: true,
          fileUrl: true,
          fileName: true,
          fileSize: true,
          mimeType: true,
          storagePath: true,
          storageProvider: true,
          sortOrder: true,
        },
      },
    },
  });

  if (!existing) {
    throw new Error("Learning resource not found.");
  }

  const nextContentType = input.contentType ?? existing.contentType;
  const isAuthoredContent = nextContentType === "ARTICLE";
  const nextBodyJson = isAuthoredContent
    ? parseAuthoredContentAnyDocument(input.bodyJson !== undefined ? input.bodyJson : existing.bodyJson)
    : null;

  if (isAuthoredContent && !nextBodyJson) {
    throw new Error("Authored resources require body content.");
  }

  const nextFileUrl = isAuthoredContent
    ? null
    : normalizeOptionalText(input.fileUrl !== undefined ? input.fileUrl : existing.fileUrl);

  if (!isAuthoredContent && !nextFileUrl) {
    throw new Error("A file or destination URL is required for this resource type.");
  }

  const nextExcerpt = isAuthoredContent
    ? normalizeOptionalText(input.excerpt !== undefined ? input.excerpt : existing.excerpt) ?? extractAnyExcerpt(nextBodyJson)
    : normalizeOptionalText(input.excerpt !== undefined ? input.excerpt : existing.excerpt);
  const nextEstimatedReadingMinutes = isAuthoredContent
    ? input.estimatedReadingMinutes ?? existing.estimatedReadingMinutes ?? estimateAnyReadingMinutes(nextBodyJson)
    : null;
  const nextRenderedHtml = isAuthoredContent ? renderAnyDocumentToHtml(nextBodyJson) : null;
  const nextTagNames = input.tags !== undefined
    ? normalizeTagNames(input.tags)
    : existing.tags.map((tagLink) => tagLink.tag.name);
  const nextAttachments = input.attachments !== undefined
    ? normalizeAttachments(input.attachments)
    : existing.attachments.map((attachment) => ({
      title: attachment.title,
      fileUrl: attachment.fileUrl,
      fileName: attachment.fileName,
      fileSize: attachment.fileSize,
      mimeType: attachment.mimeType,
      storagePath: attachment.storagePath,
      storageProvider: attachment.storageProvider,
      sortOrder: attachment.sortOrder,
    }));
  const normalizedNextAttachments = existing.sourceContentId ? [] : nextAttachments;
  const nextFolderId = input.folderId !== undefined ? normalizeOptionalText(input.folderId) : existing.folderId ?? null;
  const nextCategoryName = input.categoryName !== undefined ? normalizeOptionalText(input.categoryName) : existing.category?.name ?? null;
  const nextSubcategoryName = input.subcategoryName !== undefined ? normalizeOptionalText(input.subcategoryName) : existing.subcategory?.name ?? null;
  const nextTitle = input.title?.trim() ?? existing.title;
  const nextDescription = normalizeOptionalText(input.description !== undefined ? input.description : existing.description);
  const nextStatus = input.status ?? existing.status;
  const nextVisibility = input.visibility ?? existing.visibility;
  const nextFileName = isAuthoredContent
    ? null
    : normalizeOptionalText(input.fileName !== undefined ? input.fileName : existing.fileName);
  const nextFileSize = isAuthoredContent
    ? null
    : input.fileSize !== undefined ? input.fileSize : existing.fileSize;
  const nextMimeType = isAuthoredContent
    ? null
    : normalizeOptionalText(input.mimeType !== undefined ? input.mimeType : existing.mimeType);
  const nextStoragePath = isAuthoredContent
    ? null
    : normalizeOptionalText(input.storagePath !== undefined ? input.storagePath : existing.storagePath);
  const nextStorageProvider = isAuthoredContent
    ? null
    : input.storageProvider !== undefined ? (input.storageProvider as UploadStorageProvider) : existing.storageProvider;
  const assetsToDelete = buildAssetsToDelete(
    [
      { storagePath: existing.storagePath, storageProvider: existing.storageProvider },
      ...existing.attachments.map((attachment) => ({
        storagePath: attachment.storagePath,
        storageProvider: attachment.storageProvider,
      })),
    ],
    [
      { storagePath: nextStoragePath, storageProvider: nextStorageProvider },
      ...normalizedNextAttachments.map((attachment) => ({
        storagePath: attachment.storagePath,
        storageProvider: attachment.storageProvider,
      })),
    ],
  );

  const result = await prisma.$transaction(async (tx) => {
    const { category, subcategory } = await resolveCategoryHierarchy(tx, nextCategoryName, nextSubcategoryName);
    const folder = await assertLearningResourceFolderExists(tx, nextFolderId);
    const nextVersionNumber = existing.currentVersionNumber + 1;

    const resource = await tx.learningResource.update({
      where: { id: input.resourceId },
      data: {
        title: nextTitle,
        description: nextDescription,
        excerpt: nextExcerpt,
        contentType: nextContentType,
        status: nextStatus,
        visibility: nextVisibility,
        folderId: folder?.id ?? null,
        categoryId: category?.id ?? null,
        subcategoryId: subcategory?.id ?? null,
        bodyJson: isAuthoredContent ? (nextBodyJson as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
        renderedHtml: nextRenderedHtml,
        estimatedReadingMinutes: nextEstimatedReadingMinutes,
        fileUrl: nextFileUrl,
        fileName: nextFileName,
        fileSize: nextFileSize,
        mimeType: nextMimeType,
        storagePath: nextStoragePath,
        storageProvider: nextStorageProvider,
        publishedAt: nextStatus === "PUBLISHED" ? new Date() : null,
        currentVersionNumber: nextVersionNumber,
        updatedById: options?.actorUserId ?? null,
      },
      select: {
        id: true,
        title: true,
        contentType: true,
        status: true,
        visibility: true,
        currentVersionNumber: true,
      },
    });

    if (input.tags !== undefined) {
      await syncTags(tx, resource.id, nextTagNames);
    }

    if (input.attachments !== undefined || (existing.sourceContentId && existing.attachments.length > 0)) {
      await replaceAttachments(tx, resource.id, normalizedNextAttachments);
    }

    if (existing.sourceContentId) {
      await syncSourceContentFromResourceTx(tx, existing.sourceContentId, {
        title: nextTitle,
        description: nextDescription,
        excerpt: nextExcerpt,
        contentType: nextContentType,
        status: nextStatus,
        bodyJson: nextBodyJson,
        renderedHtml: nextRenderedHtml,
        estimatedReadingMinutes: nextEstimatedReadingMinutes,
        fileUrl: nextFileUrl,
        fileName: nextFileName,
        fileSize: nextFileSize ?? null,
        mimeType: nextMimeType,
        storagePath: nextStoragePath,
        storageProvider: nextStorageProvider,
      });
    }

    await createVersionRecord(tx, {
      resourceId: resource.id,
      versionNumber: nextVersionNumber,
      title: resource.title,
      changeSummary: normalizeOptionalText(input.changeSummary),
      snapshot: buildSnapshot({
        title: resource.title,
        description: nextDescription,
        excerpt: nextExcerpt,
        contentType: resource.contentType,
        status: resource.status,
        visibility: resource.visibility,
        categoryName: category?.name ?? null,
        subcategoryName: subcategory?.name ?? null,
        tags: nextTagNames,
        bodyJson: nextBodyJson,
        renderedHtml: nextRenderedHtml,
        estimatedReadingMinutes: nextEstimatedReadingMinutes,
        fileUrl: nextFileUrl,
        fileName: nextFileName,
        fileSize: nextFileSize ?? null,
        mimeType: nextMimeType,
        storagePath: nextStoragePath,
        storageProvider: nextStorageProvider,
        attachments: normalizedNextAttachments,
      }),
      updatedById: options?.actorUserId,
    });

    return resource;
  }, LEARNING_RESOURCE_TRANSACTION_OPTIONS);

  for (const asset of assetsToDelete) {
    await deleteStoredUploadAssetIfUnreferenced({
      storagePath: asset.storagePath,
      storageProvider: asset.storageProvider,
    });
  }

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.LEARNING_RESOURCE,
    entityId: result.id,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `Learning resource "${result.title}" updated.`,
    actorUserId: options?.actorUserId,
    metadata: {
      contentType: result.contentType,
      status: result.status,
      visibility: result.visibility,
      versionNumber: result.currentVersionNumber,
    },
  });

  return result;
}

export async function deleteLearningResourceService(
  resourceId: string,
  options?: { actorUserId?: string },
): Promise<LearningResourceCreateResult> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const existing = await prisma.learningResource.findFirst({
    where: { id: resourceId, deletedAt: null },
    select: {
      id: true,
      sourceContentId: true,
      title: true,
      contentType: true,
      status: true,
      visibility: true,
      currentVersionNumber: true,
      storagePath: true,
      storageProvider: true,
      attachments: {
        select: {
          storagePath: true,
          storageProvider: true,
        },
      },
    },
  });

  if (!existing) {
    throw new Error("Learning resource not found.");
  }

  if (existing.sourceContentId) {
    throw new Error("Linked repository items must be deleted from the repository explorer.");
  }

  const deleted = await prisma.learningResource.update({
    where: { id: resourceId },
    data: {
      deletedAt: new Date(),
      deletedById: options?.actorUserId ?? null,
      updatedById: options?.actorUserId ?? null,
    },
    select: {
      id: true,
      title: true,
      contentType: true,
      status: true,
      visibility: true,
      currentVersionNumber: true,
    },
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.LEARNING_RESOURCE,
    entityId: deleted.id,
    action: AUDIT_ACTION_TYPE.DELETED,
    message: `Learning resource "${deleted.title}" moved to recycle bin.`,
    actorUserId: options?.actorUserId,
    metadata: {
      softDeleted: true,
      contentType: deleted.contentType,
      status: deleted.status,
      visibility: deleted.visibility,
    },
  });

  return deleted;
}

export async function restoreDeletedLearningResourceService(
  resourceId: string,
  options?: { actorUserId?: string },
): Promise<LearningResourceCreateResult> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const existing = await prisma.learningResource.findFirst({
    where: { id: resourceId },
    select: {
      id: true,
      title: true,
      contentType: true,
      status: true,
      visibility: true,
      currentVersionNumber: true,
      deletedAt: true,
    },
  });

  if (!existing) {
    throw new Error("Learning resource not found.");
  }

  if (!existing.deletedAt) {
    throw new Error("Learning resource is already active.");
  }

  const restored = await prisma.learningResource.update({
    where: { id: resourceId },
    data: {
      deletedAt: null,
      deletedById: null,
      updatedById: options?.actorUserId ?? null,
    },
    select: {
      id: true,
      title: true,
      contentType: true,
      status: true,
      visibility: true,
      currentVersionNumber: true,
    },
  });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.LEARNING_RESOURCE,
    entityId: restored.id,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `Learning resource "${restored.title}" restored from recycle bin.`,
    actorUserId: options?.actorUserId,
    metadata: {
      restoredFromRecycleBin: true,
      contentType: restored.contentType,
      status: restored.status,
      visibility: restored.visibility,
    },
  });

  return restored;
}

export async function assignLearningResourceService(
  resourceId: string,
  input: AssignLearningResourceInput,
  options?: { actorUserId?: string },
) {
  if (!isDatabaseConfigured) {
    return [];
  }

  const resource = await prisma.learningResource.findFirst({
    where: { id: resourceId, deletedAt: null },
    select: { id: true, title: true },
  });

  if (!resource) {
    throw new Error("Learning resource not found.");
  }

  await prisma.$transaction(async (tx) => {
    const versionResource = await getCurrentResourceSnapshotRecord(tx, resourceId);

    if (!versionResource) {
      throw new Error("Learning resource not found.");
    }

    let nextVersionNumber = versionResource.currentVersionNumber;

    for (const assignment of input.assignments) {
      await assertAssignmentTargetExists(tx, assignment.targetType, assignment.targetId);
      await ensureLearningResourceSourceContentForAssignmentTx(tx, resourceId, assignment, options?.actorUserId);

      await tx.learningResourceAssignment.upsert({
        where: {
          resourceId_targetType_targetId: {
            resourceId,
            targetType: assignment.targetType,
            targetId: assignment.targetId,
          },
        },
        update: {
          notes: normalizeOptionalText(assignment.notes),
          assignedById: options?.actorUserId ?? null,
        },
        create: {
          resourceId,
          targetType: assignment.targetType,
          targetId: assignment.targetId,
          notes: normalizeOptionalText(assignment.notes),
          assignedById: options?.actorUserId ?? null,
        },
      });

      if (assignment.targetType === "COURSE") {
        const targetCourse = await tx.course.findUnique({
          where: { id: assignment.targetId },
          select: { name: true },
        });

        nextVersionNumber += 1;

        await tx.learningResource.update({
          where: { id: resourceId },
          data: {
            currentVersionNumber: nextVersionNumber,
            updatedById: options?.actorUserId ?? null,
          },
        });

        await createVersionRecord(tx, {
          resourceId,
          versionNumber: nextVersionNumber,
          title: versionResource.title,
          changeSummary: `Shared from ${versionResource.sourceContent?.course.name ?? "Repository"} to ${targetCourse?.name ?? assignment.targetId}`,
          snapshot: buildCurrentResourceSnapshot(versionResource),
          updatedById: options?.actorUserId,
        });
      }
    }
  }, LEARNING_RESOURCE_TRANSACTION_OPTIONS);

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.LEARNING_RESOURCE,
    entityId: resource.id,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `Learning resource "${resource.title}" assignments updated.`,
    actorUserId: options?.actorUserId,
    metadata: {
      assignedCount: input.assignments.length,
      targetTypes: input.assignments.map((assignment) => assignment.targetType),
    },
  });

  return prisma.learningResourceAssignment.findMany({
    where: { resourceId },
    orderBy: { assignedAt: "desc" },
    select: {
      id: true,
      targetType: true,
      targetId: true,
      notes: true,
      assignedAt: true,
      assignedBy: { select: { name: true } },
    },
  });
}

export async function removeLearningResourceAssignmentService(
  resourceId: string,
  assignmentId: string,
  options?: { actorUserId?: string },
) {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const assignment = await prisma.learningResourceAssignment.findFirst({
    where: { id: assignmentId, resourceId },
    select: { id: true, targetType: true, targetId: true, resource: { select: { title: true } } },
  });

  if (!assignment) {
    throw new Error("Resource assignment not found.");
  }

  await prisma.learningResourceAssignment.delete({ where: { id: assignmentId } });

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.LEARNING_RESOURCE,
    entityId: resourceId,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `Learning resource "${assignment.resource.title}" assignment removed.`,
    actorUserId: options?.actorUserId,
    metadata: {
      targetType: assignment.targetType,
      targetId: assignment.targetId,
      removed: true,
    },
  });
}

export async function restoreLearningResourceVersionService(
  resourceId: string,
  input: RestoreLearningResourceVersionInput,
  options?: { actorUserId?: string },
): Promise<LearningResourceCreateResult> {
  if (!isDatabaseConfigured) {
    throw new Error("Database not configured.");
  }

  const resource = await prisma.learningResource.findFirst({
    where: { id: resourceId, deletedAt: null },
    select: {
      id: true,
      sourceContentId: true,
      title: true,
      contentType: true,
      status: true,
      visibility: true,
      currentVersionNumber: true,
      storagePath: true,
      storageProvider: true,
      attachments: {
        select: {
          storagePath: true,
          storageProvider: true,
        },
      },
    },
  });

  if (!resource) {
    throw new Error("Learning resource not found.");
  }

  const version = await prisma.learningResourceVersion.findFirst({
    where: { id: input.versionId, resourceId },
    select: {
      versionNumber: true,
      snapshot: true,
    },
  });

  if (!version) {
    throw new Error("Learning resource version not found.");
  }

  const snapshot = version.snapshot as unknown as LearningResourceVersionSnapshot;
  const nextSnapshotAttachments = resource.sourceContentId ? [] : snapshot.attachments;
  const assetsToDelete = buildAssetsToDelete(
    [
      { storagePath: resource.storagePath, storageProvider: resource.storageProvider },
      ...resource.attachments,
    ],
    [
      { storagePath: snapshot.storagePath, storageProvider: snapshot.storageProvider },
      ...nextSnapshotAttachments.map((attachment) => ({
        storagePath: attachment.storagePath,
        storageProvider: attachment.storageProvider,
      })),
    ],
  );

  const result = await prisma.$transaction(async (tx) => {
    const { category, subcategory } = await resolveCategoryHierarchy(tx, snapshot.categoryName, snapshot.subcategoryName);
    const nextVersionNumber = resource.currentVersionNumber + 1;

    const restored = await tx.learningResource.update({
      where: { id: resourceId },
      data: {
        title: snapshot.title,
        description: snapshot.description,
        excerpt: snapshot.excerpt,
        contentType: snapshot.contentType,
        status: snapshot.status,
        visibility: snapshot.visibility,
        categoryId: category?.id ?? null,
        subcategoryId: subcategory?.id ?? null,
        bodyJson: snapshot.bodyJson ? (snapshot.bodyJson as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
        renderedHtml: snapshot.renderedHtml,
        estimatedReadingMinutes: snapshot.estimatedReadingMinutes,
        fileUrl: snapshot.fileUrl,
        fileName: snapshot.fileName,
        fileSize: snapshot.fileSize,
        mimeType: snapshot.mimeType,
        storagePath: snapshot.storagePath,
        storageProvider: snapshot.storageProvider,
        publishedAt: snapshot.status === "PUBLISHED" ? new Date() : null,
        currentVersionNumber: nextVersionNumber,
        updatedById: options?.actorUserId ?? null,
      },
      select: {
        id: true,
        title: true,
        contentType: true,
        status: true,
        visibility: true,
        currentVersionNumber: true,
      },
    });

    await syncTags(tx, resourceId, snapshot.tags);
    await replaceAttachments(tx, resourceId, nextSnapshotAttachments);

    if (resource.sourceContentId) {
      await syncSourceContentFromResourceTx(tx, resource.sourceContentId, {
        title: snapshot.title,
        description: snapshot.description,
        excerpt: snapshot.excerpt,
        contentType: snapshot.contentType,
        status: snapshot.status,
        bodyJson: snapshot.bodyJson,
        renderedHtml: snapshot.renderedHtml,
        estimatedReadingMinutes: snapshot.estimatedReadingMinutes,
        fileUrl: snapshot.fileUrl,
        fileName: snapshot.fileName,
        fileSize: snapshot.fileSize,
        mimeType: snapshot.mimeType,
        storagePath: snapshot.storagePath,
        storageProvider: snapshot.storageProvider,
      });
    }

    await createVersionRecord(tx, {
      resourceId,
      versionNumber: nextVersionNumber,
      title: snapshot.title,
      changeSummary: normalizeOptionalText(input.changeSummary) ?? `Restored from version ${version.versionNumber}`,
      snapshot: buildSnapshot({
        title: snapshot.title,
        description: snapshot.description,
        excerpt: snapshot.excerpt,
        contentType: snapshot.contentType,
        status: snapshot.status,
        visibility: snapshot.visibility,
        categoryName: category?.name ?? null,
        subcategoryName: subcategory?.name ?? null,
        tags: snapshot.tags,
        bodyJson: snapshot.bodyJson,
        renderedHtml: snapshot.renderedHtml,
        estimatedReadingMinutes: snapshot.estimatedReadingMinutes,
        fileUrl: snapshot.fileUrl,
        fileName: snapshot.fileName,
        fileSize: snapshot.fileSize,
        mimeType: snapshot.mimeType,
        storagePath: snapshot.storagePath,
        storageProvider: snapshot.storageProvider,
        attachments: nextSnapshotAttachments,
      }),
      updatedById: options?.actorUserId,
    });

    return restored;
  }, LEARNING_RESOURCE_TRANSACTION_OPTIONS);

  for (const asset of assetsToDelete) {
    await deleteStoredUploadAssetIfUnreferenced({
      storagePath: asset.storagePath,
      storageProvider: asset.storageProvider,
    });
  }

  await createAuditLogEntry({
    entityType: AUDIT_ENTITY_TYPE.LEARNING_RESOURCE,
    entityId: result.id,
    action: AUDIT_ACTION_TYPE.UPDATED,
    message: `Learning resource "${result.title}" restored from version ${version.versionNumber}.`,
    actorUserId: options?.actorUserId,
    metadata: {
      restoredFromVersion: version.versionNumber,
      versionNumber: result.currentVersionNumber,
    },
  });

  return result;
}

export async function recordLearningResourceUsageService(
  resourceId: string,
  input: RecordLearningResourceUsageInput,
  options?: { actorUserId?: string },
) {
  if (!isDatabaseConfigured) {
    return null;
  }

  const resource = await prisma.learningResource.findFirst({
    where: { id: resourceId, deletedAt: null },
    select: { id: true },
  });

  if (!resource) {
    throw new Error("Learning resource not found.");
  }

  return prisma.learningResourceUsage.create({
    data: {
      resourceId,
      assignmentId: input.assignmentId ?? null,
      actorUserId: options?.actorUserId ?? null,
      eventType: input.eventType,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
    select: {
      id: true,
      eventType: true,
      createdAt: true,
    },
  });
}

export async function getLearningResourceAssetService(
  resourceId: string,
  options?: { attachmentId?: string; download?: boolean; actorUserId?: string },
) {
  if (!isDatabaseConfigured) {
    return null;
  }

  const resource = await prisma.learningResource.findFirst({
    where: { id: resourceId, deletedAt: null },
    select: {
      id: true,
      title: true,
      fileUrl: true,
      fileName: true,
      mimeType: true,
      storagePath: true,
      storageProvider: true,
      attachments: {
        where: options?.attachmentId ? { id: options.attachmentId } : undefined,
        select: {
          id: true,
          title: true,
          fileUrl: true,
          fileName: true,
          mimeType: true,
          storagePath: true,
          storageProvider: true,
        },
      },
    },
  });

  if (!resource) {
    throw new Error("Learning resource not found.");
  }

  const assetTarget = options?.attachmentId ? resource.attachments[0] ?? null : resource;

  if (!assetTarget) {
    throw new Error("Requested resource asset was not found.");
  }

  await recordLearningResourceUsageService(resourceId, {
    eventType: options?.download ? "DOWNLOAD" : "PREVIEW",
    metadata: {
      attachmentId: options?.attachmentId ?? null,
      source: options?.download ? "download" : "preview",
    },
  }, { actorUserId: options?.actorUserId });

  if (assetTarget.storagePath) {
    const asset = await resolveStoredAssetResponse({
      storageProvider: assetTarget.storageProvider,
      storagePath: assetTarget.storagePath,
    });

    if (!asset) {
      throw new Error("Resource asset not found.");
    }

    return {
      kind: "binary" as const,
      body: asset.body,
      contentType: assetTarget.mimeType || asset.contentType,
      cacheControl: asset.cacheControl,
      fileName: assetTarget.fileName ?? resource.fileName ?? resource.title,
    };
  }

  if (assetTarget.fileUrl) {
    return {
      kind: "redirect" as const,
      url: assetTarget.fileUrl,
      fileName: assetTarget.fileName ?? resource.fileName ?? resource.title,
    };
  }

  throw new Error("This resource does not expose a downloadable asset.");
}
