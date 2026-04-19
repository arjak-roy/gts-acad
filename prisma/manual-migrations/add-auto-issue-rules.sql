CREATE TABLE IF NOT EXISTS "certificate_auto_issue_rules" (
  "rule_id"        UUID NOT NULL DEFAULT gen_random_uuid(),
  "template_id"    UUID NOT NULL,
  "batch_id"       UUID NOT NULL,
  "curriculum_id"  UUID,
  "trigger"        "certificate_auto_issue_trigger" NOT NULL,
  "is_active"      BOOLEAN NOT NULL DEFAULT true,
  "created_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "certificate_auto_issue_rules_pkey" PRIMARY KEY ("rule_id"),
  CONSTRAINT "certificate_auto_issue_rules_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "certificate_templates"("template_id") ON DELETE CASCADE,
  CONSTRAINT "certificate_auto_issue_rules_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id") ON DELETE CASCADE,
  CONSTRAINT "certificate_auto_issue_rules_curriculum_id_fkey" FOREIGN KEY ("curriculum_id") REFERENCES "curricula"("curriculum_id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_auto_issue_rule" ON "certificate_auto_issue_rules"("template_id", "batch_id", "curriculum_id");
CREATE INDEX IF NOT EXISTS "idx_auto_issue_rules_batch_trigger" ON "certificate_auto_issue_rules"("batch_id", "trigger", "is_active");
