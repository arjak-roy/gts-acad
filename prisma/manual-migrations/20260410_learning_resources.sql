DO $$
BEGIN
  CREATE TYPE "learning_resource_visibility" AS ENUM (
    'private',
    'restricted',
    'public'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "learning_resource_target_type" AS ENUM (
    'course',
    'batch',
    'assessment_pool',
    'schedule_event'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "learning_resource_usage_type" AS ENUM (
    'preview',
    'download'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TYPE "audit_entity_type" ADD VALUE 'learning_resource';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "learning_resource_categories" (
  "category_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "parent_category_id" UUID REFERENCES "learning_resource_categories"("category_id") ON DELETE SET NULL,
  "name" VARCHAR(120) NOT NULL,
  "slug" VARCHAR(160) NOT NULL UNIQUE,
  "description" VARCHAR(500),
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_learning_resource_categories_parent_order"
ON "learning_resource_categories" ("parent_category_id", "sort_order");

CREATE TABLE IF NOT EXISTS "learning_resource_tags" (
  "tag_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(80) NOT NULL,
  "slug" VARCHAR(120) NOT NULL UNIQUE,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "learning_resources" (
  "resource_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" VARCHAR(255) NOT NULL,
  "description" VARCHAR(2000),
  "excerpt" VARCHAR(500),
  "content_type" "content_type" NOT NULL,
  "status" "content_status" NOT NULL DEFAULT 'draft',
  "visibility" "learning_resource_visibility" NOT NULL DEFAULT 'private',
  "category_id" UUID REFERENCES "learning_resource_categories"("category_id") ON DELETE SET NULL,
  "subcategory_id" UUID REFERENCES "learning_resource_categories"("category_id") ON DELETE SET NULL,
  "body_json" JSONB,
  "rendered_html" TEXT,
  "estimated_reading_minutes" INTEGER,
  "file_url" TEXT,
  "file_name" VARCHAR(255),
  "file_size" INTEGER,
  "mime_type" VARCHAR(100),
  "storage_path" VARCHAR(500),
  "storage_provider" "upload_storage_provider",
  "current_version_number" INTEGER NOT NULL DEFAULT 1,
  "published_at" TIMESTAMPTZ(6),
  "created_by_user_id" UUID REFERENCES "users"("user_id") ON DELETE SET NULL,
  "updated_by_user_id" UUID REFERENCES "users"("user_id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_learning_resources_status_visibility_updated"
ON "learning_resources" ("status", "visibility", "updated_at");

CREATE INDEX IF NOT EXISTS "idx_learning_resources_category"
ON "learning_resources" ("category_id", "subcategory_id");

CREATE INDEX IF NOT EXISTS "idx_learning_resources_type_status"
ON "learning_resources" ("content_type", "status");

CREATE TABLE IF NOT EXISTS "learning_resource_tag_map" (
  "resource_id" UUID NOT NULL REFERENCES "learning_resources"("resource_id") ON DELETE CASCADE,
  "tag_id" UUID NOT NULL REFERENCES "learning_resource_tags"("tag_id") ON DELETE CASCADE,
  PRIMARY KEY ("resource_id", "tag_id")
);

CREATE INDEX IF NOT EXISTS "idx_learning_resource_tag_map_tag"
ON "learning_resource_tag_map" ("tag_id");

CREATE TABLE IF NOT EXISTS "learning_resource_attachments" (
  "attachment_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "resource_id" UUID NOT NULL REFERENCES "learning_resources"("resource_id") ON DELETE CASCADE,
  "title" VARCHAR(255),
  "file_url" TEXT,
  "file_name" VARCHAR(255) NOT NULL,
  "file_size" INTEGER,
  "mime_type" VARCHAR(100),
  "storage_path" VARCHAR(500),
  "storage_provider" "upload_storage_provider",
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_learning_resource_attachments_resource_order"
ON "learning_resource_attachments" ("resource_id", "sort_order");

CREATE TABLE IF NOT EXISTS "learning_resource_assignments" (
  "assignment_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "resource_id" UUID NOT NULL REFERENCES "learning_resources"("resource_id") ON DELETE CASCADE,
  "target_type" "learning_resource_target_type" NOT NULL,
  "target_id" UUID NOT NULL,
  "notes" VARCHAR(1000),
  "assigned_by_user_id" UUID REFERENCES "users"("user_id") ON DELETE SET NULL,
  "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "uq_learning_resource_assignment_target" UNIQUE ("resource_id", "target_type", "target_id")
);

CREATE INDEX IF NOT EXISTS "idx_learning_resource_assignments_target"
ON "learning_resource_assignments" ("target_type", "target_id");

CREATE TABLE IF NOT EXISTS "learning_resource_versions" (
  "version_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "resource_id" UUID NOT NULL REFERENCES "learning_resources"("resource_id") ON DELETE CASCADE,
  "version_number" INTEGER NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "change_summary" VARCHAR(500),
  "snapshot" JSONB NOT NULL,
  "updated_by_user_id" UUID REFERENCES "users"("user_id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "uq_learning_resource_version_number" UNIQUE ("resource_id", "version_number")
);

CREATE INDEX IF NOT EXISTS "idx_learning_resource_versions_resource_created"
ON "learning_resource_versions" ("resource_id", "created_at");

CREATE TABLE IF NOT EXISTS "learning_resource_usage" (
  "usage_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "resource_id" UUID NOT NULL REFERENCES "learning_resources"("resource_id") ON DELETE CASCADE,
  "assignment_id" UUID REFERENCES "learning_resource_assignments"("assignment_id") ON DELETE SET NULL,
  "actor_user_id" UUID REFERENCES "users"("user_id") ON DELETE SET NULL,
  "event_type" "learning_resource_usage_type" NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_learning_resource_usage_resource_event"
ON "learning_resource_usage" ("resource_id", "event_type", "created_at");

CREATE INDEX IF NOT EXISTS "idx_learning_resource_usage_assignment"
ON "learning_resource_usage" ("assignment_id");