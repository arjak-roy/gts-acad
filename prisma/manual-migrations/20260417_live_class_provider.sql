-- Live class provider enum and schedule event fields for 100ms integration.
-- Apply after the attendance sessions migration.

-- Create the live_class_provider enum.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'live_class_provider') THEN
    CREATE TYPE live_class_provider AS ENUM ('manual', 'hms');
  END IF;
END
$$;

-- Add live class columns to batch_schedule_events.
ALTER TABLE batch_schedule_events
  ADD COLUMN IF NOT EXISTS live_provider live_class_provider NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS live_room_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS live_room_code VARCHAR(255),
  ADD COLUMN IF NOT EXISTS live_started_at TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS live_ended_at TIMESTAMPTZ(6);
