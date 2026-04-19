DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'certificate_auto_issue_trigger') THEN
    CREATE TYPE "certificate_auto_issue_trigger" AS ENUM ('curriculum_completion', 'enrollment_completion');
  END IF;
END$$;

ALTER TABLE "certificate_templates"
  ADD COLUMN IF NOT EXISTS "auto_issue_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "auto_issue_trigger" "certificate_auto_issue_trigger" DEFAULT 'curriculum_completion';
