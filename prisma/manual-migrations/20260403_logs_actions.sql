DO $$ BEGIN
  CREATE TYPE "email_log_status" AS ENUM ('pending', 'sent', 'failed', 'retrying');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "email_log_category" AS ENUM ('candidate_welcome', 'two_factor', 'system');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "audit_entity_type" AS ENUM ('batch', 'candidate', 'course', 'email', 'auth', 'system');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "audit_action_type" AS ENUM (
    'created',
    'updated',
    'enrolled',
    'mail_sent',
    'mail_failed',
    'mail_retried',
    'login',
    'two_factor',
    'retry'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "audit_log_level" AS ENUM ('info', 'warn', 'error');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "email_logs" (
  "email_log_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "category" "email_log_category" NOT NULL,
  "template_key" VARCHAR(120),
  "to_email" VARCHAR(255) NOT NULL,
  "subject" VARCHAR(255) NOT NULL,
  "text_body" TEXT,
  "html_body" TEXT,
  "status" "email_log_status" NOT NULL DEFAULT 'pending',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "last_attempt_at" TIMESTAMPTZ,
  "sent_at" TIMESTAMPTZ,
  "error_message" VARCHAR(1000),
  "provider_message_id" VARCHAR(255),
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "triggered_by_user_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "fk_email_logs_triggered_by"
    FOREIGN KEY ("triggered_by_user_id")
    REFERENCES "users"("user_id")
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "idx_email_logs_status_created"
ON "email_logs" ("status", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_email_logs_category_created"
ON "email_logs" ("category", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_email_logs_to_email"
ON "email_logs" ("to_email");

CREATE INDEX IF NOT EXISTS "idx_email_logs_triggered_by"
ON "email_logs" ("triggered_by_user_id");

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "audit_log_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_type" "audit_entity_type" NOT NULL,
  "entity_id" VARCHAR(120),
  "action" "audit_action_type" NOT NULL,
  "level" "audit_log_level" NOT NULL DEFAULT 'info',
  "status" VARCHAR(50),
  "message" VARCHAR(1000) NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "actor_user_id" UUID,
  "email_log_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "fk_audit_logs_actor"
    FOREIGN KEY ("actor_user_id")
    REFERENCES "users"("user_id")
    ON DELETE SET NULL,
  CONSTRAINT "fk_audit_logs_email"
    FOREIGN KEY ("email_log_id")
    REFERENCES "email_logs"("email_log_id")
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "idx_audit_logs_entity_created"
ON "audit_logs" ("entity_type", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_audit_logs_level_created"
ON "audit_logs" ("level", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_audit_logs_actor"
ON "audit_logs" ("actor_user_id");

CREATE INDEX IF NOT EXISTS "idx_audit_logs_email"
ON "audit_logs" ("email_log_id");
