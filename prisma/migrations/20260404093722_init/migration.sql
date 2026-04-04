-- CreateEnum
CREATE TYPE "program_type" AS ENUM ('language', 'clinical', 'technical');

-- CreateEnum
CREATE TYPE "batch_status" AS ENUM ('draft', 'planned', 'in_session', 'completed', 'archived', 'cancelled');

-- CreateEnum
CREATE TYPE "enrollment_status" AS ENUM ('active', 'on_hold', 'completed', 'dropped');

-- CreateEnum
CREATE TYPE "attendance_status" AS ENUM ('present', 'absent', 'late', 'excused');

-- CreateEnum
CREATE TYPE "exam_type" AS ENUM ('IELTS', 'OET', 'NCLEX', 'GOETHE_A1', 'GOETHE_A2', 'GOETHE_B1', 'GOETHE_B2', 'PROMETRIC');

-- CreateEnum
CREATE TYPE "evaluation_status" AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled', 'rescheduled');

-- CreateEnum
CREATE TYPE "interview_type" AS ENUM ('internal_mock', 'client_final', 'technical_screening', 'language_check');

-- CreateEnum
CREATE TYPE "batch_mode" AS ENUM ('online', 'offline');

-- CreateEnum
CREATE TYPE "assessment_type" AS ENUM ('diagnostic', 'module', 'mock', 'final');

-- CreateEnum
CREATE TYPE "assessment_mode" AS ENUM ('online', 'paper_based', 'viva_voce');

-- CreateEnum
CREATE TYPE "schedule_event_type" AS ENUM ('class', 'test', 'quiz', 'contest');

-- CreateEnum
CREATE TYPE "certificate_status" AS ENUM ('issued', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "placement_status" AS ENUM ('not_ready', 'in_review', 'placement_ready');

-- CreateEnum
CREATE TYPE "sync_status" AS ENUM ('not_synced', 'queued', 'synced', 'failed');

-- CreateEnum
CREATE TYPE "email_log_status" AS ENUM ('pending', 'sent', 'failed', 'retrying');

-- CreateEnum
CREATE TYPE "email_log_category" AS ENUM ('candidate_welcome', 'two_factor', 'system');

-- CreateEnum
CREATE TYPE "audit_entity_type" AS ENUM ('batch', 'candidate', 'course', 'email', 'auth', 'system');

-- CreateEnum
CREATE TYPE "audit_action_type" AS ENUM ('created', 'updated', 'enrolled', 'mail_sent', 'mail_failed', 'mail_retried', 'login', 'two_factor', 'retry');

-- CreateEnum
CREATE TYPE "audit_log_level" AS ENUM ('info', 'warn', 'error');

-- CreateTable
CREATE TABLE "roles" (
    "role_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "is_system_role" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("role_id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "permission_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "module" VARCHAR(50) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("permission_id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "countries" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "iso_code" VARCHAR(5) NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "states" (
    "id" SERIAL NOT NULL,
    "country_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" SERIAL NOT NULL,
    "state_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currencies" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "symbol" VARCHAR(5),

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "user_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "password" VARCHAR(255) NOT NULL,
    "email_verified_at" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(6),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_security" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_secret" TEXT,
    "recovery_codes" TEXT[],
    "password_changed_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_security_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "two_factor_challenges" (
    "challenge_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "purpose" VARCHAR(50) NOT NULL,
    "code_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "sent_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_factor_challenges_pkey" PRIMARY KEY ("challenge_id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "reset_token_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "sent_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumed_at" TIMESTAMPTZ(6),
    "request_ip" VARCHAR(64),
    "user_agent" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("reset_token_id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "template_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "template_key" VARCHAR(120) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" VARCHAR(500),
    "subject" VARCHAR(255) NOT NULL,
    "html_content" TEXT NOT NULL,
    "text_content" TEXT,
    "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("template_id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "email_log_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category" "email_log_category" NOT NULL,
    "template_key" VARCHAR(120),
    "to_email" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "text_body" TEXT,
    "html_body" TEXT,
    "status" "email_log_status" NOT NULL DEFAULT 'pending',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMPTZ(6),
    "sent_at" TIMESTAMPTZ(6),
    "error_message" VARCHAR(1000),
    "provider_message_id" VARCHAR(255),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "triggered_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("email_log_id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "audit_log_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" "audit_entity_type" NOT NULL,
    "entity_id" VARCHAR(120),
    "action" "audit_action_type" NOT NULL,
    "level" "audit_log_level" NOT NULL DEFAULT 'info',
    "status" VARCHAR(50),
    "message" VARCHAR(1000) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "actor_user_id" UUID,
    "email_log_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("audit_log_id")
);

-- CreateTable
CREATE TABLE "trainers" (
    "trainer_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "specialization" VARCHAR(255) NOT NULL,
    "bio" TEXT,
    "rating_avg" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "joined_at" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "programs" TEXT[],

    CONSTRAINT "trainers_pkey" PRIMARY KEY ("trainer_id")
);

-- CreateTable
CREATE TABLE "courses" (
    "course_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "course_name" VARCHAR(255) NOT NULL,
    "course_desc" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("course_id")
);

-- CreateTable
CREATE TABLE "programs" (
    "program_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "course_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "program_name" VARCHAR(255) NOT NULL,
    "type" "program_type" NOT NULL,
    "category" VARCHAR(100),
    "description" TEXT,
    "duration_weeks" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("program_id")
);

-- CreateTable
CREATE TABLE "training_centres" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "centre_name" VARCHAR(255) NOT NULL,
    "location_id" INTEGER,
    "infrastructure" JSONB NOT NULL DEFAULT '{}',
    "total_capacity" INTEGER NOT NULL DEFAULT 0,
    "current_utilization" INTEGER NOT NULL DEFAULT 0,
    "compliance_status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_centres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "batch_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "batch_name" VARCHAR(100) NOT NULL,
    "program_id" UUID NOT NULL,
    "centre_id" UUID,
    "campus" VARCHAR(120),
    "trainer_id" UUID,
    "start_date" TIMESTAMPTZ(6) NOT NULL,
    "end_date" TIMESTAMPTZ(6),
    "mode" "batch_mode" NOT NULL DEFAULT 'offline',
    "status" "batch_status" NOT NULL DEFAULT 'planned',
    "capacity" INTEGER NOT NULL DEFAULT 25,
    "schedule" TEXT[],
    "schedule_time" TIME(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("batch_id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "candidate_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "candidate_code" VARCHAR(50) NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "country" VARCHAR(100),
    "profile_image_url" TEXT,
    "dob" DATE,
    "gender" VARCHAR(20),
    "nationality_id" INTEGER,
    "status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "target_country" VARCHAR(100),
    "target_language" VARCHAR(100),
    "target_exam" "exam_type",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "soft_skills_score" INTEGER NOT NULL DEFAULT 0,
    "readiness_percentage" INTEGER NOT NULL DEFAULT 0,
    "placement_status" "placement_status" NOT NULL DEFAULT 'not_ready',
    "recruiter_sync_status" "sync_status" NOT NULL DEFAULT 'not_synced',
    "latest_assessment_average" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "latest_attendance_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "is_ready_for_deployment" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("candidate_id")
);

-- CreateTable
CREATE TABLE "candidate_basic_details" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "candidate_id" UUID NOT NULL,
    "passport_no" VARCHAR(50),
    "education" JSONB,
    "experience" JSONB,
    "last_updated" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_basic_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "candidate_id" UUID NOT NULL,
    "document_type" VARCHAR(100),
    "file_path" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_batch_enrollments" (
    "enrollment_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "candidate_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "status" "enrollment_status" NOT NULL DEFAULT 'active',
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "candidate_batch_enrollments_pkey" PRIMARY KEY ("enrollment_id")
);

-- CreateTable
CREATE TABLE "attendance_tracker" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "enrollment_id" UUID NOT NULL,
    "session_date" DATE NOT NULL,
    "status" "attendance_status" NOT NULL,
    "remarks" TEXT,
    "marked_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_tracker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "assessment_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(255) NOT NULL,
    "type" "assessment_type" NOT NULL,
    "mode" "assessment_mode" NOT NULL DEFAULT 'online',
    "max_score" INTEGER NOT NULL DEFAULT 100,
    "program_id" UUID,
    "batch_id" UUID,
    "scheduled_at" TIMESTAMPTZ(6),
    "status" "evaluation_status" NOT NULL DEFAULT 'scheduled',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("assessment_id")
);

-- CreateTable
CREATE TABLE "batch_schedule_events" (
    "event_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "batch_id" UUID NOT NULL,
    "linked_assessment_id" UUID,
    "series_id" UUID,
    "occurrence_index" INTEGER NOT NULL DEFAULT 0,
    "event_title" VARCHAR(255) NOT NULL,
    "event_description" TEXT,
    "event_type" "schedule_event_type" NOT NULL,
    "class_mode" "batch_mode",
    "status" "evaluation_status" NOT NULL DEFAULT 'scheduled',
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6),
    "location" VARCHAR(255),
    "meeting_url" TEXT,
    "recurrence_rule" JSONB NOT NULL DEFAULT '{}',
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_schedule_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "assessment_scores" (
    "assessment_score_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assessment_id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "feedback" TEXT,
    "graded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_scores_pkey" PRIMARY KEY ("assessment_score_id")
);

-- CreateTable
CREATE TABLE "readiness_engine_rules" (
    "rule_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL DEFAULT 'default',
    "attendance_weight" INTEGER NOT NULL DEFAULT 30,
    "assessment_weight" INTEGER NOT NULL DEFAULT 50,
    "soft_skills_weight" INTEGER NOT NULL DEFAULT 20,
    "placement_threshold" INTEGER NOT NULL DEFAULT 80,
    "is_default" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "readiness_engine_rules_pkey" PRIMARY KEY ("rule_id")
);

-- CreateTable
CREATE TABLE "candidate_readiness_snapshots" (
    "snapshot_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "candidate_id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "percentage" INTEGER NOT NULL,
    "status" "placement_status" NOT NULL,
    "sync_status" "sync_status" NOT NULL DEFAULT 'not_synced',
    "synced_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_readiness_snapshots_pkey" PRIMARY KEY ("snapshot_id")
);

-- CreateTable
CREATE TABLE "candidate_certificates" (
    "certificate_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "candidate_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "status" "certificate_status" NOT NULL DEFAULT 'issued',
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verification_code" VARCHAR(100) NOT NULL,

    CONSTRAINT "candidate_certificates_pkey" PRIMARY KEY ("certificate_id")
);

-- CreateTable
CREATE TABLE "candidate_recruiter_sync_logs" (
    "sync_log_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "candidate_id" UUID NOT NULL,
    "triggered_by_user_id" UUID,
    "destination" VARCHAR(100) NOT NULL DEFAULT 'recruiter-workspace',
    "status" "sync_status" NOT NULL,
    "payload" JSONB NOT NULL,
    "response_body" JSONB,
    "message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_recruiter_sync_logs_pkey" PRIMARY KEY ("sync_log_id")
);

-- CreateTable
CREATE TABLE "performance_metrics" (
    "metric_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "game_score" DECIMAL(5,2),
    "attendance_percentage" DECIMAL(5,2),
    "reading_score" DECIMAL(5,2),
    "writing_score" DECIMAL(5,2),
    "listening_score" DECIMAL(5,2),
    "speaking_score" DECIMAL(5,2),
    "overall_band" DECIMAL(3,1),
    "trainer_feedback" TEXT,
    "last_updated" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_metrics_pkey" PRIMARY KEY ("metric_id")
);

-- CreateTable
CREATE TABLE "roleplays" (
    "roleplay_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "batch_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "trainer_id" UUID,
    "scenario_name" VARCHAR(255),
    "video_url" TEXT,
    "scores" JSONB,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roleplays_pkey" PRIMARY KEY ("roleplay_id")
);

-- CreateTable
CREATE TABLE "interviews" (
    "interview_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "interviewer_id" UUID,
    "type" "interview_type" NOT NULL DEFAULT 'internal_mock',
    "status" "evaluation_status" NOT NULL DEFAULT 'scheduled',
    "scheduled_at" TIMESTAMPTZ(6),
    "feedback_summary" TEXT,
    "is_passed" BOOLEAN NOT NULL DEFAULT false,
    "result_metadata" JSONB,

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("interview_id")
);

-- CreateTable
CREATE TABLE "trainer_pms_logs" (
    "log_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trainer_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "student_feedback_avg" DECIMAL(3,2),
    "completion_rate" DECIMAL(5,2),
    "pms_score_calculated" DECIMAL(5,2),
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trainer_pms_logs_pkey" PRIMARY KEY ("log_id")
);

-- CreateTable
CREATE TABLE "_BatchTrainers" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_BatchTrainers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "idx_permissions_module" ON "permissions"("module");

-- CreateIndex
CREATE INDEX "idx_role_permissions_permission" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE INDEX "idx_user_roles_role" ON "user_roles"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "countries_iso_code_key" ON "countries"("iso_code");

-- CreateIndex
CREATE UNIQUE INDEX "currencies_code_key" ON "currencies"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_security_user_id_key" ON "user_security"("user_id");

-- CreateIndex
CREATE INDEX "idx_two_factor_challenges_user_purpose" ON "two_factor_challenges"("user_id", "purpose", "created_at");

-- CreateIndex
CREATE INDEX "idx_two_factor_challenges_expires_at" ON "two_factor_challenges"("expires_at");

-- CreateIndex
CREATE INDEX "idx_password_reset_tokens_user_created" ON "password_reset_tokens"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_password_reset_tokens_expires_at" ON "password_reset_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "idx_password_reset_tokens_token_hash" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_template_key_key" ON "email_templates"("template_key");

-- CreateIndex
CREATE INDEX "idx_email_templates_active_updated" ON "email_templates"("is_active", "updated_at");

-- CreateIndex
CREATE INDEX "idx_email_logs_status_created" ON "email_logs"("status", "created_at");

-- CreateIndex
CREATE INDEX "idx_email_logs_category_created" ON "email_logs"("category", "created_at");

-- CreateIndex
CREATE INDEX "idx_email_logs_to_email" ON "email_logs"("to_email");

-- CreateIndex
CREATE INDEX "idx_email_logs_triggered_by" ON "email_logs"("triggered_by_user_id");

-- CreateIndex
CREATE INDEX "idx_audit_logs_entity_created" ON "audit_logs"("entity_type", "created_at");

-- CreateIndex
CREATE INDEX "idx_audit_logs_level_created" ON "audit_logs"("level", "created_at");

-- CreateIndex
CREATE INDEX "idx_audit_logs_actor" ON "audit_logs"("actor_user_id");

-- CreateIndex
CREATE INDEX "idx_audit_logs_email" ON "audit_logs"("email_log_id");

-- CreateIndex
CREATE UNIQUE INDEX "trainers_user_id_key" ON "trainers"("user_id");

-- CreateIndex
CREATE INDEX "idx_trainers_user" ON "trainers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "courses_code_key" ON "courses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "courses_course_name_key" ON "courses"("course_name");

-- CreateIndex
CREATE INDEX "idx_courses_active" ON "courses"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "programs_code_key" ON "programs"("code");

-- CreateIndex
CREATE UNIQUE INDEX "programs_slug_key" ON "programs"("slug");

-- CreateIndex
CREATE INDEX "idx_programs_course_active" ON "programs"("course_id", "is_active");

-- CreateIndex
CREATE INDEX "idx_programs_type" ON "programs"("type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "batches_code_key" ON "batches"("code");

-- CreateIndex
CREATE INDEX "idx_batches_program_status" ON "batches"("program_id", "status");

-- CreateIndex
CREATE INDEX "idx_batches_trainer" ON "batches"("trainer_id");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_user_id_key" ON "candidates"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_candidate_code_key" ON "candidates"("candidate_code");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_email_key" ON "candidates"("email");

-- CreateIndex
CREATE INDEX "idx_candidates_user" ON "candidates"("user_id");

-- CreateIndex
CREATE INDEX "idx_candidates_status" ON "candidates"("placement_status", "recruiter_sync_status");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_basic_details_candidate_id_key" ON "candidate_basic_details"("candidate_id");

-- CreateIndex
CREATE INDEX "idx_enrollments_batch_status" ON "candidate_batch_enrollments"("batch_id", "status");

-- CreateIndex
CREATE INDEX "idx_enrollments_candidate" ON "candidate_batch_enrollments"("candidate_id");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_batch_enrollments_candidate_id_batch_id_key" ON "candidate_batch_enrollments"("candidate_id", "batch_id");

-- CreateIndex
CREATE INDEX "idx_attendance_date_status" ON "attendance_tracker"("session_date", "status");

-- CreateIndex
CREATE INDEX "idx_attendance_marker" ON "attendance_tracker"("marked_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_tracker_enrollment_id_session_date_key" ON "attendance_tracker"("enrollment_id", "session_date");

-- CreateIndex
CREATE INDEX "idx_assessments_batch" ON "assessments"("batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "batch_schedule_events_linked_assessment_id_key" ON "batch_schedule_events"("linked_assessment_id");

-- CreateIndex
CREATE INDEX "idx_batch_schedule_events_batch_starts_at" ON "batch_schedule_events"("batch_id", "starts_at");

-- CreateIndex
CREATE INDEX "idx_batch_schedule_events_series_occurrence" ON "batch_schedule_events"("series_id", "occurrence_index");

-- CreateIndex
CREATE INDEX "idx_batch_schedule_events_type_status" ON "batch_schedule_events"("event_type", "status");

-- CreateIndex
CREATE INDEX "idx_assessment_scores_candidate" ON "assessment_scores"("candidate_id", "graded_at");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_scores_assessment_id_candidate_id_key" ON "assessment_scores"("assessment_id", "candidate_id");

-- CreateIndex
CREATE INDEX "idx_readiness_snapshot_status" ON "candidate_readiness_snapshots"("status", "sync_status");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_certificates_verification_code_key" ON "candidate_certificates"("verification_code");

-- CreateIndex
CREATE INDEX "idx_certificates_issued" ON "candidate_certificates"("issued_at", "status");

-- CreateIndex
CREATE INDEX "idx_sync_logs_status" ON "candidate_recruiter_sync_logs"("status", "created_at");

-- CreateIndex
CREATE INDEX "_BatchTrainers_B_index" ON "_BatchTrainers"("B");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("permission_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "states" ADD CONSTRAINT "states_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_security" ADD CONSTRAINT "user_security_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_factor_challenges" ADD CONSTRAINT "two_factor_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_triggered_by_user_id_fkey" FOREIGN KEY ("triggered_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_email_log_id_fkey" FOREIGN KEY ("email_log_id") REFERENCES "email_logs"("email_log_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainers" ADD CONSTRAINT "trainers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("course_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_centres" ADD CONSTRAINT "training_centres_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("trainer_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("program_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "training_centres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_nationality_id_fkey" FOREIGN KEY ("nationality_id") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_basic_details" ADD CONSTRAINT "candidate_basic_details_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("candidate_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_documents" ADD CONSTRAINT "candidate_documents_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("candidate_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_batch_enrollments" ADD CONSTRAINT "candidate_batch_enrollments_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("candidate_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_batch_enrollments" ADD CONSTRAINT "candidate_batch_enrollments_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_tracker" ADD CONSTRAINT "attendance_tracker_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "candidate_batch_enrollments"("enrollment_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_tracker" ADD CONSTRAINT "attendance_tracker_marked_by_user_id_fkey" FOREIGN KEY ("marked_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("program_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_schedule_events" ADD CONSTRAINT "batch_schedule_events_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_schedule_events" ADD CONSTRAINT "batch_schedule_events_linked_assessment_id_fkey" FOREIGN KEY ("linked_assessment_id") REFERENCES "assessments"("assessment_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_schedule_events" ADD CONSTRAINT "batch_schedule_events_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_scores" ADD CONSTRAINT "assessment_scores_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("assessment_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_scores" ADD CONSTRAINT "assessment_scores_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("candidate_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_readiness_snapshots" ADD CONSTRAINT "candidate_readiness_snapshots_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("candidate_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_readiness_snapshots" ADD CONSTRAINT "candidate_readiness_snapshots_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "readiness_engine_rules"("rule_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_certificates" ADD CONSTRAINT "candidate_certificates_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("candidate_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_certificates" ADD CONSTRAINT "candidate_certificates_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("program_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_recruiter_sync_logs" ADD CONSTRAINT "candidate_recruiter_sync_logs_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("candidate_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_recruiter_sync_logs" ADD CONSTRAINT "candidate_recruiter_sync_logs_triggered_by_user_id_fkey" FOREIGN KEY ("triggered_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_metrics" ADD CONSTRAINT "performance_metrics_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "candidates"("candidate_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_metrics" ADD CONSTRAINT "performance_metrics_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roleplays" ADD CONSTRAINT "roleplays_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roleplays" ADD CONSTRAINT "roleplays_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "candidates"("candidate_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roleplays" ADD CONSTRAINT "roleplays_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("trainer_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "candidates"("candidate_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_interviewer_id_fkey" FOREIGN KEY ("interviewer_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_pms_logs" ADD CONSTRAINT "trainer_pms_logs_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("trainer_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_pms_logs" ADD CONSTRAINT "trainer_pms_logs_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BatchTrainers" ADD CONSTRAINT "_BatchTrainers_A_fkey" FOREIGN KEY ("A") REFERENCES "batches"("batch_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BatchTrainers" ADD CONSTRAINT "_BatchTrainers_B_fkey" FOREIGN KEY ("B") REFERENCES "trainers"("trainer_id") ON DELETE CASCADE ON UPDATE CASCADE;
