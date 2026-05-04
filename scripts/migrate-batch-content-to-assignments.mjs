/**
 * Migration script: convert BatchContentMapping rows to LearningResourceAssignment records.
 *
 * For each BatchContentMapping:
 * - Finds the CourseContent's linked LearningResource (via sourceContentId)
 * - If a resource exists: creates a LearningResourceAssignment(targetType=BATCH, targetId=batchId)
 * - If no resource: syncs one from the content first, then creates the assignment
 * - Skips if assignment already exists (idempotent)
 *
 * Run:
 *   node --env-file=.env scripts/migrate-batch-content-to-assignments.mjs
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BATCH_SIZE = 100;

async function run() {
  console.log("Starting migration of batch_content_mappings → learning_resource_assignments...");

  const totalMappings = await prisma.batchContentMapping.count();
  console.log(`Found ${totalMappings} batch content mappings to process.`);

  if (totalMappings === 0) {
    console.log("Nothing to migrate. Done.");
    return;
  }

  let processed = 0;
  let migrated = 0;
  let alreadyExists = 0;
  let created = 0;
  let skipped = 0;
  let cursor = undefined;

  while (processed < totalMappings) {
    const mappings = await prisma.batchContentMapping.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        batchId: true,
        contentId: true,
        assignedById: true,
        assignedAt: true,
      },
    });

    if (mappings.length === 0) break;
    cursor = mappings[mappings.length - 1].id;

    for (const mapping of mappings) {
      try {
        // Find the linked LearningResource
        let resource = await prisma.learningResource.findUnique({
          where: { sourceContentId: mapping.contentId },
          select: { id: true },
        });

        if (!resource) {
          // No resource exists — create one from the content
          const content = await prisma.courseContent.findUnique({
            where: { id: mapping.contentId },
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
            },
          });

          if (!content) {
            console.warn(`  [SKIP] Mapping ${mapping.id}: contentId ${mapping.contentId} not found.`);
            skipped++;
            processed++;
            continue;
          }

          resource = await prisma.learningResource.create({
            data: {
              sourceContentId: content.id,
              title: content.title,
              description: content.description || null,
              excerpt: content.excerpt || null,
              contentType: content.contentType,
              status: content.status,
              visibility: "PRIVATE",
              bodyJson: content.bodyJson || undefined,
              renderedHtml: content.renderedHtml || undefined,
              estimatedReadingMinutes: content.estimatedReadingMinutes,
              fileUrl: content.fileUrl || undefined,
              fileName: content.fileName || undefined,
              fileSize: content.fileSize,
              mimeType: content.mimeType || undefined,
              storagePath: content.storagePath || undefined,
              storageProvider: content.storageProvider || undefined,
              currentVersionNumber: 1,
              publishedAt: content.status === "PUBLISHED" ? new Date() : undefined,
            },
            select: { id: true },
          });
          created++;
        }

        // Check if assignment already exists
        const existing = await prisma.learningResourceAssignment.findUnique({
          where: {
            resourceId_targetType_targetId: {
              resourceId: resource.id,
              targetType: "BATCH",
              targetId: mapping.batchId,
            },
          },
          select: { id: true },
        });

        if (existing) {
          alreadyExists++;
          processed++;
          continue;
        }

        // Create the assignment
        await prisma.learningResourceAssignment.create({
          data: {
            resourceId: resource.id,
            targetType: "BATCH",
            targetId: mapping.batchId,
            assignedById: mapping.assignedById,
            assignedAt: mapping.assignedAt,
          },
        });
        migrated++;
      } catch (error) {
        if (error.code === "P2002") {
          // Unique constraint — assignment already exists (race/retry)
          alreadyExists++;
        } else {
          console.error(`  [ERROR] Mapping ${mapping.id}:`, error.message);
          skipped++;
        }
      }

      processed++;
    }

    console.log(`  Processed ${processed}/${totalMappings} (migrated: ${migrated}, exists: ${alreadyExists}, resources created: ${created}, skipped: ${skipped})`);
  }

  console.log(`\nMigration complete.`);
  console.log(`  Total processed: ${processed}`);
  console.log(`  New assignments created: ${migrated}`);
  console.log(`  Already existed (skipped): ${alreadyExists}`);
  console.log(`  Resources created on-the-fly: ${created}`);
  console.log(`  Skipped (missing content): ${skipped}`);
}

run()
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
