CREATE TABLE IF NOT EXISTS "trainer_course_assignments" (
  "trainer_id" UUID NOT NULL,
  "course_id" UUID NOT NULL,
  "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "trainer_course_assignments_pkey" PRIMARY KEY ("trainer_id", "course_id"),
  CONSTRAINT "fk_trainer_course_assignments_trainer"
    FOREIGN KEY ("trainer_id")
    REFERENCES "trainers"("trainer_id")
    ON DELETE CASCADE,
  CONSTRAINT "fk_trainer_course_assignments_course"
    FOREIGN KEY ("course_id")
    REFERENCES "courses"("course_id")
    ON DELETE CASCADE
);

INSERT INTO "trainer_course_assignments" ("trainer_id", "course_id")
SELECT DISTINCT
  trainer_rows."trainer_id",
  courses."course_id"
FROM "trainers" AS trainer_rows
CROSS JOIN LATERAL UNNEST(COALESCE(trainer_rows."programs", ARRAY[]::TEXT[])) AS assigned_course_name
JOIN "courses"
  ON LOWER(TRIM("courses"."course_name")) = LOWER(TRIM(assigned_course_name))
ON CONFLICT ("trainer_id", "course_id") DO NOTHING;

CREATE INDEX IF NOT EXISTS "idx_trainer_course_assignments_trainer"
ON "trainer_course_assignments" ("trainer_id");

CREATE INDEX IF NOT EXISTS "idx_trainer_course_assignments_course"
ON "trainer_course_assignments" ("course_id");