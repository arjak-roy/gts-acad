DO $$
BEGIN
  CREATE TYPE "setting_type" AS ENUM (
    'text',
    'textarea',
    'number',
    'select',
    'toggle',
    'file',
    'password',
    'multi_select',
    'email',
    'phone',
    'url',
    'color'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "settings_categories" (
  "category_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(120) NOT NULL,
  "code" VARCHAR(80) NOT NULL UNIQUE,
  "description" VARCHAR(500),
  "icon" VARCHAR(80),
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "is_system" BOOLEAN NOT NULL DEFAULT FALSE,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "settings" (
  "setting_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "category_id" UUID NOT NULL REFERENCES "settings_categories"("category_id") ON DELETE CASCADE,
  "setting_key" VARCHAR(120) NOT NULL UNIQUE,
  "label" VARCHAR(160) NOT NULL,
  "description" VARCHAR(500),
  "type" "setting_type" NOT NULL,
  "value" JSONB,
  "default_value" JSONB,
  "placeholder" VARCHAR(255),
  "help_text" VARCHAR(500),
  "options" JSONB,
  "validation_rules" JSONB,
  "group_name" VARCHAR(120),
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "is_required" BOOLEAN NOT NULL DEFAULT FALSE,
  "is_encrypted" BOOLEAN NOT NULL DEFAULT FALSE,
  "is_readonly" BOOLEAN NOT NULL DEFAULT FALSE,
  "is_system" BOOLEAN NOT NULL DEFAULT FALSE,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "settings_audit_logs" (
  "settings_audit_log_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "setting_id" UUID REFERENCES "settings"("setting_id") ON DELETE SET NULL,
  "setting_key" VARCHAR(120) NOT NULL,
  "category_code" VARCHAR(80) NOT NULL,
  "action" VARCHAR(50) NOT NULL,
  "old_value" JSONB,
  "new_value" JSONB,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "actor_user_id" UUID REFERENCES "users"("user_id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_settings_categories_order"
ON "settings_categories" ("display_order", "is_active");

CREATE INDEX IF NOT EXISTS "idx_settings_category_order"
ON "settings" ("category_id", "display_order");

CREATE INDEX IF NOT EXISTS "idx_settings_active_updated"
ON "settings" ("is_active", "updated_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_settings_audit_category_created"
ON "settings_audit_logs" ("category_code", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_settings_audit_key_created"
ON "settings_audit_logs" ("setting_key", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_settings_audit_actor"
ON "settings_audit_logs" ("actor_user_id");