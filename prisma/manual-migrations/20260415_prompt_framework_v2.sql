-- Prompt Framework v2 migration
-- Run via: npm run db:sync:language-lab (or manually against the target database)
--
-- 1. Add new columns to buddy_personas
-- 2. Remove unique constraint on buddy_persona_course_assignments.course_id
-- 3. Add priority column to buddy_persona_course_assignments
-- 4. Create buddy_prompt_versions table
-- 5. Backfill capabilities from existing boolean flags

BEGIN;

-- -----------------------------------------------------------------------
-- 1. buddy_personas: add prompt_type, capabilities, prompt_version
-- -----------------------------------------------------------------------

ALTER TABLE buddy_personas
  ADD COLUMN IF NOT EXISTS prompt_type VARCHAR(40) NOT NULL DEFAULT 'buddy',
  ADD COLUMN IF NOT EXISTS capabilities JSONB NOT NULL DEFAULT '["tables","lists","vocab-cards","speech"]',
  ADD COLUMN IF NOT EXISTS prompt_version INT NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_buddy_personas_prompt_type_active
  ON buddy_personas (prompt_type, is_active);

-- -----------------------------------------------------------------------
-- 2. buddy_persona_course_assignments: drop unique, add priority
-- -----------------------------------------------------------------------

-- Drop the unique constraint on course_id (allows multi-persona per course)
ALTER TABLE buddy_persona_course_assignments
  DROP CONSTRAINT IF EXISTS buddy_persona_course_assignments_course_id_key;

ALTER TABLE buddy_persona_course_assignments
  ADD COLUMN IF NOT EXISTS priority INT NOT NULL DEFAULT 0;

-- -----------------------------------------------------------------------
-- 3. buddy_prompt_versions
-- -----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS buddy_prompt_versions (
  version_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buddy_persona_id UUID          REFERENCES buddy_personas(buddy_persona_id) ON DELETE CASCADE,
  setting_key     VARCHAR(120),
  prompt_type     VARCHAR(40)   NOT NULL,
  scope           VARCHAR(20)   NOT NULL,
  version         INT           NOT NULL,
  content         TEXT          NOT NULL,
  created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  created_by      UUID          REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_buddy_prompt_versions_persona_lookup
  ON buddy_prompt_versions (buddy_persona_id, prompt_type, scope, version);

CREATE INDEX IF NOT EXISTS idx_buddy_prompt_versions_setting_lookup
  ON buddy_prompt_versions (setting_key, prompt_type, scope, version);

-- -----------------------------------------------------------------------
-- 4. Backfill capabilities from legacy boolean flags
-- -----------------------------------------------------------------------

UPDATE buddy_personas
SET capabilities = (
  SELECT jsonb_agg(cap)
  FROM (
    SELECT unnest(ARRAY['tables']) AS cap WHERE supports_tables = true
    UNION ALL
    SELECT 'lists'
    UNION ALL
    SELECT 'vocab-cards'
    UNION ALL
    SELECT unnest(ARRAY['email-actions']) WHERE supports_email_actions = true
    UNION ALL
    SELECT unnest(ARRAY['speech']) WHERE supports_speech = true
  ) AS caps
)
WHERE capabilities = '["tables","lists","vocab-cards","speech"]'::jsonb;

COMMIT;
