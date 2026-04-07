ALTER TABLE "batch_schedule_events"
ADD COLUMN IF NOT EXISTS "linked_assessment_pool_id" UUID;

DO $$ BEGIN
  ALTER TABLE "batch_schedule_events"
  ADD CONSTRAINT "fk_batch_schedule_events_assessment_pool"
    FOREIGN KEY ("linked_assessment_pool_id")
    REFERENCES "assessment_pools"("assessment_pool_id")
    ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "idx_batch_schedule_events_linked_assessment_pool"
ON "batch_schedule_events" ("linked_assessment_pool_id");