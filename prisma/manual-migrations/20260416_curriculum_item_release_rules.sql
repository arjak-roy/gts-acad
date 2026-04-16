DO $$
BEGIN
  CREATE TYPE curriculum_item_release_type AS ENUM (
    'immediate',
    'absolute_date',
    'batch_relative',
    'previous_item_completion',
    'previous_item_score',
    'manual'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS curriculum_stage_item_releases (
  release_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_item_id uuid NOT NULL UNIQUE,
  release_type curriculum_item_release_type NOT NULL DEFAULT 'immediate',
  release_at timestamptz(6),
  release_offset_days integer,
  prerequisite_stage_item_id uuid,
  minimum_score_percent integer,
  estimated_duration_minutes integer,
  due_at timestamptz(6),
  due_offset_days integer,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT fk_curriculum_stage_item_releases_stage_item
    FOREIGN KEY (stage_item_id) REFERENCES curriculum_stage_items(item_id) ON DELETE CASCADE,
  CONSTRAINT fk_curriculum_stage_item_releases_prerequisite
    FOREIGN KEY (prerequisite_stage_item_id) REFERENCES curriculum_stage_items(item_id) ON DELETE SET NULL,
  CONSTRAINT chk_curriculum_stage_item_releases_offset
    CHECK (release_offset_days IS NULL OR release_offset_days >= 0),
  CONSTRAINT chk_curriculum_stage_item_releases_minimum_score
    CHECK (minimum_score_percent IS NULL OR (minimum_score_percent >= 0 AND minimum_score_percent <= 100)),
  CONSTRAINT chk_curriculum_stage_item_releases_estimated_duration
    CHECK (estimated_duration_minutes IS NULL OR estimated_duration_minutes > 0),
  CONSTRAINT chk_curriculum_stage_item_releases_due_offset
    CHECK (due_offset_days IS NULL OR due_offset_days >= 0)
);

CREATE INDEX IF NOT EXISTS idx_curriculum_stage_item_releases_type
  ON curriculum_stage_item_releases (release_type);

CREATE INDEX IF NOT EXISTS idx_curriculum_stage_item_releases_prerequisite
  ON curriculum_stage_item_releases (prerequisite_stage_item_id);

CREATE TABLE IF NOT EXISTS batch_curriculum_stage_item_releases (
  release_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL,
  stage_item_id uuid NOT NULL,
  released_by_user_id uuid,
  note varchar(500),
  released_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT fk_batch_curriculum_stage_item_releases_batch
    FOREIGN KEY (batch_id) REFERENCES batches(batch_id) ON DELETE CASCADE,
  CONSTRAINT fk_batch_curriculum_stage_item_releases_stage_item
    FOREIGN KEY (stage_item_id) REFERENCES curriculum_stage_items(item_id) ON DELETE CASCADE,
  CONSTRAINT uq_batch_curriculum_stage_item_releases_batch_item
    UNIQUE (batch_id, stage_item_id)
);

CREATE INDEX IF NOT EXISTS idx_batch_curriculum_stage_item_releases_item
  ON batch_curriculum_stage_item_releases (stage_item_id);