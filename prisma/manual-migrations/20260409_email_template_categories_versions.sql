-- Email Template Categories table
CREATE TABLE IF NOT EXISTS "email_template_categories" (
  "category_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(120) NOT NULL,
  "code" VARCHAR(80) NOT NULL UNIQUE,
  "description" VARCHAR(500),
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default categories
INSERT INTO "email_template_categories" ("name", "code", "description")
VALUES
  ('Authentication Emails', 'authentication', 'Emails related to login, 2FA, password reset, and account activation.'),
  ('User Management Emails', 'user-management', 'Emails for user invitations, welcome credentials, and account lifecycle.'),
  ('Course Emails', 'course', 'Emails for course enrollment, completion, and related notifications.'),
  ('Quiz Emails', 'quiz', 'Emails for quiz assignments and result notifications.'),
  ('Trainer Emails', 'trainer', 'Emails for trainer assignment and training-related notifications.'),
  ('Notification Emails', 'notification', 'General operational and system notification emails.'),
  ('System Emails', 'system', 'Internal system emails for administrative and diagnostic purposes.')
ON CONFLICT ("code") DO NOTHING;

-- Add new columns to email_templates
ALTER TABLE "email_templates"
  ADD COLUMN IF NOT EXISTS "category_id" UUID REFERENCES "email_template_categories"("category_id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "created_by_user_id" UUID REFERENCES "users"("user_id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "updated_by_user_id" UUID REFERENCES "users"("user_id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "idx_email_templates_category"
ON "email_templates" ("category_id");

-- Backfill categories for existing system templates
UPDATE "email_templates"
SET "category_id" = (SELECT "category_id" FROM "email_template_categories" WHERE "code" = 'authentication')
WHERE "template_key" IN ('auth-2fa-code', 'auth-password-reset', 'auth-account-activation')
  AND "category_id" IS NULL;

UPDATE "email_templates"
SET "category_id" = (SELECT "category_id" FROM "email_template_categories" WHERE "code" = 'user-management')
WHERE "template_key" IN ('internal-user-password-changed', 'candidate-welcome-credentials', 'internal-user-welcome-credentials')
  AND "category_id" IS NULL;

-- Email Template Versions table
CREATE TABLE IF NOT EXISTS "email_template_versions" (
  "version_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "template_id" UUID NOT NULL REFERENCES "email_templates"("template_id") ON DELETE CASCADE,
  "version_number" INT NOT NULL,
  "subject" VARCHAR(255) NOT NULL,
  "html_content" TEXT NOT NULL,
  "text_content" TEXT,
  "updated_by_user_id" UUID REFERENCES "users"("user_id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_email_template_versions_template_version"
ON "email_template_versions" ("template_id", "version_number");
