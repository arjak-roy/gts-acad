-- Migration: Trainer Profile Extended Fields + Status History
-- Adds department, jobTitle, skills, certifications, experienceYears,
-- preferredLanguage, timeZone, profilePhotoUrl, updatedById,
-- trainerStatus enum column, and TrainerStatusHistory table.

-- 1. Create TrainerProfileStatus enum
DO $$ BEGIN
  CREATE TYPE trainer_profile_status AS ENUM ('active', 'inactive', 'suspended');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. Extend trainers table with new columns
ALTER TABLE trainers
  ADD COLUMN IF NOT EXISTS department              VARCHAR(255),
  ADD COLUMN IF NOT EXISTS job_title               VARCHAR(255),
  ADD COLUMN IF NOT EXISTS skills                  TEXT[]    NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS certifications          TEXT[]    NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS experience_years        INTEGER,
  ADD COLUMN IF NOT EXISTS preferred_language      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS time_zone               VARCHAR(100),
  ADD COLUMN IF NOT EXISTS profile_photo_url       TEXT,
  ADD COLUMN IF NOT EXISTS updated_by_user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS trainer_status          trainer_profile_status NOT NULL DEFAULT 'active';

-- 3. Back-fill trainer_status from existing is_active column
UPDATE trainers SET trainer_status = CASE WHEN is_active THEN 'active'::trainer_profile_status ELSE 'inactive'::trainer_profile_status END;

-- 4. Create TrainerStatusHistory table
CREATE TABLE IF NOT EXISTS trainer_status_history (
  history_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id          UUID        NOT NULL REFERENCES trainers(trainer_id) ON DELETE CASCADE,
  old_status          trainer_profile_status NOT NULL,
  new_status          trainer_profile_status NOT NULL,
  reason              VARCHAR(500),
  changed_by_user_id  UUID        REFERENCES users(id) ON DELETE SET NULL,
  changed_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_trainers_trainer_status ON trainers(trainer_status);
CREATE INDEX IF NOT EXISTS idx_trainers_department ON trainers(department);
CREATE INDEX IF NOT EXISTS idx_trainer_status_history_trainer ON trainer_status_history(trainer_id, changed_at);
