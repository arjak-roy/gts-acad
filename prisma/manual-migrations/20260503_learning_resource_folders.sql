CREATE TABLE IF NOT EXISTS "learning_resource_folders" (
  "folder_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "parent_folder_id" UUID REFERENCES "learning_resource_folders"("folder_id") ON DELETE SET NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_by_user_id" UUID REFERENCES "users"("user_id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_learning_resource_folders_parent_order"
ON "learning_resource_folders" ("parent_folder_id", "sort_order");

ALTER TABLE "learning_resources"
ADD COLUMN IF NOT EXISTS "folder_id" UUID;

DO $$
BEGIN
  ALTER TABLE "learning_resources"
  ADD CONSTRAINT "learning_resources_folder_id_fkey"
  FOREIGN KEY ("folder_id")
  REFERENCES "learning_resource_folders"("folder_id")
  ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE INDEX IF NOT EXISTS "idx_learning_resources_folder_updated"
ON "learning_resources" ("folder_id", "updated_at");