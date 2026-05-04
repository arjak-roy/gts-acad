/**
 * Backfill script: populate resource_id on curriculum_stage_items from their linked content.
 *
 * For each CurriculumStageItem with contentId but no resourceId:
 * - Looks up the CourseContent's linked LearningResource (via sourceContentId)
 * - If found: sets resourceId on the stage item
 * - If not found: calls syncLearningResourceFromContentService to create one, then sets it
 *
 * Run once after migration:
 *   node --env-file=.env scripts/backfill-stage-item-resource-ids.mjs
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BATCH_SIZE = 100;

async function run() {
  console.log("Starting backfill of curriculum_stage_items.resource_id...");

  const totalItems = await prisma.curriculumStageItem.count({
    where: {
      contentId: { not: null },
      resourceId: null,
    },
  });

  console.log(`Found ${totalItems} stage items with contentId but no resourceId.`);

  if (totalItems === 0) {
    console.log("Nothing to backfill. Done.");
    return;
  }

  let processed = 0;
  let linked = 0;
  let created = 0;
  let skipped = 0;

  while (processed < totalItems) {
    const items = await prisma.curriculumStageItem.findMany({
      where: {
        contentId: { not: null },
        resourceId: null,
      },
      select: {
        id: true,
        contentId: true,
      },
      take: BATCH_SIZE,
    });

    if (items.length === 0) break;

    for (const item of items) {
      try {
        // Find the linked LearningResource via sourceContentId
        const resource = await prisma.learningResource.findUnique({
          where: { sourceContentId: item.contentId },
          select: { id: true },
        });

        if (resource) {
          await prisma.curriculumStageItem.update({
            where: { id: item.id },
            data: { resourceId: resource.id },
          });
          linked++;
        } else {
          // Content has no synced resource — create one via raw upsert
          const content = await prisma.courseContent.findUnique({
            where: { id: item.contentId },
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
            console.warn(`  [SKIP] Stage item ${item.id}: contentId ${item.contentId} not found in course_contents.`);
            skipped++;
            continue;
          }

          const newResource = await prisma.learningResource.create({
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

          await prisma.curriculumStageItem.update({
            where: { id: item.id },
            data: { resourceId: newResource.id },
          });
          created++;
        }
      } catch (error) {
        // sourceContentId unique constraint conflict means another item already synced it
        if (error.code === "P2002") {
          const resource = await prisma.learningResource.findUnique({
            where: { sourceContentId: item.contentId },
            select: { id: true },
          });
          if (resource) {
            await prisma.curriculumStageItem.update({
              where: { id: item.id },
              data: { resourceId: resource.id },
            });
            linked++;
          } else {
            console.warn(`  [ERROR] Stage item ${item.id}: unique conflict but resource not found.`);
            skipped++;
          }
        } else {
          console.error(`  [ERROR] Stage item ${item.id}:`, error.message);
          skipped++;
        }
      }

      processed++;
    }

    console.log(`  Processed ${processed}/${totalItems} (linked: ${linked}, created: ${created}, skipped: ${skipped})`);
  }

  console.log(`\nBackfill complete.`);
  console.log(`  Total processed: ${processed}`);
  console.log(`  Linked to existing resource: ${linked}`);
  console.log(`  Created new resource: ${created}`);
  console.log(`  Skipped (missing content): ${skipped}`);
}

run()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
