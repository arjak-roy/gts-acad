BEGIN;

ALTER TABLE "courses"
  ADD COLUMN IF NOT EXISTS "code" VARCHAR(50);

ALTER TABLE "programs"
  ADD COLUMN IF NOT EXISTS "code" VARCHAR(50);

WITH ranked_courses AS (
  SELECT
    "course_id",
    CONCAT(
      'C-',
      SUBSTRING(REGEXP_REPLACE(UPPER("course_name"), '[^A-Z0-9]', '', 'g') || 'XXX' FROM 1 FOR 3),
      '-',
      LPAD(
        ROW_NUMBER() OVER (
          PARTITION BY SUBSTRING(REGEXP_REPLACE(UPPER("course_name"), '[^A-Z0-9]', '', 'g') || 'XXX' FROM 1 FOR 3)
          ORDER BY "created_at", "course_id"
        )::text,
        3,
        '0'
      )
    ) AS generated_code
  FROM "courses"
)
UPDATE "courses" AS courses
SET "code" = ranked_courses.generated_code
FROM ranked_courses
WHERE courses."course_id" = ranked_courses."course_id"
  AND courses."code" IS NULL;

WITH ranked_programs AS (
  SELECT
    "program_id",
    CONCAT(
      'P-',
      SUBSTRING(REGEXP_REPLACE(UPPER("program_name"), '[^A-Z0-9]', '', 'g') || 'XXX' FROM 1 FOR 3),
      '-',
      LPAD(
        ROW_NUMBER() OVER (
          PARTITION BY SUBSTRING(REGEXP_REPLACE(UPPER("program_name"), '[^A-Z0-9]', '', 'g') || 'XXX' FROM 1 FOR 3)
          ORDER BY "created_at", "program_id"
        )::text,
        3,
        '0'
      )
    ) AS generated_code
  FROM "programs"
)
UPDATE "programs" AS programs
SET "code" = ranked_programs.generated_code
FROM ranked_programs
WHERE programs."program_id" = ranked_programs."program_id"
  AND programs."code" IS NULL;

DO $$
DECLARE
  missing_course_codes integer;
  missing_program_codes integer;
  duplicate_course_codes integer;
  duplicate_program_codes integer;
BEGIN
  SELECT COUNT(*) INTO missing_course_codes FROM "courses" WHERE "code" IS NULL;
  SELECT COUNT(*) INTO missing_program_codes FROM "programs" WHERE "code" IS NULL;

  IF missing_course_codes > 0 THEN
    RAISE EXCEPTION 'Course code backfill failed for % rows.', missing_course_codes;
  END IF;

  IF missing_program_codes > 0 THEN
    RAISE EXCEPTION 'Program code backfill failed for % rows.', missing_program_codes;
  END IF;

  SELECT COUNT(*) INTO duplicate_course_codes
  FROM (
    SELECT "code"
    FROM "courses"
    GROUP BY "code"
    HAVING COUNT(*) > 1
  ) duplicates;

  SELECT COUNT(*) INTO duplicate_program_codes
  FROM (
    SELECT "code"
    FROM "programs"
    GROUP BY "code"
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_course_codes > 0 THEN
    RAISE EXCEPTION 'Duplicate course codes detected during backfill.';
  END IF;

  IF duplicate_program_codes > 0 THEN
    RAISE EXCEPTION 'Duplicate program codes detected during backfill.';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "courses_code_key" ON "courses" ("code");
CREATE UNIQUE INDEX IF NOT EXISTS "programs_code_key" ON "programs" ("code");

ALTER TABLE "courses"
  ALTER COLUMN "code" SET NOT NULL;

ALTER TABLE "programs"
  ALTER COLUMN "code" SET NOT NULL;

COMMIT;