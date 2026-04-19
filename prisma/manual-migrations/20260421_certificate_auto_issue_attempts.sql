DO $$ BEGIN
  CREATE TYPE "certificate_auto_issue_attempt_status" AS ENUM ('issued', 'skipped', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "certificate_auto_issue_attempts" (
  "attempt_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "candidate_id" UUID NOT NULL,
  "batch_id" UUID NOT NULL,
  "rule_id" UUID,
  "template_id" UUID,
  "curriculum_id" UUID,
  "trigger" "certificate_auto_issue_trigger" NOT NULL,
  "status" "certificate_auto_issue_attempt_status" NOT NULL DEFAULT 'skipped',
  "certificate_id" UUID,
  "reason" VARCHAR(1000),
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "retried_from_attempt_id" UUID,
  "attempted_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "fk_cert_auto_issue_attempts_candidate"
    FOREIGN KEY ("candidate_id")
    REFERENCES "candidates"("candidate_id")
    ON DELETE CASCADE,
  CONSTRAINT "fk_cert_auto_issue_attempts_batch"
    FOREIGN KEY ("batch_id")
    REFERENCES "batches"("batch_id")
    ON DELETE CASCADE,
  CONSTRAINT "fk_cert_auto_issue_attempts_rule"
    FOREIGN KEY ("rule_id")
    REFERENCES "certificate_auto_issue_rules"("rule_id")
    ON DELETE SET NULL,
  CONSTRAINT "fk_cert_auto_issue_attempts_template"
    FOREIGN KEY ("template_id")
    REFERENCES "certificate_templates"("template_id")
    ON DELETE SET NULL,
  CONSTRAINT "fk_cert_auto_issue_attempts_curriculum"
    FOREIGN KEY ("curriculum_id")
    REFERENCES "curricula"("curriculum_id")
    ON DELETE SET NULL,
  CONSTRAINT "fk_cert_auto_issue_attempts_certificate"
    FOREIGN KEY ("certificate_id")
    REFERENCES "candidate_certificates"("certificate_id")
    ON DELETE SET NULL,
  CONSTRAINT "fk_cert_auto_issue_attempts_retry_parent"
    FOREIGN KEY ("retried_from_attempt_id")
    REFERENCES "certificate_auto_issue_attempts"("attempt_id")
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "idx_cert_auto_issue_attempts_status_attempted"
ON "certificate_auto_issue_attempts" ("status", "attempted_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_cert_auto_issue_attempts_learner_attempted"
ON "certificate_auto_issue_attempts" ("candidate_id", "attempted_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_cert_auto_issue_attempts_batch_attempted"
ON "certificate_auto_issue_attempts" ("batch_id", "attempted_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_cert_auto_issue_attempts_rule_attempted"
ON "certificate_auto_issue_attempts" ("rule_id", "attempted_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_cert_auto_issue_attempts_retry_parent"
ON "certificate_auto_issue_attempts" ("retried_from_attempt_id");