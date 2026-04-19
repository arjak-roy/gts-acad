-- Drop legacy auto-issue columns from certificate_templates
-- These are replaced by the certificate_auto_issue_rules table
ALTER TABLE "certificate_templates"
  DROP COLUMN IF EXISTS "auto_issue_enabled",
  DROP COLUMN IF EXISTS "auto_issue_trigger";
