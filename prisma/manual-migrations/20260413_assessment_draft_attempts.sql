DO $$
BEGIN
  ALTER TYPE assessment_attempt_status ADD VALUE 'draft';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE assessment_attempts
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW();

ALTER TABLE assessment_attempts
ADD COLUMN IF NOT EXISTS last_saved_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW();

ALTER TABLE assessment_attempts
ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ(6);

ALTER TABLE assessment_attempts
ADD COLUMN IF NOT EXISTS auto_submitted_at TIMESTAMPTZ(6);

UPDATE assessment_attempts
SET started_at = COALESCE(started_at, submitted_at),
    last_saved_at = COALESCE(last_saved_at, submitted_at)
WHERE started_at IS NULL
   OR last_saved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_assessment_attempts_status_deadline
  ON assessment_attempts(status, deadline_at);