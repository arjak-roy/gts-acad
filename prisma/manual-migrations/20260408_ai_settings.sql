-- Add AI Features settings category and seed its settings.
-- Safe to rerun: uses ON CONFLICT DO NOTHING.

INSERT INTO settings_categories (category_id, name, code, description, icon, display_order, is_system, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'AI Features',
  'ai-features',
  'Configure AI-powered capabilities such as automatic assessment generation, question authoring, and content suggestions.',
  'Sparkles',
  75,
  true,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (code) DO NOTHING;

-- Seed settings definitions for the ai-features category.
INSERT INTO settings (setting_id, category_id, setting_key, label, description, type, value, default_value, is_encrypted, is_readonly, is_required, is_system, is_active, options, validation_rules, group_name, display_order, created_at, updated_at)
SELECT
  gen_random_uuid(),
  sc.category_id,
  v.key,
  v.label,
  v.description,
  v.type::setting_type,
  v.default_value::jsonb,
  v.default_value::jsonb,
  v.is_encrypted,
  false,
  v.is_required,
  true,
  true,
  v.options,
  v.validation_rules,
  v.group_name,
  v.display_order,
  NOW(),
  NOW()
FROM settings_categories sc
CROSS JOIN (
  VALUES
    ('ai.enable_ai_features', 'Enable AI Features', 'Master toggle for all AI-powered capabilities across the application.', 'toggle', 'false', false, true, NULL::jsonb, NULL::jsonb, 'General', 10),
    ('ai.provider', 'AI Provider', 'Select which AI provider to use for question generation. Gemini offers a generous free tier.', 'select', '"gemini"', false, true, '[{"label":"Google Gemini (Free tier available)","value":"gemini"},{"label":"OpenAI","value":"openai"}]'::jsonb, NULL::jsonb, 'General', 15),
    ('ai.gemini_api_key', 'Gemini API Key', 'API key for Google Gemini. Get one free at aistudio.google.com. Stored encrypted.', 'password', '""', true, false, NULL::jsonb, NULL::jsonb, 'Gemini Configuration', 16),
    ('ai.openai_api_key', 'OpenAI API Key', 'API key used to authenticate requests to the OpenAI platform. Stored encrypted.', 'password', '""', true, false, NULL::jsonb, NULL::jsonb, 'OpenAI Configuration', 20),
    ('ai.default_model', 'Default Model', 'Model used for AI generation. Pick a model matching your selected provider.', 'select', '"gemini-2.0-flash"', false, true, '[{"label":"Gemini 3.5 Flash Lite (Lightweight, free tier)","value":"gemini-3.1-flash-lite-preview"},{"label":"Gemini 2.0 Flash (Fast, free tier)","value":"gemini-2.0-flash"},{"label":"Gemini 1.5 Pro (High quality)","value":"gemini-1.5-pro"},{"label":"Gemini 1.5 Flash (Balanced)","value":"gemini-1.5-flash"},{"label":"GPT-4o (Best quality)","value":"gpt-4o"},{"label":"GPT-4o Mini (Balanced)","value":"gpt-4o-mini"}]'::jsonb, NULL::jsonb, 'Model', 30),
    ('ai.max_questions_per_request', 'Max Questions per Request', 'Maximum number of questions the AI can generate in a single request.', 'number', '10', false, true, NULL::jsonb, '{"min":1,"max":50}'::jsonb, 'Limits', 40)
) AS v(key, label, description, type, default_value, is_encrypted, is_required, options, validation_rules, group_name, display_order)
WHERE sc.code = 'ai-features'
ON CONFLICT (setting_key) DO NOTHING;

-- Add ai.generate permission if not already present.
INSERT INTO permissions (permission_id, module, action, key, description)
VALUES (
  gen_random_uuid(),
  'ai',
  'generate',
  'ai.generate',
  'Generate content using AI features'
)
ON CONFLICT (key) DO NOTHING;
