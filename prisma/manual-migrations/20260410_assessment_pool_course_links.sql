DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'assessment_pools'
      AND column_name = 'course_id'
  ) THEN
    INSERT INTO "course_assessment_links" (
      "course_id",
      "assessment_pool_id",
      "sort_order",
      "is_required",
      "created_at"
    )
    SELECT
      "course_id",
      "assessment_pool_id",
      0,
      false,
      COALESCE("created_at", NOW())
    FROM "assessment_pools"
    WHERE "course_id" IS NOT NULL
    ON CONFLICT ("course_id", "assessment_pool_id") DO NOTHING;
  END IF;
END $$;

ALTER TABLE "assessment_pools"
DROP COLUMN IF EXISTS "course_id";