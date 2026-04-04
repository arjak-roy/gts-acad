DO $$ BEGIN
  CREATE TYPE "schedule_event_type" AS ENUM ('class', 'test', 'quiz', 'contest');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "batch_schedule_events" (
  "event_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "batch_id" UUID NOT NULL,
  "linked_assessment_id" UUID,
  "series_id" UUID,
  "occurrence_index" INTEGER NOT NULL DEFAULT 0,
  "event_title" VARCHAR(255) NOT NULL,
  "event_description" TEXT,
  "event_type" "schedule_event_type" NOT NULL,
  "class_mode" "batch_mode",
  "status" "evaluation_status" NOT NULL DEFAULT 'scheduled',
  "starts_at" TIMESTAMPTZ NOT NULL,
  "ends_at" TIMESTAMPTZ,
  "location" VARCHAR(255),
  "meeting_url" TEXT,
  "recurrence_rule" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_by_user_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "fk_batch_schedule_events_batch"
    FOREIGN KEY ("batch_id")
    REFERENCES "batches"("batch_id")
    ON DELETE CASCADE,
  CONSTRAINT "fk_batch_schedule_events_assessment"
    FOREIGN KEY ("linked_assessment_id")
    REFERENCES "assessments"("assessment_id")
    ON DELETE SET NULL,
  CONSTRAINT "fk_batch_schedule_events_created_by"
    FOREIGN KEY ("created_by_user_id")
    REFERENCES "users"("user_id")
    ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_batch_schedule_events_linked_assessment"
ON "batch_schedule_events" ("linked_assessment_id")
WHERE "linked_assessment_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_batch_schedule_events_batch_starts_at"
ON "batch_schedule_events" ("batch_id", "starts_at" ASC);

CREATE INDEX IF NOT EXISTS "idx_batch_schedule_events_series_occurrence"
ON "batch_schedule_events" ("series_id", "occurrence_index" ASC);

CREATE INDEX IF NOT EXISTS "idx_batch_schedule_events_type_status"
ON "batch_schedule_events" ("event_type", "status");
