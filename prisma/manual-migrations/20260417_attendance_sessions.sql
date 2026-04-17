DO $$ BEGIN
  CREATE TYPE "attendance_session_source" AS ENUM ('manual', 'schedule_event');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "attendance_sessions" (
  "attendance_session_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "batch_id" UUID NOT NULL,
  "source_type" "attendance_session_source" NOT NULL,
  "session_key" VARCHAR(160) NOT NULL,
  "session_date" DATE NOT NULL,
  "session_title" VARCHAR(255),
  "linked_schedule_event_id" UUID,
  "created_by_user_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "fk_attendance_sessions_batch"
    FOREIGN KEY ("batch_id")
    REFERENCES "batches"("batch_id")
    ON DELETE CASCADE,
  CONSTRAINT "fk_attendance_sessions_schedule_event"
    FOREIGN KEY ("linked_schedule_event_id")
    REFERENCES "batch_schedule_events"("event_id")
    ON DELETE SET NULL,
  CONSTRAINT "fk_attendance_sessions_created_by"
    FOREIGN KEY ("created_by_user_id")
    REFERENCES "users"("user_id")
    ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "attendance_sessions_batch_id_session_key_key"
ON "attendance_sessions" ("batch_id", "session_key");

CREATE UNIQUE INDEX IF NOT EXISTS "attendance_sessions_linked_schedule_event_id_key"
ON "attendance_sessions" ("linked_schedule_event_id");

CREATE INDEX IF NOT EXISTS "idx_attendance_sessions_batch_date"
ON "attendance_sessions" ("batch_id", "session_date");

CREATE INDEX IF NOT EXISTS "idx_attendance_sessions_source_date"
ON "attendance_sessions" ("source_type", "session_date");

CREATE INDEX IF NOT EXISTS "idx_attendance_sessions_created_by"
ON "attendance_sessions" ("created_by_user_id");

ALTER TABLE "attendance_tracker"
ADD COLUMN IF NOT EXISTS "attendance_session_id" UUID;

INSERT INTO "attendance_sessions" (
  "batch_id",
  "source_type",
  "session_key",
  "session_date",
  "session_title"
)
SELECT DISTINCT
  enrollment."batch_id",
  'manual'::"attendance_session_source",
  CONCAT('manual:', TO_CHAR(record."session_date", 'YYYY-MM-DD')),
  record."session_date",
  CONCAT('Manual attendance ', TO_CHAR(record."session_date", 'YYYY-MM-DD'))
FROM "attendance_tracker" AS record
INNER JOIN "candidate_batch_enrollments" AS enrollment
  ON enrollment."enrollment_id" = record."enrollment_id"
ON CONFLICT ("batch_id", "session_key") DO NOTHING;

UPDATE "attendance_tracker" AS record
SET "attendance_session_id" = session."attendance_session_id"
FROM "candidate_batch_enrollments" AS enrollment,
     "attendance_sessions" AS session
WHERE enrollment."enrollment_id" = record."enrollment_id"
  AND session."batch_id" = enrollment."batch_id"
  AND session."session_key" = CONCAT('manual:', TO_CHAR(record."session_date", 'YYYY-MM-DD'))
  AND record."attendance_session_id" IS NULL;

ALTER TABLE "attendance_tracker"
ALTER COLUMN "attendance_session_id" SET NOT NULL;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'attendance_tracker_enrollment_id_session_date_key'
  ) THEN
    ALTER TABLE "attendance_tracker"
    DROP CONSTRAINT "attendance_tracker_enrollment_id_session_date_key";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_attendance_tracker_session'
  ) THEN
    ALTER TABLE "attendance_tracker"
    ADD CONSTRAINT "fk_attendance_tracker_session"
      FOREIGN KEY ("attendance_session_id")
      REFERENCES "attendance_sessions"("attendance_session_id")
      ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'attendance_tracker_enrollment_id_attendance_session_id_key'
  ) THEN
    ALTER TABLE "attendance_tracker"
    ADD CONSTRAINT "attendance_tracker_enrollment_id_attendance_session_id_key"
      UNIQUE ("enrollment_id", "attendance_session_id");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_attendance_session"
ON "attendance_tracker" ("attendance_session_id");