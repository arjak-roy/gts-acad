-- Curriculum Builder: Cloning, Templates, Completion Rules, Prerequisites

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'curriculum_completion_rule') THEN
    CREATE TYPE curriculum_completion_rule AS ENUM ('all_required', 'all_items', 'percentage', 'min_items');
  END IF;
END $$;

-- Cloning & Templates on Curriculum
ALTER TABLE curricula ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE curricula ADD COLUMN IF NOT EXISTS source_curriculum_id UUID REFERENCES curricula(curriculum_id) ON DELETE SET NULL;

-- Completion Rules on Modules
ALTER TABLE curriculum_modules ADD COLUMN IF NOT EXISTS completion_rule curriculum_completion_rule NOT NULL DEFAULT 'all_required';
ALTER TABLE curriculum_modules ADD COLUMN IF NOT EXISTS completion_threshold INTEGER;
ALTER TABLE curriculum_modules ADD COLUMN IF NOT EXISTS prerequisite_module_id UUID REFERENCES curriculum_modules(module_id) ON DELETE SET NULL;

-- Completion Rules on Stages
ALTER TABLE curriculum_stages ADD COLUMN IF NOT EXISTS completion_rule curriculum_completion_rule NOT NULL DEFAULT 'all_required';
ALTER TABLE curriculum_stages ADD COLUMN IF NOT EXISTS completion_threshold INTEGER;
ALTER TABLE curriculum_stages ADD COLUMN IF NOT EXISTS prerequisite_stage_id UUID REFERENCES curriculum_stages(stage_id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_curricula_is_template ON curricula(is_template);
