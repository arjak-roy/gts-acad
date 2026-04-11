DO $$
BEGIN
  CREATE TYPE assessment_attempt_status AS ENUM ('pending_review', 'in_review', 'graded');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS trainer_assessment_assignments (
  assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES trainers(trainer_id) ON DELETE CASCADE,
  assessment_pool_id UUID NOT NULL REFERENCES assessment_pools(assessment_pool_id) ON DELETE CASCADE,
  can_review_submissions BOOLEAN NOT NULL DEFAULT TRUE,
  can_manage_attempts BOOLEAN NOT NULL DEFAULT FALSE,
  can_manual_grade BOOLEAN NOT NULL DEFAULT FALSE,
  notes VARCHAR(1000),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_by_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_trainer_assessment_assignments_capabilities
    CHECK (can_review_submissions OR can_manage_attempts OR can_manual_grade),
  CONSTRAINT uq_trainer_assessment_assignments_trainer_pool UNIQUE (trainer_id, assessment_pool_id)
);

CREATE INDEX IF NOT EXISTS idx_trainer_assessment_assignments_trainer_active
  ON trainer_assessment_assignments(trainer_id, is_active);

CREATE INDEX IF NOT EXISTS idx_trainer_assessment_assignments_pool_active
  ON trainer_assessment_assignments(assessment_pool_id, is_active);

CREATE TABLE IF NOT EXISTS assessment_attempts (
  attempt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(assessment_id) ON DELETE CASCADE,
  assessment_pool_id UUID NOT NULL REFERENCES assessment_pools(assessment_pool_id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(candidate_id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES batches(batch_id) ON DELETE CASCADE,
  status assessment_attempt_status NOT NULL DEFAULT 'pending_review',
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  grading_report JSONB,
  requires_manual_review BOOLEAN NOT NULL DEFAULT FALSE,
  marks_obtained INTEGER,
  total_marks INTEGER NOT NULL,
  percentage INTEGER,
  passed BOOLEAN,
  reviewer_feedback TEXT,
  review_started_at TIMESTAMPTZ(6),
  reviewed_by_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  graded_at TIMESTAMPTZ(6),
  CONSTRAINT uq_assessment_attempts_assessment_candidate UNIQUE (assessment_id, candidate_id),
  CONSTRAINT chk_assessment_attempts_total_marks CHECK (total_marks >= 0),
  CONSTRAINT chk_assessment_attempts_marks_range
    CHECK (marks_obtained IS NULL OR (marks_obtained >= 0 AND marks_obtained <= total_marks)),
  CONSTRAINT chk_assessment_attempts_percentage_range
    CHECK (percentage IS NULL OR (percentage >= 0 AND percentage <= 100))
);

CREATE INDEX IF NOT EXISTS idx_assessment_attempts_pool_status
  ON assessment_attempts(assessment_pool_id, status);

CREATE INDEX IF NOT EXISTS idx_assessment_attempts_candidate_submitted
  ON assessment_attempts(candidate_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_assessment_attempts_reviewer_status
  ON assessment_attempts(reviewed_by_user_id, status);

CREATE INDEX IF NOT EXISTS idx_assessment_attempts_batch_status
  ON assessment_attempts(batch_id, status);