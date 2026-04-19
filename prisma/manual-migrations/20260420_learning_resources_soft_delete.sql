ALTER TABLE learning_resources
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ(6);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'learning_resources_deleted_by_user_id_fkey'
  ) THEN
    ALTER TABLE learning_resources
      ADD CONSTRAINT learning_resources_deleted_by_user_id_fkey
      FOREIGN KEY (deleted_by_user_id)
      REFERENCES users(user_id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_learning_resources_active_updated
  ON learning_resources(deleted_at, updated_at);
