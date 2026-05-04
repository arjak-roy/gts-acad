-- AlterTable
ALTER TABLE "curriculum_stage_items" ADD COLUMN "resource_id" UUID;

-- CreateIndex
CREATE INDEX "idx_curriculum_stage_items_resource" ON "curriculum_stage_items"("resource_id");

-- AddForeignKey
ALTER TABLE "curriculum_stage_items" ADD CONSTRAINT "curriculum_stage_items_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "learning_resources"("resource_id") ON DELETE SET NULL ON UPDATE CASCADE;
