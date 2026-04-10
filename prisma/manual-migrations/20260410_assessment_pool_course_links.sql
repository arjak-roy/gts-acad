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

ALTER TABLE "assessment_pools"
DROP COLUMN IF EXISTS "course_id";