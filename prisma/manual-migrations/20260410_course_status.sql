DO $$
BEGIN
  CREATE TYPE "course_status" AS ENUM (
    'draft',
    'in_review',
    'published',
    'archived'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "courses"
ADD COLUMN IF NOT EXISTS "course_status" "course_status";

UPDATE "courses"
SET "course_status" = CASE
  WHEN "is_active" = false THEN 'archived'::"course_status"
  ELSE 'published'::"course_status"
END
WHERE "course_status" IS NULL;

ALTER TABLE "courses"
ALTER COLUMN "course_status" SET DEFAULT 'draft';

ALTER TABLE "courses"
ALTER COLUMN "course_status" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_courses_status"
ON "courses" ("course_status");