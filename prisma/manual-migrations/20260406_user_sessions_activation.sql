BEGIN;

ALTER TABLE "user_security"
  ADD COLUMN IF NOT EXISTS "session_invalidated_at" TIMESTAMPTZ(6);

CREATE TABLE IF NOT EXISTS "user_sessions" (
  "session_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "device" VARCHAR(120),
  "browser" VARCHAR(120),
  "ip_address" VARCHAR(64),
  "user_agent" VARCHAR(255),
  "remember_me" BOOLEAN NOT NULL DEFAULT false,
  "login_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_activity_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "revoked_at" TIMESTAMPTZ(6),
  "revoked_reason" VARCHAR(80),

  CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("session_id"),
  CONSTRAINT "user_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("user_id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_user_sessions_user_state"
  ON "user_sessions" ("user_id", "revoked_at", "expires_at");

CREATE INDEX IF NOT EXISTS "idx_user_sessions_expires_at"
  ON "user_sessions" ("expires_at");

CREATE INDEX IF NOT EXISTS "idx_user_sessions_last_activity"
  ON "user_sessions" ("last_activity_at");

CREATE TABLE IF NOT EXISTS "account_activation_tokens" (
  "activation_token_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "token_hash" VARCHAR(255) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "sent_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consumed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "account_activation_tokens_pkey" PRIMARY KEY ("activation_token_id"),
  CONSTRAINT "account_activation_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("user_id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_account_activation_tokens_user_created"
  ON "account_activation_tokens" ("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "idx_account_activation_tokens_expires_at"
  ON "account_activation_tokens" ("expires_at");

CREATE INDEX IF NOT EXISTS "idx_account_activation_tokens_token_hash"
  ON "account_activation_tokens" ("token_hash");

COMMIT;