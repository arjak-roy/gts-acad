CREATE TABLE IF NOT EXISTS language_lab_words (
  word_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word_text VARCHAR(255) NOT NULL,
  normalized_word VARCHAR(255) NOT NULL,
  english_meaning VARCHAR(255),
  phonetic VARCHAR(255),
  difficulty INTEGER NOT NULL DEFAULT 1,
  source VARCHAR(50) NOT NULL DEFAULT 'manual',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS language_lab_words_normalized_word_key
  ON language_lab_words (normalized_word);

CREATE INDEX IF NOT EXISTS idx_language_lab_words_active_word
  ON language_lab_words (is_active, word_text);

CREATE TABLE IF NOT EXISTS pronunciation_attempts (
  pronunciation_attempt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word_id UUID NULL REFERENCES language_lab_words(word_id) ON DELETE SET NULL,
  candidate_id UUID NOT NULL REFERENCES candidates(candidate_id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES batches(batch_id) ON DELETE CASCADE,
  source VARCHAR(80) NOT NULL DEFAULT 'pronunciation_lesson',
  model_id VARCHAR(120),
  target_word VARCHAR(255) NOT NULL,
  target_english VARCHAR(255),
  target_phonetic VARCHAR(255),
  overall_score INTEGER NOT NULL DEFAULT 0,
  heard_text TEXT,
  strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
  priorities JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_try_instruction TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pronunciation_attempts_batch_created
  ON pronunciation_attempts (batch_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pronunciation_attempts_candidate_created
  ON pronunciation_attempts (candidate_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pronunciation_attempts_word_created
  ON pronunciation_attempts (word_id, created_at DESC);

CREATE TABLE IF NOT EXISTS pronunciation_attempt_phonemes (
  pronunciation_attempt_phoneme_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES pronunciation_attempts(pronunciation_attempt_id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  phoneme VARCHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL,
  observed VARCHAR(255),
  lip_shape TEXT,
  tip TEXT,
  start_ms INTEGER NOT NULL DEFAULT 0,
  end_ms INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_pronunciation_attempt_phonemes_attempt
  ON pronunciation_attempt_phonemes (attempt_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_roleplays_batch_occurred
  ON roleplays (batch_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_roleplays_candidate_occurred
  ON roleplays (student_id, occurred_at DESC);