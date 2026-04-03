BEGIN;

CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "reset_token_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "token_hash" VARCHAR(255) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "sent_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consumed_at" TIMESTAMPTZ(6),
  "request_ip" VARCHAR(64),
  "user_agent" VARCHAR(255),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("reset_token_id"),
  CONSTRAINT "password_reset_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("user_id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_password_reset_tokens_user_created"
  ON "password_reset_tokens" ("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "idx_password_reset_tokens_expires_at"
  ON "password_reset_tokens" ("expires_at");

CREATE INDEX IF NOT EXISTS "idx_password_reset_tokens_token_hash"
  ON "password_reset_tokens" ("token_hash");

COMMIT;
