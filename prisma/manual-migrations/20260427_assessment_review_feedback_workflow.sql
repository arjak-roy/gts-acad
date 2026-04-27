-- Assessment review and feedback workflow enhancements

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'assessment_review_history_event'
  ) THEN
    CREATE TYPE "assessment_review_history_event" AS ENUM (
      'review_started',
      'draft_saved',
      'graded',
      'override_applied',
      'finalized',
      'reopened'
    );
  END IF;
END $$;

ALTER TABLE "assessment_pools"
  ADD COLUMN IF NOT EXISTS "pass_criteria_config" JSONB;

ALTER TABLE "assessment_questions"
  ADD COLUMN IF NOT EXISTS "is_mandatory" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "assessment_attempts"
  ADD COLUMN IF NOT EXISTS "override_marks" INTEGER,
  ADD COLUMN IF NOT EXISTS "override_passed" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "override_reason" VARCHAR(2000),
  ADD COLUMN IF NOT EXISTS "overridden_by_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "overridden_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "is_finalized" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "finalized_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "finalized_by_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "feedback_visible_to_learner" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "assessment_review_history" (
  "history_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "attempt_id" UUID NOT NULL,
  "actor_user_id" UUID,
  "event_type" "assessment_review_history_event" NOT NULL,
  "score_before" INTEGER,
  "score_after" INTEGER,
  "passed_before" BOOLEAN,
  "passed_after" BOOLEAN,
  "notes" VARCHAR(2000),
  "snapshot" JSONB DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "assessment_review_history_pkey" PRIMARY KEY ("history_id")
);

CREATE INDEX IF NOT EXISTS "idx_assessment_attempts_overridden_by"
  ON "assessment_attempts"("overridden_by_user_id");

CREATE INDEX IF NOT EXISTS "idx_assessment_attempts_finalized_by"
  ON "assessment_attempts"("finalized_by_user_id");

CREATE INDEX IF NOT EXISTS "idx_assessment_review_history_attempt_created"
  ON "assessment_review_history"("attempt_id", "created_at");

CREATE INDEX IF NOT EXISTS "idx_assessment_review_history_actor_created"
  ON "assessment_review_history"("actor_user_id", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assessment_attempts_overridden_by_user_id_fkey'
  ) THEN
    ALTER TABLE "assessment_attempts"
      ADD CONSTRAINT "assessment_attempts_overridden_by_user_id_fkey"
      FOREIGN KEY ("overridden_by_user_id")
      REFERENCES "users"("user_id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assessment_attempts_finalized_by_user_id_fkey'
  ) THEN
    ALTER TABLE "assessment_attempts"
      ADD CONSTRAINT "assessment_attempts_finalized_by_user_id_fkey"
      FOREIGN KEY ("finalized_by_user_id")
      REFERENCES "users"("user_id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assessment_review_history_attempt_id_fkey'
  ) THEN
    ALTER TABLE "assessment_review_history"
      ADD CONSTRAINT "assessment_review_history_attempt_id_fkey"
      FOREIGN KEY ("attempt_id")
      REFERENCES "assessment_attempts"("attempt_id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assessment_review_history_actor_user_id_fkey'
  ) THEN
    ALTER TABLE "assessment_review_history"
      ADD CONSTRAINT "assessment_review_history_actor_user_id_fkey"
      FOREIGN KEY ("actor_user_id")
      REFERENCES "users"("user_id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
