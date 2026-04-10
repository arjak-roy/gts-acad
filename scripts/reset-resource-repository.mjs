import { rm } from "node:fs/promises";
import path from "node:path";

import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";

import { loadLocalEnv } from "./load-local-env.mjs";

const prisma = new PrismaClient();

const REPOSITORY_STORAGE_PREFIXES = [
  "course-content/",
  "learning-resources/",
  "uploads/course-content/",
  "uploads/learning-resources/",
];

function normalizeStorageProvider(value) {
  return value === "S3" ? "S3" : "LOCAL_PUBLIC";
}

function normalizeStoragePath(value) {
  return String(value ?? "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/");
}

function isRepositoryStoragePath(storagePath) {
  const normalized = normalizeStoragePath(storagePath);
  return REPOSITORY_STORAGE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function buildAssetKey(asset) {
  return `${asset.storageProvider}:${asset.storagePath}`;
}

function ensureS3ConfigAvailable(assets) {
  const requiresS3 = assets.some((asset) => asset.storageProvider === "S3");
  if (!requiresS3) {
    return;
  }

  const missing = ["S3_REGION", "S3_BUCKET", "S3_ACCESS_KEY", "S3_SECRET_KEY"].filter(
    (key) => !process.env[key]?.trim(),
  );

  if (missing.length > 0) {
    throw new Error(`Cannot delete S3 repository assets because these env vars are missing: ${missing.join(", ")}`);
  }
}

function getS3Client() {
  return new S3Client({
    region: process.env.S3_REGION.trim(),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY.trim(),
      secretAccessKey: process.env.S3_SECRET_KEY.trim(),
    },
  });
}

function getPublicDirectory() {
  return path.join(process.cwd(), "public");
}

function getAbsoluteLocalPath(storagePath) {
  return path.join(process.cwd(), "public", ...normalizeStoragePath(storagePath).split("/"));
}

function isWithinDirectory(targetPath, baseDirectory) {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedBase = path.resolve(baseDirectory);
  return resolvedTarget === resolvedBase || resolvedTarget.startsWith(`${resolvedBase}${path.sep}`);
}

function pickAsset(row) {
  const storagePath = normalizeStoragePath(row.storagePath);

  if (!storagePath) {
    return null;
  }

  if (!isRepositoryStoragePath(storagePath)) {
    return {
      storagePath,
      storageProvider: normalizeStorageProvider(row.storageProvider),
      supported: false,
    };
  }

  return {
    storagePath,
    storageProvider: normalizeStorageProvider(row.storageProvider),
    supported: true,
  };
}

function dedupeAssets(rows) {
  const unique = new Map();

  for (const row of rows) {
    const asset = pickAsset(row);
    if (!asset) {
      continue;
    }

    const key = buildAssetKey(asset);
    if (!unique.has(key)) {
      unique.set(key, asset);
    }
  }

  return Array.from(unique.values());
}

async function gatherRepositorySnapshot() {
  const [
    courseContents,
    learningResources,
    resourceAttachments,
    counts,
  ] = await Promise.all([
    prisma.courseContent.findMany({
      select: {
        id: true,
        storagePath: true,
        storageProvider: true,
      },
    }),
    prisma.learningResource.findMany({
      select: {
        id: true,
        storagePath: true,
        storageProvider: true,
      },
    }),
    prisma.learningResourceAttachment.findMany({
      select: {
        id: true,
        storagePath: true,
        storageProvider: true,
      },
    }),
    Promise.all([
      prisma.courseContent.count(),
      prisma.courseContentFolder.count(),
      prisma.learningResource.count(),
      prisma.learningResourceCategory.count(),
      prisma.learningResourceTag.count(),
      prisma.learningResourceTagMap.count(),
      prisma.learningResourceAttachment.count(),
      prisma.learningResourceAssignment.count(),
      prisma.learningResourceVersion.count(),
      prisma.learningResourceUsage.count(),
      prisma.batchContentMapping.count(),
      prisma.curriculumStageItem.count({ where: { contentId: { not: null } } }),
    ]),
  ]);

  const assets = dedupeAssets([
    ...courseContents,
    ...learningResources,
    ...resourceAttachments,
  ]);

  return {
    contentIds: courseContents.map((item) => item.id),
    resourceIds: learningResources.map((item) => item.id),
    assets,
    counts: {
      courseContents: counts[0],
      folders: counts[1],
      learningResources: counts[2],
      categories: counts[3],
      tags: counts[4],
      tagLinks: counts[5],
      attachments: counts[6],
      assignments: counts[7],
      versions: counts[8],
      usageEvents: counts[9],
      batchMappings: counts[10],
      curriculumLinks: counts[11],
    },
  };
}

function printSnapshot(label, snapshot) {
  console.log(`\n${label}`);
  console.log(JSON.stringify(snapshot.counts, null, 2));

  const supportedAssets = snapshot.assets.filter((asset) => asset.supported);
  const skippedAssets = snapshot.assets.filter((asset) => !asset.supported);
  const localAssets = supportedAssets.filter((asset) => asset.storageProvider === "LOCAL_PUBLIC").length;
  const s3Assets = supportedAssets.filter((asset) => asset.storageProvider === "S3").length;

  console.log(`Repository assets queued for deletion: ${supportedAssets.length} (${localAssets} local, ${s3Assets} S3)`);
  if (skippedAssets.length > 0) {
    console.log(`Assets skipped because the path is outside repository prefixes: ${skippedAssets.length}`);
    for (const asset of skippedAssets) {
      console.log(`  - ${asset.storageProvider}:${asset.storagePath}`);
    }
  }
}

async function deleteRepositoryRows(contentIds, resourceIds) {
  await prisma.$transaction(async (tx) => {
    if (resourceIds.length > 0) {
      await tx.learningResourceUsage.deleteMany({
        where: { resourceId: { in: resourceIds } },
      });
      await tx.learningResourceAssignment.deleteMany({
        where: { resourceId: { in: resourceIds } },
      });
      await tx.learningResourceAttachment.deleteMany({
        where: { resourceId: { in: resourceIds } },
      });
      await tx.learningResourceVersion.deleteMany({
        where: { resourceId: { in: resourceIds } },
      });
      await tx.learningResourceTagMap.deleteMany({
        where: { resourceId: { in: resourceIds } },
      });
      await tx.learningResource.deleteMany({
        where: { id: { in: resourceIds } },
      });
    }

    if (contentIds.length > 0) {
      await tx.curriculumStageItem.updateMany({
        where: { contentId: { in: contentIds } },
        data: { contentId: null },
      });
      await tx.batchContentMapping.deleteMany({
        where: { contentId: { in: contentIds } },
      });
      await tx.courseContent.deleteMany({
        where: { id: { in: contentIds } },
      });
    }

    await tx.courseContentFolder.deleteMany({});
    await tx.learningResourceTag.deleteMany({});
    await tx.learningResourceCategory.deleteMany({});
  }, {
    maxWait: 10_000,
    timeout: 60_000,
  });
}

async function deleteRepositoryAssets(assets) {
  const supportedAssets = assets.filter((asset) => asset.supported);
  if (supportedAssets.length === 0) {
    return [];
  }

  ensureS3ConfigAvailable(supportedAssets);
  const s3Client = supportedAssets.some((asset) => asset.storageProvider === "S3") ? getS3Client() : null;
  const failures = [];

  for (const asset of supportedAssets) {
    try {
      if (asset.storageProvider === "S3") {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: process.env.S3_BUCKET.trim(),
          Key: asset.storagePath,
        }));
        continue;
      }

      const absolutePath = getAbsoluteLocalPath(asset.storagePath);
      if (!isWithinDirectory(absolutePath, getPublicDirectory())) {
        throw new Error("Resolved path is outside the public directory.");
      }

      await rm(absolutePath, { force: true });
    } catch (error) {
      failures.push({
        ...asset,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return failures;
}

async function main() {
  loadLocalEnv(process.cwd());

  const isConfirmed = process.argv.includes("--confirm");
  const snapshot = await gatherRepositorySnapshot();
  printSnapshot("Repository reset scope", snapshot);

  if (!isConfirmed) {
    console.log("\nDry run only. Re-run with --confirm to delete repository rows and storage assets.");
    return;
  }

  console.log("\nDeleting repository database rows...");
  await deleteRepositoryRows(snapshot.contentIds, snapshot.resourceIds);

  console.log("Deleting repository storage assets...");
  const assetFailures = await deleteRepositoryAssets(snapshot.assets);

  const afterSnapshot = await gatherRepositorySnapshot();
  printSnapshot("Repository reset verification", afterSnapshot);

  if (assetFailures.length > 0) {
    console.error("\nRepository rows were removed, but some storage assets could not be deleted:");
    for (const failure of assetFailures) {
      console.error(`  - ${failure.storageProvider}:${failure.storagePath} -> ${failure.error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("\nRepository reset completed.");
}

main()
  .catch((error) => {
    console.error("\nRepository reset failed:");
    console.error(error instanceof Error ? error.stack || error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });