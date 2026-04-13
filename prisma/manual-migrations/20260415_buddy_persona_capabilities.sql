ALTER TABLE "buddy_personas"
ADD COLUMN IF NOT EXISTS "supports_tables" BOOLEAN;

UPDATE "buddy_personas"
SET "supports_tables" = TRUE
WHERE "supports_tables" IS NULL;

ALTER TABLE "buddy_personas"
ALTER COLUMN "supports_tables" SET DEFAULT TRUE;

ALTER TABLE "buddy_personas"
ALTER COLUMN "supports_tables" SET NOT NULL;

ALTER TABLE "buddy_personas"
ADD COLUMN IF NOT EXISTS "supports_email_actions" BOOLEAN;

UPDATE "buddy_personas"
SET "supports_email_actions" = FALSE
WHERE "supports_email_actions" IS NULL;

ALTER TABLE "buddy_personas"
ALTER COLUMN "supports_email_actions" SET DEFAULT FALSE;

ALTER TABLE "buddy_personas"
ALTER COLUMN "supports_email_actions" SET NOT NULL;

ALTER TABLE "buddy_personas"
ADD COLUMN IF NOT EXISTS "supports_speech" BOOLEAN;

UPDATE "buddy_personas"
SET "supports_speech" = TRUE
WHERE "supports_speech" IS NULL;

ALTER TABLE "buddy_personas"
ALTER COLUMN "supports_speech" SET DEFAULT TRUE;

ALTER TABLE "buddy_personas"
ALTER COLUMN "supports_speech" SET NOT NULL;