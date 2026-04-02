BEGIN;

CREATE TABLE IF NOT EXISTS "two_factor_challenges" (
  "challenge_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "purpose" VARCHAR(50) NOT NULL,
  "code_hash" VARCHAR(255) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 5,
  "sent_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consumed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "two_factor_challenges_pkey" PRIMARY KEY ("challenge_id"),
  CONSTRAINT "two_factor_challenges_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("user_id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_two_factor_challenges_user_purpose"
  ON "two_factor_challenges" ("user_id", "purpose", "created_at");

CREATE INDEX IF NOT EXISTS "idx_two_factor_challenges_expires_at"
  ON "two_factor_challenges" ("expires_at");

COMMIT;