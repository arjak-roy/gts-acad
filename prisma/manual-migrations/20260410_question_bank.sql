CREATE TABLE IF NOT EXISTS question_bank_questions (
  question_bank_question_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NULL REFERENCES courses(course_id) ON DELETE SET NULL,
  question_text TEXT NOT NULL,
  question_type question_type NOT NULL,
  options JSONB NULL,
  correct_answer JSONB NULL,
  explanation TEXT NULL,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  marks INTEGER NOT NULL DEFAULT 1,
  created_by_user_id UUID NULL REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

ALTER TABLE question_bank_questions
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS idx_question_bank_questions_course_type
  ON question_bank_questions(course_id, question_type);

CREATE INDEX IF NOT EXISTS idx_question_bank_questions_type
  ON question_bank_questions(question_type);

CREATE INDEX IF NOT EXISTS idx_question_bank_questions_creator
  ON question_bank_questions(created_by_user_id);