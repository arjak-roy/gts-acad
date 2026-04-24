-- Assessment builder enhancements: sections, randomization, difficulty levels, curriculum release types

-- 1. Add new curriculum item release types
ALTER TYPE "curriculum_item_release_type" ADD VALUE IF NOT EXISTS 'stage_completion';
ALTER TYPE "curriculum_item_release_type" ADD VALUE IF NOT EXISTS 'module_completion';

-- 2. Add randomization columns to assessment_pools
ALTER TABLE "assessment_pools"
  ADD COLUMN IF NOT EXISTS "shuffle_questions" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "shuffle_options" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "random_subset_count" INTEGER;

-- 3. Add difficulty_level to assessment_questions and question_bank_questions
ALTER TABLE "assessment_questions"
  ADD COLUMN IF NOT EXISTS "difficulty_level" "difficulty_level";

ALTER TABLE "question_bank_questions"
  ADD COLUMN IF NOT EXISTS "difficulty_level" "difficulty_level";

-- 4. Create assessment_sections table
CREATE TABLE IF NOT EXISTS "assessment_sections" (
    "section_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assessment_pool_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assessment_sections_pkey" PRIMARY KEY ("section_id")
);

-- 5. Add section_id column to assessment_questions
ALTER TABLE "assessment_questions"
  ADD COLUMN IF NOT EXISTS "section_id" UUID;

-- 6. Create indexes
CREATE INDEX IF NOT EXISTS "idx_assessment_sections_pool_order"
  ON "assessment_sections"("assessment_pool_id", "sort_order");

CREATE INDEX IF NOT EXISTS "idx_assessment_questions_section"
  ON "assessment_questions"("section_id");

-- 7. Add foreign keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assessment_sections_assessment_pool_id_fkey'
  ) THEN
    ALTER TABLE "assessment_sections"
      ADD CONSTRAINT "assessment_sections_assessment_pool_id_fkey"
      FOREIGN KEY ("assessment_pool_id")
      REFERENCES "assessment_pools"("assessment_pool_id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assessment_questions_section_id_fkey'
  ) THEN
    ALTER TABLE "assessment_questions"
      ADD CONSTRAINT "assessment_questions_section_id_fkey"
      FOREIGN KEY ("section_id")
      REFERENCES "assessment_sections"("section_id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
