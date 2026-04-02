CREATE SCHEMA "public";
CREATE TYPE "role" AS ENUM('admin', 'candidate', 'client', 'vendor', 'trainer');
CREATE TYPE "program_type" AS ENUM('language', 'clinical', 'technical');
CREATE TYPE "batch_status" AS ENUM('draft', 'planned', 'in_session', 'completed', 'archived', 'cancelled');
CREATE TYPE "enrollment_status" AS ENUM('active', 'on_hold', 'completed', 'dropped');
CREATE TYPE "attendance_status" AS ENUM('present', 'absent', 'late', 'excused');
CREATE TYPE "exam_type" AS ENUM('IELTS', 'OET', 'NCLEX', 'GOETHE_A1', 'GOETHE_A2', 'GOETHE_B1', 'GOETHE_B2', 'PROMETRIC');
CREATE TYPE "evaluation_status" AS ENUM('scheduled', 'in_progress', 'completed', 'cancelled', 'rescheduled');
CREATE TYPE "interview_type" AS ENUM('internal_mock', 'client_final', 'technical_screening', 'language_check');
CREATE TYPE "batch_mode" AS ENUM('online', 'offline');
CREATE TYPE "assessment_type" AS ENUM('diagnostic', 'module', 'mock', 'final');
CREATE TYPE "assessment_mode" AS ENUM('online', 'paper_based', 'viva_voce');
CREATE TYPE "certificate_status" AS ENUM('issued', 'revoked', 'expired');
CREATE TYPE "placement_status" AS ENUM('not_ready', 'in_review', 'placement_ready');
CREATE TYPE "sync_status" AS ENUM('not_synced', 'queued', 'synced', 'failed');
CREATE TABLE "_BatchTrainers" (
	"A" uuid,
	"B" uuid,
	CONSTRAINT "_BatchTrainers_AB_pkey" PRIMARY KEY("A","B")
);
CREATE TABLE "assessment_scores" (
	"assessment_score_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"assessment_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"feedback" text,
	"graded_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE "assessments" (
	"assessment_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"title" varchar(255) NOT NULL,
	"type" assessment_type NOT NULL,
	"mode" assessment_mode DEFAULT 'online' NOT NULL,
	"max_score" integer DEFAULT 100 NOT NULL,
	"program_id" uuid,
	"batch_id" uuid,
	"scheduled_at" timestamp with time zone,
	"status" evaluation_status DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE "attendance_tracker" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"enrollment_id" uuid NOT NULL,
	"session_date" date NOT NULL,
	"status" attendance_status NOT NULL,
	"remarks" text,
	"marked_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE "batches" (
	"batch_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" varchar(50) NOT NULL,
	"batch_name" varchar(100) NOT NULL,
	"program_id" uuid NOT NULL,
	"centre_id" uuid,
	"campus" varchar(120),
	"trainer_id" uuid,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"mode" batch_mode DEFAULT 'offline' NOT NULL,
	"status" batch_status DEFAULT 'planned' NOT NULL,
	"capacity" integer DEFAULT 25 NOT NULL,
	"schedule" text[],
	"schedule_time" time,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE "candidate_basic_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"candidate_id" uuid NOT NULL,
	"passport_no" varchar(50),
	"education" jsonb,
	"experience" jsonb,
	"last_updated" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE "candidate_batch_enrollments" (
	"enrollment_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"candidate_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"status" enrollment_status DEFAULT 'active' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"completed_at" timestamp with time zone
);
CREATE TABLE "candidate_certificates" (
	"certificate_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"candidate_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"status" certificate_status DEFAULT 'issued' NOT NULL,
	"issued_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"verification_code" varchar(100) NOT NULL
);
CREATE TABLE "candidate_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"candidate_id" uuid NOT NULL,
	"document_type" varchar(100),
	"file_path" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE "candidate_readiness_snapshots" (
	"snapshot_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"candidate_id" uuid NOT NULL,
	"rule_id" uuid NOT NULL,
	"percentage" integer NOT NULL,
	"status" placement_status NOT NULL,
	"sync_status" sync_status DEFAULT 'not_synced' NOT NULL,
	"synced_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE "candidate_recruiter_sync_logs" (
	"sync_log_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"candidate_id" uuid NOT NULL,
	"triggered_by_user_id" uuid,
	"destination" varchar(100) DEFAULT 'recruiter-workspace' NOT NULL,
	"status" sync_status NOT NULL,
	"payload" jsonb NOT NULL,
	"response_body" jsonb,
	"message" text,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE "candidates" (
	"candidate_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid,
	"candidate_code" varchar(50) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(20),
	"country" varchar(100),
	"profile_image_url" text,
	"dob" date,
	"gender" varchar(20),
	"nationality_id" integer,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"target_country" varchar(100),
	"target_language" varchar(100),
	"target_exam" exam_type,
	"is_active" boolean DEFAULT true NOT NULL,
	"soft_skills_score" integer DEFAULT 0 NOT NULL,
	"readiness_percentage" integer DEFAULT 0 NOT NULL,
	"placement_status" placement_status DEFAULT 'not_ready' NOT NULL,
	"recruiter_sync_status" sync_status DEFAULT 'not_synced' NOT NULL,
	"latest_assessment_average" numeric(5, 2) DEFAULT '0' NOT NULL,
	"latest_attendance_percentage" numeric(5, 2) DEFAULT '0' NOT NULL,
	"is_ready_for_deployment" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE "cities" (
	"id" serial PRIMARY KEY,
	"state_id" integer NOT NULL,
	"name" varchar(100) NOT NULL
);
CREATE TABLE "countries" (
	"id" serial PRIMARY KEY,
	"name" varchar(100) NOT NULL,
	"iso_code" varchar(5) NOT NULL
);
CREATE TABLE "courses" (
	"course_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"course_name" varchar(255) NOT NULL CONSTRAINT "courses_course_name_key" UNIQUE,
	"course_desc" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"code" varchar(50) NOT NULL
);
CREATE TABLE "currencies" (
	"id" serial PRIMARY KEY,
	"code" varchar(10) NOT NULL,
	"symbol" varchar(5)
);
CREATE TABLE "interviews" (
	"interview_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"student_id" uuid NOT NULL,
	"interviewer_id" uuid,
	"type" interview_type DEFAULT 'internal_mock' NOT NULL,
	"status" evaluation_status DEFAULT 'scheduled' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"feedback_summary" text,
	"is_passed" boolean DEFAULT false NOT NULL,
	"result_metadata" jsonb
);
CREATE TABLE "performance_metrics" (
	"metric_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"student_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"game_score" numeric(5, 2),
	"attendance_percentage" numeric(5, 2),
	"reading_score" numeric(5, 2),
	"writing_score" numeric(5, 2),
	"listening_score" numeric(5, 2),
	"speaking_score" numeric(5, 2),
	"overall_band" numeric(3, 1),
	"trainer_feedback" text,
	"last_updated" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE "programs" (
	"program_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"slug" varchar(120) NOT NULL,
	"program_name" varchar(255) NOT NULL,
	"type" program_type NOT NULL,
	"category" varchar(100),
	"description" text,
	"duration_weeks" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"course_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL
);
CREATE TABLE "readiness_engine_rules" (
	"rule_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(100) DEFAULT 'default' NOT NULL,
	"attendance_weight" integer DEFAULT 30 NOT NULL,
	"assessment_weight" integer DEFAULT 50 NOT NULL,
	"soft_skills_weight" integer DEFAULT 20 NOT NULL,
	"placement_threshold" integer DEFAULT 80 NOT NULL,
	"is_default" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE "roleplays" (
	"roleplay_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"batch_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"trainer_id" uuid,
	"scenario_name" varchar(255),
	"video_url" text,
	"scores" jsonb,
	"occurred_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE "states" (
	"id" serial PRIMARY KEY,
	"country_id" integer NOT NULL,
	"name" varchar(100) NOT NULL
);
CREATE TABLE "trainer_pms_logs" (
	"log_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"trainer_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"student_feedback_avg" numeric(3, 2),
	"completion_rate" numeric(5, 2),
	"pms_score_calculated" numeric(5, 2),
	"recorded_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE "trainers" (
	"trainer_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"specialization" varchar(255) NOT NULL,
	"bio" text,
	"rating_avg" numeric(3, 2) DEFAULT '0' NOT NULL,
	"capacity" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"joined_at" date DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"programs" text[]
);
CREATE TABLE "training_centres" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"centre_name" varchar(255) NOT NULL,
	"location_id" integer,
	"infrastructure" jsonb DEFAULT '{}' NOT NULL,
	"total_capacity" integer DEFAULT 0 NOT NULL,
	"current_utilization" integer DEFAULT 0 NOT NULL,
	"compliance_status" varchar(50) DEFAULT 'pending' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE "user_security" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"two_factor_secret" text,
	"recovery_codes" text[],
	"password_changed_at" timestamp with time zone
);
CREATE TABLE "users" (
	"user_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"email" varchar(255) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"phone" varchar(20),
	"password" varchar(255) NOT NULL,
	"role" role NOT NULL,
	"email_verified_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX "_BatchTrainers_AB_pkey" ON "_BatchTrainers" ("A","B");
CREATE INDEX "_BatchTrainers_B_index" ON "_BatchTrainers" ("B");
CREATE UNIQUE INDEX "assessment_scores_assessment_id_candidate_id_key" ON "assessment_scores" ("assessment_id","candidate_id");
CREATE UNIQUE INDEX "assessment_scores_pkey" ON "assessment_scores" ("assessment_score_id");
CREATE INDEX "idx_assessment_scores_candidate" ON "assessment_scores" ("candidate_id","graded_at");
CREATE UNIQUE INDEX "assessments_pkey" ON "assessments" ("assessment_id");
CREATE INDEX "idx_assessments_batch" ON "assessments" ("batch_id");
CREATE UNIQUE INDEX "attendance_tracker_enrollment_id_session_date_key" ON "attendance_tracker" ("enrollment_id","session_date");
CREATE UNIQUE INDEX "attendance_tracker_pkey" ON "attendance_tracker" ("id");
CREATE INDEX "idx_attendance_date_status" ON "attendance_tracker" ("session_date","status");
CREATE INDEX "idx_attendance_marker" ON "attendance_tracker" ("marked_by_user_id");
CREATE UNIQUE INDEX "batches_code_key" ON "batches" ("code");
CREATE UNIQUE INDEX "batches_pkey" ON "batches" ("batch_id");
CREATE INDEX "idx_batches_program_status" ON "batches" ("program_id","status");
CREATE INDEX "idx_batches_trainer" ON "batches" ("trainer_id");
CREATE UNIQUE INDEX "candidate_basic_details_candidate_id_key" ON "candidate_basic_details" ("candidate_id");
CREATE UNIQUE INDEX "candidate_basic_details_pkey" ON "candidate_basic_details" ("id");
CREATE UNIQUE INDEX "candidate_batch_enrollments_candidate_id_batch_id_key" ON "candidate_batch_enrollments" ("candidate_id","batch_id");
CREATE UNIQUE INDEX "candidate_batch_enrollments_pkey" ON "candidate_batch_enrollments" ("enrollment_id");
CREATE INDEX "idx_enrollments_batch_status" ON "candidate_batch_enrollments" ("batch_id","status");
CREATE INDEX "idx_enrollments_candidate" ON "candidate_batch_enrollments" ("candidate_id");
CREATE UNIQUE INDEX "candidate_certificates_pkey" ON "candidate_certificates" ("certificate_id");
CREATE UNIQUE INDEX "candidate_certificates_verification_code_key" ON "candidate_certificates" ("verification_code");
CREATE INDEX "idx_certificates_issued" ON "candidate_certificates" ("issued_at","status");
CREATE UNIQUE INDEX "candidate_documents_pkey" ON "candidate_documents" ("id");
CREATE UNIQUE INDEX "candidate_readiness_snapshots_pkey" ON "candidate_readiness_snapshots" ("snapshot_id");
CREATE INDEX "idx_readiness_snapshot_status" ON "candidate_readiness_snapshots" ("status","sync_status");
CREATE UNIQUE INDEX "candidate_recruiter_sync_logs_pkey" ON "candidate_recruiter_sync_logs" ("sync_log_id");
CREATE INDEX "idx_sync_logs_status" ON "candidate_recruiter_sync_logs" ("status","created_at");
CREATE UNIQUE INDEX "candidates_candidate_code_key" ON "candidates" ("candidate_code");
CREATE UNIQUE INDEX "candidates_email_key" ON "candidates" ("email");
CREATE UNIQUE INDEX "candidates_pkey" ON "candidates" ("candidate_id");
CREATE UNIQUE INDEX "candidates_user_id_key" ON "candidates" ("user_id");
CREATE INDEX "idx_candidates_status" ON "candidates" ("placement_status","recruiter_sync_status");
CREATE INDEX "idx_candidates_user" ON "candidates" ("user_id");
CREATE UNIQUE INDEX "cities_pkey" ON "cities" ("id");
CREATE UNIQUE INDEX "countries_iso_code_key" ON "countries" ("iso_code");
CREATE UNIQUE INDEX "countries_pkey" ON "countries" ("id");
CREATE UNIQUE INDEX "courses_code_key" ON "courses" ("code");
CREATE UNIQUE INDEX "courses_course_name_key" ON "courses" ("course_name");
CREATE UNIQUE INDEX "courses_pkey" ON "courses" ("course_id");
CREATE INDEX "idx_courses_active" ON "courses" ("is_active");
CREATE UNIQUE INDEX "currencies_code_key" ON "currencies" ("code");
CREATE UNIQUE INDEX "currencies_pkey" ON "currencies" ("id");
CREATE UNIQUE INDEX "interviews_pkey" ON "interviews" ("interview_id");
CREATE UNIQUE INDEX "performance_metrics_pkey" ON "performance_metrics" ("metric_id");
CREATE INDEX "idx_programs_course_active" ON "programs" ("course_id","is_active");
CREATE INDEX "idx_programs_type" ON "programs" ("type","is_active");
CREATE UNIQUE INDEX "programs_code_key" ON "programs" ("code");
CREATE UNIQUE INDEX "programs_pkey" ON "programs" ("program_id");
CREATE UNIQUE INDEX "programs_slug_key" ON "programs" ("slug");
CREATE UNIQUE INDEX "readiness_engine_rules_pkey" ON "readiness_engine_rules" ("rule_id");
CREATE UNIQUE INDEX "roleplays_pkey" ON "roleplays" ("roleplay_id");
CREATE UNIQUE INDEX "states_pkey" ON "states" ("id");
CREATE UNIQUE INDEX "trainer_pms_logs_pkey" ON "trainer_pms_logs" ("log_id");
CREATE INDEX "idx_trainers_user" ON "trainers" ("user_id");
CREATE UNIQUE INDEX "trainers_pkey" ON "trainers" ("trainer_id");
CREATE UNIQUE INDEX "trainers_user_id_key" ON "trainers" ("user_id");
CREATE UNIQUE INDEX "training_centres_pkey" ON "training_centres" ("id");
CREATE UNIQUE INDEX "user_security_pkey" ON "user_security" ("id");
CREATE UNIQUE INDEX "user_security_user_id_key" ON "user_security" ("user_id");
CREATE UNIQUE INDEX "users_email_key" ON "users" ("email");
CREATE UNIQUE INDEX "users_pkey" ON "users" ("user_id");
ALTER TABLE "_BatchTrainers" ADD CONSTRAINT "_BatchTrainers_A_fkey" FOREIGN KEY ("A") REFERENCES "batches"("batch_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_BatchTrainers" ADD CONSTRAINT "_BatchTrainers_B_fkey" FOREIGN KEY ("B") REFERENCES "trainers"("trainer_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assessment_scores" ADD CONSTRAINT "assessment_scores_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("assessment_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assessment_scores" ADD CONSTRAINT "assessment_scores_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("candidate_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("program_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "attendance_tracker" ADD CONSTRAINT "attendance_tracker_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "candidate_batch_enrollments"("enrollment_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_tracker" ADD CONSTRAINT "attendance_tracker_marked_by_user_id_fkey" FOREIGN KEY ("marked_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "batches" ADD CONSTRAINT "batches_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "training_centres"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "batches" ADD CONSTRAINT "batches_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("program_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "batches" ADD CONSTRAINT "batches_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("trainer_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "candidate_basic_details" ADD CONSTRAINT "candidate_basic_details_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("candidate_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_batch_enrollments" ADD CONSTRAINT "candidate_batch_enrollments_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_batch_enrollments" ADD CONSTRAINT "candidate_batch_enrollments_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("candidate_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_certificates" ADD CONSTRAINT "candidate_certificates_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("candidate_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_certificates" ADD CONSTRAINT "candidate_certificates_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("program_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "candidate_documents" ADD CONSTRAINT "candidate_documents_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("candidate_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_readiness_snapshots" ADD CONSTRAINT "candidate_readiness_snapshots_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("candidate_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_readiness_snapshots" ADD CONSTRAINT "candidate_readiness_snapshots_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "readiness_engine_rules"("rule_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "candidate_recruiter_sync_logs" ADD CONSTRAINT "candidate_recruiter_sync_logs_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("candidate_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_recruiter_sync_logs" ADD CONSTRAINT "candidate_recruiter_sync_logs_triggered_by_user_id_fkey" FOREIGN KEY ("triggered_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_nationality_id_fkey" FOREIGN KEY ("nationality_id") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cities" ADD CONSTRAINT "cities_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "states"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_interviewer_id_fkey" FOREIGN KEY ("interviewer_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "candidates"("candidate_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "performance_metrics" ADD CONSTRAINT "performance_metrics_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "performance_metrics" ADD CONSTRAINT "performance_metrics_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "candidates"("candidate_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "programs" ADD CONSTRAINT "programs_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("course_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "roleplays" ADD CONSTRAINT "roleplays_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "roleplays" ADD CONSTRAINT "roleplays_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "candidates"("candidate_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "roleplays" ADD CONSTRAINT "roleplays_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("trainer_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "states" ADD CONSTRAINT "states_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trainer_pms_logs" ADD CONSTRAINT "trainer_pms_logs_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trainer_pms_logs" ADD CONSTRAINT "trainer_pms_logs_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("trainer_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trainers" ADD CONSTRAINT "trainers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_centres" ADD CONSTRAINT "training_centres_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_security" ADD CONSTRAINT "user_security_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;