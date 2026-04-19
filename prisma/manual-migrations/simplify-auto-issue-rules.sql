-- Migration: Simplify certificate auto-issue rules to curriculum-only
-- Purpose: Remove batch-level granularity from auto-issue rules
-- Impact: Rules now map curriculum → template only, regardless of batch enrollment
-- Note: This is a breaking change; existing batch-specific rules must be handled before applying

-- Drop foreign key constraint on batch_id
ALTER TABLE certificate_auto_issue_rules
DROP CONSTRAINT IF EXISTS "certificate_auto_issue_rules_batch_id_fkey";

-- Drop the old unique constraint
ALTER TABLE certificate_auto_issue_rules
DROP CONSTRAINT IF EXISTS "uq_auto_issue_rule";

-- Drop the old index
DROP INDEX IF EXISTS "idx_auto_issue_rules_batch_trigger";

-- Drop batch_id column
ALTER TABLE certificate_auto_issue_rules
DROP COLUMN IF EXISTS batch_id;

-- Add new unique constraint on (template_id, curriculum_id)
ALTER TABLE certificate_auto_issue_rules
ADD CONSTRAINT "uq_auto_issue_rule" UNIQUE (template_id, curriculum_id);

-- Create new index on (trigger, is_active)
CREATE INDEX "idx_auto_issue_rules_trigger" ON certificate_auto_issue_rules (trigger, is_active);
