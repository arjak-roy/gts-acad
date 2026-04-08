ALTER TABLE "training_centres"
  ADD COLUMN IF NOT EXISTS "address_line_1" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "address_line_2" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "landmark" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "postal_code" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS "idx_training_centres_active" ON "training_centres" ("is_active");

WITH matched_centres AS (
  SELECT normalized_name, "id" AS centre_id
  FROM (
    SELECT
      LOWER(TRIM("centre_name")) AS normalized_name,
      "id",
      COUNT(*) OVER (PARTITION BY LOWER(TRIM("centre_name"))) AS match_count
    FROM "training_centres"
  ) AS centres
  WHERE match_count = 1
)
UPDATE "batches" AS b
SET "centre_id" = mc.centre_id
FROM matched_centres AS mc
WHERE b."centre_id" IS NULL
  AND b."campus" IS NOT NULL
  AND LOWER(TRIM(b."campus")) = mc.normalized_name;