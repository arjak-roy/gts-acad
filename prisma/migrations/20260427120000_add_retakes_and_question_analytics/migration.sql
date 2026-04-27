-- Add attempt_number to assessment_attempts (default 1 for existing rows)
ALTER TABLE "assessment_attempts" ADD COLUMN "attempt_number" INTEGER NOT NULL DEFAULT 1;

-- Drop old unique constraint (assessment_id, candidate_id)
ALTER TABLE "assessment_attempts" DROP CONSTRAINT IF EXISTS "assessment_attempts_assessment_id_candidate_id_key";

-- Add new unique constraint allowing multiple attempts per learner per assessment
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "uq_assessment_attempts_assessment_learner_attempt"
  UNIQUE ("assessment_id", "candidate_id", "attempt_number");

-- Add composite indexes for analytics queries
CREATE INDEX IF NOT EXISTS "idx_assessment_attempts_pool_submitted"
  ON "assessment_attempts" ("assessment_pool_id", "submitted_at");
CREATE INDEX IF NOT EXISTS "idx_assessment_attempts_batch_pool_status"
  ON "assessment_attempts" ("batch_id", "assessment_pool_id", "status");

-- Create attempt_question_results table for per-question analytics
CREATE TABLE "attempt_question_results" (
    "result_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "attempt_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "assessment_pool_id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "question_type" "question_type" NOT NULL,
    "submitted_answer" JSONB,
    "is_correct" BOOLEAN,
    "is_skipped" BOOLEAN NOT NULL DEFAULT false,
    "marks_awarded" INTEGER NOT NULL DEFAULT 0,
    "max_marks" INTEGER NOT NULL DEFAULT 1,
    "requires_manual_review" BOOLEAN NOT NULL DEFAULT false,
    "graded_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attempt_question_results_pkey" PRIMARY KEY ("result_id")
);

-- Unique: one result per question per attempt
ALTER TABLE "attempt_question_results" ADD CONSTRAINT "uq_attempt_question_results_attempt_question"
  UNIQUE ("attempt_id", "question_id");

-- Indexes for question analytics
CREATE INDEX "idx_attempt_question_results_question_correct"
  ON "attempt_question_results" ("question_id", "is_correct");
CREATE INDEX "idx_attempt_question_results_pool_question"
  ON "attempt_question_results" ("assessment_pool_id", "question_id");
CREATE INDEX "idx_attempt_question_results_learner"
  ON "attempt_question_results" ("candidate_id");

-- Foreign keys for attempt_question_results
ALTER TABLE "attempt_question_results" ADD CONSTRAINT "attempt_question_results_attempt_id_fkey"
  FOREIGN KEY ("attempt_id") REFERENCES "assessment_attempts"("attempt_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attempt_question_results" ADD CONSTRAINT "attempt_question_results_question_id_fkey"
  FOREIGN KEY ("question_id") REFERENCES "assessment_questions"("question_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attempt_question_results" ADD CONSTRAINT "attempt_question_results_assessment_pool_id_fkey"
  FOREIGN KEY ("assessment_pool_id") REFERENCES "assessment_pools"("assessment_pool_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attempt_question_results" ADD CONSTRAINT "attempt_question_results_candidate_id_fkey"
  FOREIGN KEY ("candidate_id") REFERENCES "candidates"("candidate_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create assessment_retake_grants table
CREATE TABLE "assessment_retake_grants" (
    "grant_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assessment_pool_id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "granted_by_user_id" UUID NOT NULL,
    "reason" VARCHAR(1000),
    "expires_at" TIMESTAMPTZ(6),
    "consumed_at" TIMESTAMPTZ(6),
    "consumed_attempt_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_retake_grants_pkey" PRIMARY KEY ("grant_id")
);

-- Indexes for retake grants
CREATE INDEX "idx_retake_grants_learner_pool"
  ON "assessment_retake_grants" ("candidate_id", "assessment_pool_id", "consumed_at");
CREATE INDEX "idx_retake_grants_batch_pool"
  ON "assessment_retake_grants" ("batch_id", "assessment_pool_id");

-- Foreign keys for assessment_retake_grants
ALTER TABLE "assessment_retake_grants" ADD CONSTRAINT "assessment_retake_grants_assessment_pool_id_fkey"
  FOREIGN KEY ("assessment_pool_id") REFERENCES "assessment_pools"("assessment_pool_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assessment_retake_grants" ADD CONSTRAINT "assessment_retake_grants_candidate_id_fkey"
  FOREIGN KEY ("candidate_id") REFERENCES "candidates"("candidate_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assessment_retake_grants" ADD CONSTRAINT "assessment_retake_grants_batch_id_fkey"
  FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assessment_retake_grants" ADD CONSTRAINT "assessment_retake_grants_granted_by_user_id_fkey"
  FOREIGN KEY ("granted_by_user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
