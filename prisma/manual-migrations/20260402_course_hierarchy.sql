BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'programs'
  ) THEN
    RAISE EXCEPTION 'Table "programs" already exists. This migration expects the legacy schema before the course split.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'courses'
  ) THEN
    RAISE EXCEPTION 'Table "courses" was not found. Aborting migration.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'courses' AND column_name = 'title'
  ) THEN
    RAISE EXCEPTION 'Table "courses" no longer has the legacy program columns. Aborting migration.';
  END IF;
END
$$;

ALTER TABLE "courses" RENAME TO "programs";

ALTER INDEX IF EXISTS "courses_pkey" RENAME TO "programs_pkey";
ALTER INDEX IF EXISTS "courses_slug_key" RENAME TO "programs_slug_key";
ALTER INDEX IF EXISTS "idx_courses_type" RENAME TO "idx_programs_type";

ALTER TABLE "programs" RENAME COLUMN "course_id" TO "program_id";
ALTER TABLE "programs" RENAME COLUMN "title" TO "program_name";

ALTER TABLE "batches" RENAME COLUMN "course_id" TO "program_id";
ALTER TABLE "candidate_certificates" RENAME COLUMN "course_id" TO "program_id";
ALTER TABLE "assessments" RENAME COLUMN "course_id" TO "program_id";

ALTER INDEX IF EXISTS "idx_batches_course_status" RENAME TO "idx_batches_program_status";

CREATE TABLE "courses" (
  "course_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "course_name" VARCHAR(255) NOT NULL,
  "course_desc" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "courses_pkey" PRIMARY KEY ("course_id"),
  CONSTRAINT "courses_course_name_key" UNIQUE ("course_name")
);

CREATE INDEX "idx_courses_active" ON "courses" ("is_active");

INSERT INTO "courses" ("course_id", "course_name", "course_desc", "is_active")
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'Language Career Track',
    'Language preparation pathways for international academy placement.',
    true
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Clinical Career Track',
    'Clinical upskilling pathways for nursing and healthcare deployment.',
    true
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'Technical Career Track',
    'Technical programs aligned with healthcare operations and IT roles.',
    true
  );

ALTER TABLE "programs" ADD COLUMN "course_id" UUID;

UPDATE "programs"
SET "course_id" = CASE
  WHEN "type"::text = 'language' THEN '11111111-1111-1111-1111-111111111111'::uuid
  WHEN "type"::text = 'clinical' THEN '22222222-2222-2222-2222-222222222222'::uuid
  WHEN "type"::text = 'technical' THEN '33333333-3333-3333-3333-333333333333'::uuid
  ELSE NULL
END;

DO $$
DECLARE
  missing_program_courses integer;
BEGIN
  SELECT COUNT(*)
  INTO missing_program_courses
  FROM "programs"
  WHERE "course_id" IS NULL;

  IF missing_program_courses > 0 THEN
    RAISE EXCEPTION 'Program to course mapping failed for % existing program rows.', missing_program_courses;
  END IF;
END
$$;

ALTER TABLE "programs"
  ALTER COLUMN "course_id" SET NOT NULL;

ALTER TABLE "programs"
  ADD CONSTRAINT "programs_course_id_fkey"
  FOREIGN KEY ("course_id") REFERENCES "courses"("course_id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

CREATE INDEX "idx_programs_course_active" ON "programs" ("course_id", "is_active");

COMMIT;