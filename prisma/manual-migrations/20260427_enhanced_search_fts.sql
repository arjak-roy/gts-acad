-- =============================================================================
-- Global Search: Enhanced FTS with Tags, Course Code, Category, Trainer Name
-- =============================================================================
-- Extends the materialized search_index view to include:
--   - Course Code in the course search vector
--   - Tags (via learning_resource_tag_map + learning_resource_tags) for resources
--   - Category / Subcategory name for resources
--   - Trainer names associated with courses (via trainer_course_assignments)
-- =============================================================================

-- 1. Drop existing view and recreate
DROP MATERIALIZED VIEW IF EXISTS search_index;

-- 2. Create the enhanced unified search materialized view
CREATE MATERIALIZED VIEW search_index AS

-- Learners
SELECT
  c.candidate_id::text              AS id,
  'learners'                        AS entity_type,
  c.full_name                       AS title,
  COALESCE(c.candidate_code, '') || ' | ' || COALESCE(c.email, '') AS description,
  '/learners?search=' || COALESCE(c.candidate_code, c.candidate_id::text) || '&id=' || COALESCE(c.candidate_code, '') AS href,
  JSONB_BUILD_OBJECT(
    'learnerCode', COALESCE(c.candidate_code, ''),
    'email', COALESCE(c.email, '')
  ) AS metadata,
  TO_TSVECTOR('english',
    COALESCE(c.full_name, '') || ' ' ||
    COALESCE(c.candidate_code, '') || ' ' ||
    COALESCE(c.email, '')
  ) AS search_vector,
  c.full_name AS sort_title
FROM candidates c

UNION ALL

-- Batches
SELECT
  b.batch_id::text,
  'batches',
  b.code || ' - ' || b.batch_name,
  COALESCE(p.program_name, '') || ' | ' || COALESCE(b.campus, ''),
  '/batches?viewId=' || b.batch_id::text,
  JSONB_BUILD_OBJECT(
    'programName', COALESCE(p.program_name, ''),
    'campus', COALESCE(b.campus, '')
  ),
  TO_TSVECTOR('english',
    COALESCE(b.code, '') || ' ' ||
    COALESCE(b.batch_name, '') || ' ' ||
    COALESCE(b.campus, '') || ' ' ||
    COALESCE(p.program_name, '')
  ),
  b.code
FROM batches b
LEFT JOIN programs p ON p.program_id = b.program_id

UNION ALL

-- Trainers
SELECT
  t.trainer_id::text,
  'trainers',
  u.full_name,
  COALESCE(t.specialization, '') || ' | ' || COALESCE(u.email, ''),
  '/trainers?viewId=' || t.trainer_id::text,
  JSONB_BUILD_OBJECT(
    'specialization', COALESCE(t.specialization, ''),
    'email', COALESCE(u.email, '')
  ),
  TO_TSVECTOR('english',
    COALESCE(u.full_name, '') || ' ' ||
    COALESCE(u.email, '') || ' ' ||
    COALESCE(t.employee_code, '') || ' ' ||
    COALESCE(t.specialization, '')
  ),
  u.full_name
FROM trainers t
JOIN users u ON u.user_id = t.user_id

UNION ALL

-- Programs
SELECT
  p.program_id::text,
  'programs',
  p.program_name,
  COALESCE(c.course_name, '') || ' | ' || COALESCE(p.category::text, '') || ' | ' || CASE WHEN p.is_active THEN 'Active' ELSE 'Inactive' END,
  '/programs?viewId=' || p.program_id::text,
  JSONB_BUILD_OBJECT(
    'courseName', COALESCE(c.course_name, ''),
    'type', COALESCE(p.category::text, ''),
    'isActive', p.is_active::text
  ),
  TO_TSVECTOR('english',
    COALESCE(p.program_name, '') || ' ' ||
    COALESCE(p.category::text, '') || ' ' ||
    COALESCE(p.description, '') || ' ' ||
    COALESCE(c.course_name, '')
  ),
  p.program_name
FROM programs p
LEFT JOIN courses c ON c.course_id = p.course_id

UNION ALL

-- Courses (ENHANCED: includes course code + trainer names)
SELECT
  c.course_id::text,
  'courses',
  c.course_name,
  COALESCE(c.code, '') || ' | ' || COALESCE(c.course_desc, '') || CASE WHEN trainer_agg.trainer_names IS NOT NULL THEN ' | Trainers: ' || trainer_agg.trainer_names ELSE '' END,
  '/courses?viewId=' || c.course_id::text,
  JSONB_BUILD_OBJECT(
    'code', COALESCE(c.code, ''),
    'description', COALESCE(c.course_desc, ''),
    'status', COALESCE(c.course_status::text, ''),
    'trainerNames', COALESCE(trainer_agg.trainer_names, '')
  ),
  TO_TSVECTOR('english',
    COALESCE(c.course_name, '') || ' ' ||
    COALESCE(c.code, '') || ' ' ||
    COALESCE(c.course_desc, '') || ' ' ||
    COALESCE(trainer_agg.trainer_names, '')
  ),
  c.course_name
FROM courses c
LEFT JOIN LATERAL (
  SELECT STRING_AGG(u.full_name, ' ') AS trainer_names
  FROM trainer_course_assignments tca
  JOIN trainers t ON t.trainer_id = tca.trainer_id
  JOIN users u ON u.user_id = t.user_id
  WHERE tca.course_id = c.course_id
) trainer_agg ON TRUE

UNION ALL

-- Assessment Pools
SELECT
  ap.assessment_pool_id::text,
  'assessments',
  ap.title,
  COALESCE(ap.code, '') || ' | ' || COALESCE(ap.question_type::text, '') || ' | ' || COALESCE(ap.difficulty_level::text, '') || ' | ' || COALESCE(ap.status::text, ''),
  '/assessments?viewId=' || ap.assessment_pool_id::text,
  JSONB_BUILD_OBJECT(
    'code', COALESCE(ap.code, ''),
    'status', COALESCE(ap.status::text, ''),
    'questionType', COALESCE(ap.question_type::text, ''),
    'difficulty', COALESCE(ap.difficulty_level::text, '')
  ),
  TO_TSVECTOR('english',
    COALESCE(ap.title, '') || ' ' ||
    COALESCE(ap.code, '') || ' ' ||
    COALESCE(ap.description, '')
  ),
  ap.title
FROM assessment_pools ap

UNION ALL

-- Curriculum
SELECT
  cur.curriculum_id::text,
  'curriculum',
  cur.title,
  COALESCE(c.course_name, '') || ' | ' || COALESCE(cur.status::text, ''),
  '/curriculum-builder?viewId=' || cur.curriculum_id::text,
  JSONB_BUILD_OBJECT(
    'courseName', COALESCE(c.course_name, ''),
    'status', COALESCE(cur.status::text, '')
  ),
  TO_TSVECTOR('english',
    COALESCE(cur.title, '') || ' ' ||
    COALESCE(cur.description, '') || ' ' ||
    COALESCE(c.course_name, '')
  ),
  cur.title
FROM curricula cur
LEFT JOIN courses c ON c.course_id = cur.course_id

UNION ALL

-- Training Centres
SELECT
  tc.id::text,
  'centres',
  tc.centre_name,
  COALESCE(tc.address_line_1, '') || ' | ' || CASE WHEN tc.is_active THEN 'Active' ELSE 'Inactive' END,
  '/centers?viewId=' || tc.id::text,
  JSONB_BUILD_OBJECT(
    'compliance', COALESCE(tc.compliance_status::text, 'pending'),
    'isActive', tc.is_active::text
  ),
  TO_TSVECTOR('english',
    COALESCE(tc.centre_name, '') || ' ' ||
    COALESCE(tc.address_line_1, '') || ' ' ||
    COALESCE(tc.address_line_2, '') || ' ' ||
    COALESCE(tc.landmark, '') || ' ' ||
    COALESCE(tc.postal_code, '')
  ),
  tc.centre_name
FROM training_centres tc

UNION ALL

-- Course Content
SELECT
  cc.content_id::text,
  'course_content',
  cc.title,
  COALESCE(c.course_name, '') || ' | ' || COALESCE(cc.content_type::text, '') || ' | ' || COALESCE(cc.status::text, ''),
  '/course-builder?courseId=' || cc.course_id::text || '&contentId=' || cc.content_id::text,
  JSONB_BUILD_OBJECT(
    'courseName', COALESCE(c.course_name, ''),
    'contentType', COALESCE(cc.content_type::text, ''),
    'status', COALESCE(cc.status::text, '')
  ),
  TO_TSVECTOR('english',
    COALESCE(cc.title, '') || ' ' ||
    COALESCE(cc.description, '') || ' ' ||
    COALESCE(cc.excerpt, '') || ' ' ||
    COALESCE(c.course_name, '')
  ),
  cc.title
FROM course_contents cc
LEFT JOIN courses c ON c.course_id = cc.course_id

UNION ALL

-- Users
SELECT
  u.user_id::text,
  'users',
  u.full_name,
  COALESCE(u.email, '') || ' | ' || CASE WHEN u.is_active THEN 'Active' ELSE 'Inactive' END,
  '/users?viewId=' || u.user_id::text,
  JSONB_BUILD_OBJECT(
    'email', COALESCE(u.email, ''),
    'isActive', u.is_active::text
  ),
  TO_TSVECTOR('english',
    COALESCE(u.full_name, '') || ' ' ||
    COALESCE(u.email, '')
  ),
  u.full_name
FROM users u

UNION ALL

-- Learning Resources (ENHANCED: includes tags + category + subcategory)
SELECT
  lr.resource_id::text,
  'learning_resources',
  lr.title,
  COALESCE(lrc.name, '') || ' | ' || COALESCE(lr.content_type::text, '') || ' | ' || COALESCE(lr.visibility::text, '') || CASE WHEN tag_agg.tag_names IS NOT NULL THEN ' | Tags: ' || tag_agg.tag_names ELSE '' END,
  '/course-builder?tab=resources&resourceId=' || lr.resource_id::text,
  JSONB_BUILD_OBJECT(
    'categoryName', COALESCE(lrc.name, ''),
    'subcategoryName', COALESCE(lrsc.name, ''),
    'contentType', COALESCE(lr.content_type::text, ''),
    'status', COALESCE(lr.status::text, ''),
    'visibility', COALESCE(lr.visibility::text, ''),
    'tags', COALESCE(tag_agg.tag_names, '')
  ),
  TO_TSVECTOR('english',
    COALESCE(lr.title, '') || ' ' ||
    COALESCE(lr.description, '') || ' ' ||
    COALESCE(lrc.name, '') || ' ' ||
    COALESCE(lrsc.name, '') || ' ' ||
    COALESCE(tag_agg.tag_names, '')
  ),
  lr.title
FROM learning_resources lr
LEFT JOIN learning_resource_categories lrc ON lrc.category_id = lr.category_id
LEFT JOIN learning_resource_categories lrsc ON lrsc.category_id = lr.subcategory_id
LEFT JOIN LATERAL (
  SELECT STRING_AGG(lrt.name, ' ') AS tag_names
  FROM learning_resource_tag_map lrtm
  JOIN learning_resource_tags lrt ON lrt.tag_id = lrtm.tag_id
  WHERE lrtm.resource_id = lr.resource_id
) tag_agg ON TRUE
WHERE lr.deleted_at IS NULL

UNION ALL

-- Language Lab Words
SELECT
  w.word_id::text,
  'language_lab',
  w.word_text,
  COALESCE(w.english_meaning, '') || ' | Difficulty: ' || w.difficulty || ' | ' || CASE WHEN w.is_active THEN 'Active' ELSE 'Inactive' END,
  '/language-lab?word=' || w.word_id::text,
  JSONB_BUILD_OBJECT(
    'englishMeaning', COALESCE(w.english_meaning, ''),
    'difficulty', w.difficulty::text,
    'isActive', w.is_active::text
  ),
  TO_TSVECTOR('english',
    COALESCE(w.word_text, '') || ' ' ||
    COALESCE(w.english_meaning, '') || ' ' ||
    COALESCE(w.phonetic, '')
  ),
  w.word_text
FROM language_lab_words w

WITH NO DATA;

-- 3. Create indexes on the materialized view
CREATE UNIQUE INDEX idx_search_index_id_type ON search_index (id, entity_type);
CREATE INDEX idx_search_index_fts ON search_index USING GIN (search_vector);
CREATE INDEX idx_search_index_title_trgm ON search_index USING GIN (title gin_trgm_ops);
CREATE INDEX idx_search_index_entity_type ON search_index (entity_type);

-- 4. Populate the materialized view
REFRESH MATERIALIZED VIEW search_index;

-- 5. Helper function to refresh the materialized view concurrently
CREATE OR REPLACE FUNCTION refresh_search_index()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY search_index;
END;
$$;
