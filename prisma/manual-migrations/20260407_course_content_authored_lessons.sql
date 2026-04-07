DO $$
BEGIN
  ALTER TYPE "content_type" ADD VALUE IF NOT EXISTS 'article';
EXCEPTION
  WHEN undefined_object THEN
    RAISE EXCEPTION 'Type "content_type" was not found. Ensure the base course content schema is present before applying authored lesson sync.';
END
$$;

ALTER TABLE "course_contents"
  ADD COLUMN IF NOT EXISTS "excerpt" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "body_json" JSONB,
  ADD COLUMN IF NOT EXISTS "rendered_html" TEXT,
  ADD COLUMN IF NOT EXISTS "estimated_reading_minutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "is_ai_generated" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "ai_generation_metadata" JSONB;