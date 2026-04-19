-- Certification module: CertificateTemplate model + Certificate model expansion
-- Run via: Get-Content prisma\manual-migrations\add-certificate-templates.sql | npx prisma db execute --stdin --schema prisma/schema.prisma

-- 1. New enums
DO $$ BEGIN
  CREATE TYPE certificate_orientation AS ENUM ('landscape', 'portrait');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE certificate_paper_size AS ENUM ('a4', 'letter', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. CertificateTemplate table
CREATE TABLE IF NOT EXISTS certificate_templates (
  template_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id            UUID NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  title                VARCHAR(255) NOT NULL,
  description          TEXT,
  layout_json          JSONB NOT NULL DEFAULT '[]',
  orientation          certificate_orientation NOT NULL DEFAULT 'landscape',
  paper_size           certificate_paper_size NOT NULL DEFAULT 'a4',
  background_color     VARCHAR(30),
  background_image_url TEXT,
  logo_url             TEXT,
  signatory_1_name     VARCHAR(255),
  signatory_1_title    VARCHAR(255),
  signatory_1_signature_url TEXT,
  signatory_2_name     VARCHAR(255),
  signatory_2_title    VARCHAR(255),
  signatory_2_signature_url TEXT,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  is_default           BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_user_id   UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cert_templates_course_active ON certificate_templates (course_id, is_active);
CREATE INDEX IF NOT EXISTS idx_cert_templates_course_default ON certificate_templates (course_id, is_default);

-- 3. Expand existing candidate_certificates table
ALTER TABLE candidate_certificates ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(course_id) ON DELETE SET NULL;
ALTER TABLE candidate_certificates ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES batches(batch_id) ON DELETE SET NULL;
ALTER TABLE candidate_certificates ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES certificate_templates(template_id) ON DELETE SET NULL;
ALTER TABLE candidate_certificates ADD COLUMN IF NOT EXISTS certificate_number VARCHAR(60) UNIQUE;
ALTER TABLE candidate_certificates ADD COLUMN IF NOT EXISTS issued_by_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE candidate_certificates ADD COLUMN IF NOT EXISTS rendered_data_json JSONB;
ALTER TABLE candidate_certificates ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ(6);
ALTER TABLE candidate_certificates ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ(6);
ALTER TABLE candidate_certificates ADD COLUMN IF NOT EXISTS revoked_by_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE candidate_certificates ADD COLUMN IF NOT EXISTS revocation_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_certificates_course_status ON candidate_certificates (course_id, status);
CREATE INDEX IF NOT EXISTS idx_certificates_learner_course ON candidate_certificates (candidate_id, course_id);
