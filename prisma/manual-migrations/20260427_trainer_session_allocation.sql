-- Trainer Session Allocation & Calendar Management
-- Adds trainer-level session assignment, session lifecycle tracking, and audit history

-- ============================================================
-- 1. New enums
-- ============================================================

DO $$ BEGIN
  CREATE TYPE "trainer_session_role" AS ENUM ('primary', 'co_trainer', 'reviewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "session_type" AS ENUM ('course_session', 'review_session', 'assessment_review', 'workshop', 'webinar');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "session_history_action" AS ENUM ('created', 'updated', 'trainer_assigned', 'trainer_removed', 'trainer_role_changed', 'rescheduled', 'cancelled', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. Extend batch_schedule_events with session lifecycle fields
-- ============================================================

ALTER TABLE "batch_schedule_events"
  ADD COLUMN IF NOT EXISTS "session_type" "session_type",
  ADD COLUMN IF NOT EXISTS "reschedule_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "cancellation_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "completion_notes" TEXT,
  ADD COLUMN IF NOT EXISTS "attendance_count" INTEGER;

-- ============================================================
-- 3. Trainer Session Assignment (junction table)
-- ============================================================

CREATE TABLE IF NOT EXISTS "trainer_session_assignments" (
  "assignment_id"      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "schedule_event_id"  UUID NOT NULL REFERENCES "batch_schedule_events"("event_id") ON DELETE CASCADE,
  "trainer_id"         UUID NOT NULL REFERENCES "trainers"("trainer_id") ON DELETE CASCADE,
  "role"               "trainer_session_role" NOT NULL DEFAULT 'primary',
  "assigned_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "assigned_by_id"     UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "removed_at"         TIMESTAMPTZ(6),
  "removed_by_id"      UUID REFERENCES "users"("id") ON DELETE SET NULL
);

-- Unique constraint: one active assignment per trainer per event
CREATE UNIQUE INDEX IF NOT EXISTS "uq_trainer_session_active"
  ON "trainer_session_assignments" ("schedule_event_id", "trainer_id")
  WHERE "removed_at" IS NULL;

-- Performance indexes
CREATE INDEX IF NOT EXISTS "idx_trainer_session_assignments_trainer"
  ON "trainer_session_assignments" ("trainer_id")
  WHERE "removed_at" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_trainer_session_assignments_event"
  ON "trainer_session_assignments" ("schedule_event_id")
  WHERE "removed_at" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_trainer_session_assignments_role"
  ON "trainer_session_assignments" ("role")
  WHERE "removed_at" IS NULL;

-- ============================================================
-- 4. Session History (audit trail)
-- ============================================================

CREATE TABLE IF NOT EXISTS "session_history" (
  "history_id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "schedule_event_id"  UUID NOT NULL REFERENCES "batch_schedule_events"("event_id") ON DELETE CASCADE,
  "action"             "session_history_action" NOT NULL,
  "actor_user_id"      UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "details"            JSONB NOT NULL DEFAULT '{}',
  "created_at"         TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_session_history_event"
  ON "session_history" ("schedule_event_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_session_history_actor"
  ON "session_history" ("actor_user_id")
  WHERE "actor_user_id" IS NOT NULL;
