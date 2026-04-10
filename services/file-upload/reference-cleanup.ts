import "server-only";

import type { UploadStorageProvider } from "@prisma/client";

import { isDatabaseConfigured, prisma } from "@/lib/prisma-client";
import { deleteStoredUploadAsset } from "@/services/file-upload/service";

type StoredUploadAssetReference = {
  storagePath: string | null;
  storageProvider: UploadStorageProvider | null;
};

function normalizeStoredUploadAssetReference(asset: StoredUploadAssetReference) {
  if (!asset.storagePath) {
    return null;
  }

  return {
    storagePath: asset.storagePath,
    storageProvider: asset.storageProvider,
  };
}

export async function deleteStoredUploadAssetIfUnreferenced(
  asset: StoredUploadAssetReference,
  options?: { throwOnError?: boolean },
) {
  const normalizedAsset = normalizeStoredUploadAssetReference(asset);

  if (!normalizedAsset) {
    return;
  }

  if (!isDatabaseConfigured) {
    await deleteStoredUploadAsset(normalizedAsset, options);
    return;
  }

  const referenceWhere = {
    storagePath: normalizedAsset.storagePath,
    storageProvider: normalizedAsset.storageProvider,
  };

  const [contentReference, resourceReference, attachmentReference] = await Promise.all([
    prisma.courseContent.findFirst({ where: referenceWhere, select: { id: true } }),
    prisma.learningResource.findFirst({ where: referenceWhere, select: { id: true } }),
    prisma.learningResourceAttachment.findFirst({ where: referenceWhere, select: { id: true } }),
  ]);

  if (contentReference || resourceReference || attachmentReference) {
    return;
  }

  await deleteStoredUploadAsset(normalizedAsset, options);
}
