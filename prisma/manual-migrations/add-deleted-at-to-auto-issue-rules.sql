-- Add soft-delete support to certificate_auto_issue_rules
ALTER TABLE "certificate_auto_issue_rules"
  ADD COLUMN "deleted_at" timestamptz;

-- Create index for efficient filtering of non-deleted rules
CREATE INDEX "idx_auto_issue_rules_deleted_at" ON "certificate_auto_issue_rules" ("deleted_at")
  WHERE "deleted_at" IS NULL;
