-- Migration: Allow certificate templates without a course (base/library templates)
-- Base templates have course_id = NULL; course-scoped templates keep their course_id.

-- Step 1: Drop the NOT NULL constraint on course_id
ALTER TABLE certificate_templates ALTER COLUMN course_id DROP NOT NULL;

-- Step 2: Recreate existing indexes as partial indexes (only for course-scoped templates)
DROP INDEX IF EXISTS idx_cert_templates_course_active;
CREATE INDEX idx_cert_templates_course_active
  ON certificate_templates (course_id, is_active)
  WHERE course_id IS NOT NULL;

DROP INDEX IF EXISTS idx_cert_templates_course_default;
CREATE INDEX idx_cert_templates_course_default
  ON certificate_templates (course_id, is_default)
  WHERE course_id IS NOT NULL;

-- Step 3: New index for fast listing of base/library templates
CREATE INDEX IF NOT EXISTS idx_cert_templates_base
  ON certificate_templates (created_at DESC)
  WHERE course_id IS NULL;
