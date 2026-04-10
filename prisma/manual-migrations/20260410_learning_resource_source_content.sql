ALTER TABLE learning_resources
ADD COLUMN IF NOT EXISTS source_content_id UUID;

DO $$
BEGIN
  ALTER TABLE learning_resources
  ADD CONSTRAINT learning_resources_source_content_id_fkey
  FOREIGN KEY (source_content_id)
  REFERENCES course_contents(content_id)
  ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS learning_resources_source_content_id_key
ON learning_resources (source_content_id)
WHERE source_content_id IS NOT NULL;