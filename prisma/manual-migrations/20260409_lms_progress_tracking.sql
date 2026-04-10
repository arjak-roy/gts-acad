DO $$
BEGIN
  CREATE TYPE "curriculum_progress_status" AS ENUM (
    'not_started',
    'in_progress',
    'completed',
    'skipped'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "learner_curriculum_item_progress" (
  "progress_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "candidate_id" UUID NOT NULL,
  "batch_id" UUID NOT NULL,
  "stage_item_id" UUID NOT NULL,
  "status" "curriculum_progress_status" NOT NULL DEFAULT 'not_started',
  "progress_percent" INTEGER NOT NULL DEFAULT 0,
  "started_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "last_activity_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "uq_curriculum_progress_learner_batch_stage_item"
    UNIQUE ("candidate_id", "batch_id", "stage_item_id")
);

DO $$ BEGIN
  ALTER TABLE "learner_curriculum_item_progress"
  ADD CONSTRAINT "fk_curriculum_progress_candidate"
    FOREIGN KEY ("candidate_id")
    REFERENCES "candidates"("candidate_id")
    ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "learner_curriculum_item_progress"
  ADD CONSTRAINT "fk_curriculum_progress_batch"
    FOREIGN KEY ("batch_id")
    REFERENCES "batches"("batch_id")
    ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "learner_curriculum_item_progress"
  ADD CONSTRAINT "fk_curriculum_progress_stage_item"
    FOREIGN KEY ("stage_item_id")
    REFERENCES "curriculum_stage_items"("item_id")
    ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "idx_curriculum_progress_learner_batch"
ON "learner_curriculum_item_progress" ("candidate_id", "batch_id");

CREATE INDEX IF NOT EXISTS "idx_curriculum_progress_learner_status"
ON "learner_curriculum_item_progress" ("candidate_id", "status");

CREATE INDEX IF NOT EXISTS "idx_curriculum_progress_batch_status"
ON "learner_curriculum_item_progress" ("batch_id", "status");

CREATE INDEX IF NOT EXISTS "idx_curriculum_progress_stage_item"
ON "learner_curriculum_item_progress" ("stage_item_id");