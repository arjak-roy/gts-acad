DO $$
BEGIN
  CREATE TYPE "trainer_availability_status" AS ENUM (
    'available',
    'limited',
    'unavailable',
    'on_leave'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "trainers"
ADD COLUMN IF NOT EXISTS "employee_code" VARCHAR(50);

ALTER TABLE "trainers"
ADD COLUMN IF NOT EXISTS "availability_status" "trainer_availability_status";

WITH ranked_trainers AS (
  SELECT
    "trainer_id",
    CONCAT('TRN-', LPAD(ROW_NUMBER() OVER (ORDER BY "joined_at", "trainer_id")::text, 4, '0')) AS "employee_code"
  FROM "trainers"
)
UPDATE "trainers" AS "target"
SET "employee_code" = ranked_trainers."employee_code"
FROM ranked_trainers
WHERE "target"."trainer_id" = ranked_trainers."trainer_id"
  AND "target"."employee_code" IS NULL;

UPDATE "trainers"
SET "availability_status" = CASE
  WHEN "is_active" = false THEN 'unavailable'::"trainer_availability_status"
  WHEN "capacity" = 0 THEN 'limited'::"trainer_availability_status"
  ELSE 'available'::"trainer_availability_status"
END
WHERE "availability_status" IS NULL;

ALTER TABLE "trainers"
ALTER COLUMN "employee_code" SET NOT NULL;

ALTER TABLE "trainers"
ALTER COLUMN "availability_status" SET DEFAULT 'available';

ALTER TABLE "trainers"
ALTER COLUMN "availability_status" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "trainers_employee_code_key"
ON "trainers" ("employee_code");

CREATE INDEX IF NOT EXISTS "idx_trainers_availability_status"
ON "trainers" ("availability_status");