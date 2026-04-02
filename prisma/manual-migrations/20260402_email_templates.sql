CREATE TABLE IF NOT EXISTS "email_templates" (
  "template_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "template_key" VARCHAR(120) NOT NULL UNIQUE,
  "name" VARCHAR(255) NOT NULL,
  "description" VARCHAR(500),
  "subject" VARCHAR(255) NOT NULL,
  "html_content" TEXT NOT NULL,
  "text_content" TEXT,
  "variables" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "is_system" BOOLEAN NOT NULL DEFAULT FALSE,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_email_templates_active_updated"
ON "email_templates" ("is_active", "updated_at" DESC);