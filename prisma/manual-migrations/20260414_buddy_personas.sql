CREATE TABLE IF NOT EXISTS "buddy_personas" (
  "buddy_persona_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "persona_name" VARCHAR(160) NOT NULL,
  "normalized_name" VARCHAR(160) NOT NULL,
  "persona_description" TEXT,
  "conversation_language" VARCHAR(80) NOT NULL,
  "language_code" VARCHAR(20) NOT NULL,
  "system_prompt" TEXT,
  "welcome_message" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "buddy_personas_normalized_name_key"
ON "buddy_personas" ("normalized_name");

CREATE INDEX IF NOT EXISTS "idx_buddy_personas_active"
ON "buddy_personas" ("is_active");

CREATE INDEX IF NOT EXISTS "idx_buddy_personas_language_active"
ON "buddy_personas" ("language_code", "is_active");

CREATE TABLE IF NOT EXISTS "buddy_persona_course_assignments" (
  "buddy_persona_id" UUID NOT NULL,
  "course_id" UUID NOT NULL,
  "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "buddy_persona_course_assignments_pkey" PRIMARY KEY ("buddy_persona_id", "course_id"),
  CONSTRAINT "fk_buddy_persona_course_assignments_persona"
    FOREIGN KEY ("buddy_persona_id")
    REFERENCES "buddy_personas"("buddy_persona_id")
    ON DELETE CASCADE,
  CONSTRAINT "fk_buddy_persona_course_assignments_course"
    FOREIGN KEY ("course_id")
    REFERENCES "courses"("course_id")
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "buddy_persona_course_assignments_course_id_key"
ON "buddy_persona_course_assignments" ("course_id");

CREATE INDEX IF NOT EXISTS "idx_buddy_persona_course_assignments_course"
ON "buddy_persona_course_assignments" ("course_id");