-- AlterEnum
BEGIN;
CREATE TYPE "curriculum_item_release_type_new" AS ENUM ('immediate', 'absolute_date', 'batch_relative', 'previous_item_completion', 'previous_item_score', 'manual');
ALTER TABLE "public"."curriculum_stage_item_releases" ALTER COLUMN "release_type" DROP DEFAULT;
ALTER TABLE "curriculum_stage_item_releases" ALTER COLUMN "release_type" TYPE "curriculum_item_release_type_new" USING ("release_type"::text::"curriculum_item_release_type_new");
ALTER TYPE "curriculum_item_release_type" RENAME TO "curriculum_item_release_type_old";
ALTER TYPE "curriculum_item_release_type_new" RENAME TO "curriculum_item_release_type";
DROP TYPE "public"."curriculum_item_release_type_old";
ALTER TABLE "curriculum_stage_item_releases" ALTER COLUMN "release_type" SET DEFAULT 'immediate';
COMMIT;

-- DropForeignKey
ALTER TABLE "batch_schedule_events" DROP CONSTRAINT "fk_batch_schedule_events_assessment_pool";

-- DropForeignKey
ALTER TABLE "candidate_certificates" DROP CONSTRAINT "candidate_certificates_batch_id_fkey";

-- DropForeignKey
ALTER TABLE "candidate_certificates" DROP CONSTRAINT "candidate_certificates_course_id_fkey";

-- DropForeignKey
ALTER TABLE "candidate_certificates" DROP CONSTRAINT "candidate_certificates_issued_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "candidate_certificates" DROP CONSTRAINT "candidate_certificates_revoked_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "candidate_certificates" DROP CONSTRAINT "candidate_certificates_template_id_fkey";

-- DropForeignKey
ALTER TABLE "certificate_auto_issue_attempts" DROP CONSTRAINT "fk_cert_auto_issue_attempts_batch";

-- DropForeignKey
ALTER TABLE "certificate_auto_issue_attempts" DROP CONSTRAINT "fk_cert_auto_issue_attempts_candidate";

-- DropForeignKey
ALTER TABLE "certificate_auto_issue_attempts" DROP CONSTRAINT "fk_cert_auto_issue_attempts_certificate";

-- DropForeignKey
ALTER TABLE "certificate_auto_issue_attempts" DROP CONSTRAINT "fk_cert_auto_issue_attempts_curriculum";

-- DropForeignKey
ALTER TABLE "certificate_auto_issue_attempts" DROP CONSTRAINT "fk_cert_auto_issue_attempts_retry_parent";

-- DropForeignKey
ALTER TABLE "certificate_auto_issue_attempts" DROP CONSTRAINT "fk_cert_auto_issue_attempts_rule";

-- DropForeignKey
ALTER TABLE "certificate_auto_issue_attempts" DROP CONSTRAINT "fk_cert_auto_issue_attempts_template";

-- DropForeignKey
ALTER TABLE "certificate_auto_issue_rules" DROP CONSTRAINT "certificate_auto_issue_rules_curriculum_id_fkey";

-- DropForeignKey
ALTER TABLE "certificate_auto_issue_rules" DROP CONSTRAINT "certificate_auto_issue_rules_template_id_fkey";

-- DropForeignKey
ALTER TABLE "certificate_templates" DROP CONSTRAINT "certificate_templates_course_id_fkey";

-- DropForeignKey
ALTER TABLE "certificate_templates" DROP CONSTRAINT "certificate_templates_created_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "curricula" DROP CONSTRAINT "curricula_source_curriculum_id_fkey";

-- DropForeignKey
ALTER TABLE "curriculum_modules" DROP CONSTRAINT "curriculum_modules_prerequisite_module_id_fkey";

-- DropForeignKey
ALTER TABLE "curriculum_stages" DROP CONSTRAINT "curriculum_stages_prerequisite_stage_id_fkey";

-- DropForeignKey
ALTER TABLE "learning_resources" DROP CONSTRAINT "learning_resources_deleted_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "session_history" DROP CONSTRAINT "session_history_actor_user_id_fkey";

-- DropForeignKey
ALTER TABLE "session_history" DROP CONSTRAINT "session_history_schedule_event_id_fkey";

-- DropForeignKey
ALTER TABLE "trainer_session_assignments" DROP CONSTRAINT "trainer_session_assignments_assigned_by_id_fkey";

-- DropForeignKey
ALTER TABLE "trainer_session_assignments" DROP CONSTRAINT "trainer_session_assignments_removed_by_id_fkey";

-- DropForeignKey
ALTER TABLE "trainer_session_assignments" DROP CONSTRAINT "trainer_session_assignments_schedule_event_id_fkey";

-- DropForeignKey
ALTER TABLE "trainer_session_assignments" DROP CONSTRAINT "trainer_session_assignments_trainer_id_fkey";

-- DropForeignKey
ALTER TABLE "trainer_status_history" DROP CONSTRAINT "trainer_status_history_changed_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "trainer_status_history" DROP CONSTRAINT "trainer_status_history_trainer_id_fkey";

-- DropForeignKey
ALTER TABLE "trainers" DROP CONSTRAINT "trainers_updated_by_user_id_fkey";

-- DropIndex
DROP INDEX "idx_assessment_attempts_status_deadline";

-- DropConstraint
ALTER TABLE "assessment_attempts" DROP CONSTRAINT IF EXISTS "uq_assessment_attempts_assessment_candidate";

-- DropIndex
DROP INDEX "idx_cert_auto_issue_attempts_batch_attempted";

-- DropIndex
DROP INDEX "idx_cert_auto_issue_attempts_learner_attempted";

-- DropIndex
DROP INDEX "idx_cert_auto_issue_attempts_rule_attempted";

-- DropIndex
DROP INDEX "idx_cert_auto_issue_attempts_status_attempted";

-- AlterTable
ALTER TABLE "learning_resources" ADD COLUMN     "folder_id" UUID;

-- CreateTable
CREATE TABLE "learning_resource_folders" (
    "folder_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "parent_folder_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_resource_folders_pkey" PRIMARY KEY ("folder_id")
);

-- CreateIndex
CREATE INDEX "idx_learning_resource_folders_parent_order" ON "learning_resource_folders"("parent_folder_id", "sort_order");

-- CreateIndex
CREATE INDEX "idx_cert_auto_issue_attempts_status_attempted" ON "certificate_auto_issue_attempts"("status", "attempted_at");

-- CreateIndex
CREATE INDEX "idx_cert_auto_issue_attempts_learner_attempted" ON "certificate_auto_issue_attempts"("candidate_id", "attempted_at");

-- CreateIndex
CREATE INDEX "idx_cert_auto_issue_attempts_batch_attempted" ON "certificate_auto_issue_attempts"("batch_id", "attempted_at");

-- CreateIndex
CREATE INDEX "idx_cert_auto_issue_attempts_rule_attempted" ON "certificate_auto_issue_attempts"("rule_id", "attempted_at");

-- CreateIndex
CREATE INDEX "idx_cert_templates_course_active" ON "certificate_templates"("course_id", "is_active");

-- CreateIndex
CREATE INDEX "idx_cert_templates_course_default" ON "certificate_templates"("course_id", "is_default");

-- CreateIndex
CREATE UNIQUE INDEX "learning_resources_source_content_id_key" ON "learning_resources"("source_content_id");

-- CreateIndex
CREATE INDEX "idx_learning_resources_folder_updated" ON "learning_resources"("folder_id", "updated_at");

-- CreateIndex
CREATE INDEX "idx_pronunciation_attempts_batch_created" ON "pronunciation_attempts"("batch_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_pronunciation_attempts_candidate_created" ON "pronunciation_attempts"("candidate_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_pronunciation_attempts_word_created" ON "pronunciation_attempts"("word_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_push_dispatch_target_created" ON "push_dispatches"("target_type", "target_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_push_dispatch_created" ON "push_dispatches"("created_at");

-- CreateIndex
CREATE INDEX "idx_roleplays_batch_occurred" ON "roleplays"("batch_id", "occurred_at");

-- CreateIndex
CREATE INDEX "idx_roleplays_candidate_occurred" ON "roleplays"("student_id", "occurred_at");

-- CreateIndex
CREATE INDEX "idx_session_history_actor" ON "session_history"("actor_user_id");

-- CreateIndex
CREATE INDEX "idx_trainer_session_assignments_trainer" ON "trainer_session_assignments"("trainer_id");

-- CreateIndex
CREATE INDEX "idx_trainer_session_assignments_event" ON "trainer_session_assignments"("schedule_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_trainer_session_active" ON "trainer_session_assignments"("schedule_event_id", "trainer_id");

-- AddForeignKey
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "email_template_categories"("category_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_template_versions" ADD CONSTRAINT "email_template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "email_templates"("template_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_template_versions" ADD CONSTRAINT "email_template_versions_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_push_devices" ADD CONSTRAINT "user_push_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_dispatches" ADD CONSTRAINT "push_dispatches_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_notifications" ADD CONSTRAINT "candidate_notifications_push_dispatch_id_fkey" FOREIGN KEY ("push_dispatch_id") REFERENCES "push_dispatches"("push_dispatch_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_notifications" ADD CONSTRAINT "candidate_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_notification_deliveries" ADD CONSTRAINT "candidate_notification_deliveries_push_dispatch_id_fkey" FOREIGN KEY ("push_dispatch_id") REFERENCES "push_dispatches"("push_dispatch_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_notification_deliveries" ADD CONSTRAINT "candidate_notification_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "candidate_notifications"("notification_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_notification_deliveries" ADD CONSTRAINT "candidate_notification_deliveries_push_device_id_fkey" FOREIGN KEY ("push_device_id") REFERENCES "user_push_devices"("push_device_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainers" ADD CONSTRAINT "trainers_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_status_history" ADD CONSTRAINT "trainer_status_history_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("trainer_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_status_history" ADD CONSTRAINT "trainer_status_history_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_course_assignments" ADD CONSTRAINT "trainer_course_assignments_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("trainer_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_course_assignments" ADD CONSTRAINT "trainer_course_assignments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("course_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buddy_persona_course_assignments" ADD CONSTRAINT "buddy_persona_course_assignments_buddy_persona_id_fkey" FOREIGN KEY ("buddy_persona_id") REFERENCES "buddy_personas"("buddy_persona_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buddy_persona_course_assignments" ADD CONSTRAINT "buddy_persona_course_assignments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("course_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buddy_prompt_versions" ADD CONSTRAINT "buddy_prompt_versions_buddy_persona_id_fkey" FOREIGN KEY ("buddy_persona_id") REFERENCES "buddy_personas"("buddy_persona_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buddy_prompt_versions" ADD CONSTRAINT "buddy_prompt_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_linked_schedule_event_id_fkey" FOREIGN KEY ("linked_schedule_event_id") REFERENCES "batch_schedule_events"("event_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_tracker" ADD CONSTRAINT "attendance_tracker_attendance_session_id_fkey" FOREIGN KEY ("attendance_session_id") REFERENCES "attendance_sessions"("attendance_session_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_schedule_events" ADD CONSTRAINT "batch_schedule_events_linked_assessment_pool_id_fkey" FOREIGN KEY ("linked_assessment_pool_id") REFERENCES "assessment_pools"("assessment_pool_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("assessment_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_assessment_pool_id_fkey" FOREIGN KEY ("assessment_pool_id") REFERENCES "assessment_pools"("assessment_pool_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("candidate_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_certificates" ADD CONSTRAINT "candidate_certificates_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("course_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_certificates" ADD CONSTRAINT "candidate_certificates_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_certificates" ADD CONSTRAINT "candidate_certificates_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "certificate_templates"("template_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_certificates" ADD CONSTRAINT "candidate_certificates_issued_by_user_id_fkey" FOREIGN KEY ("issued_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_certificates" ADD CONSTRAINT "candidate_certificates_revoked_by_user_id_fkey" FOREIGN KEY ("revoked_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_templates" ADD CONSTRAINT "certificate_templates_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("course_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_templates" ADD CONSTRAINT "certificate_templates_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_auto_issue_rules" ADD CONSTRAINT "certificate_auto_issue_rules_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "certificate_templates"("template_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_auto_issue_rules" ADD CONSTRAINT "certificate_auto_issue_rules_curriculum_id_fkey" FOREIGN KEY ("curriculum_id") REFERENCES "curricula"("curriculum_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_auto_issue_attempts" ADD CONSTRAINT "certificate_auto_issue_attempts_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("candidate_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_auto_issue_attempts" ADD CONSTRAINT "certificate_auto_issue_attempts_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_auto_issue_attempts" ADD CONSTRAINT "certificate_auto_issue_attempts_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "certificate_auto_issue_rules"("rule_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_auto_issue_attempts" ADD CONSTRAINT "certificate_auto_issue_attempts_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "certificate_templates"("template_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_auto_issue_attempts" ADD CONSTRAINT "certificate_auto_issue_attempts_curriculum_id_fkey" FOREIGN KEY ("curriculum_id") REFERENCES "curricula"("curriculum_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_auto_issue_attempts" ADD CONSTRAINT "certificate_auto_issue_attempts_certificate_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "candidate_certificates"("certificate_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_auto_issue_attempts" ADD CONSTRAINT "certificate_auto_issue_attempts_retried_from_attempt_id_fkey" FOREIGN KEY ("retried_from_attempt_id") REFERENCES "certificate_auto_issue_attempts"("attempt_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pronunciation_attempts" ADD CONSTRAINT "pronunciation_attempts_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "language_lab_words"("word_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pronunciation_attempts" ADD CONSTRAINT "pronunciation_attempts_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("candidate_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pronunciation_attempts" ADD CONSTRAINT "pronunciation_attempts_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pronunciation_attempt_phonemes" ADD CONSTRAINT "pronunciation_attempt_phonemes_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "pronunciation_attempts"("pronunciation_attempt_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_contents" ADD CONSTRAINT "course_contents_source_content_id_fkey" FOREIGN KEY ("source_content_id") REFERENCES "course_contents"("content_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_resource_categories" ADD CONSTRAINT "learning_resource_categories_parent_category_id_fkey" FOREIGN KEY ("parent_category_id") REFERENCES "learning_resource_categories"("category_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_resource_folders" ADD CONSTRAINT "learning_resource_folders_parent_folder_id_fkey" FOREIGN KEY ("parent_folder_id") REFERENCES "learning_resource_folders"("folder_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_resource_folders" ADD CONSTRAINT "learning_resource_folders_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_resources" ADD CONSTRAINT "learning_resources_source_content_id_fkey" FOREIGN KEY ("source_content_id") REFERENCES "course_contents"("content_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_resources" ADD CONSTRAINT "learning_resources_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "learning_resource_folders"("folder_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_resources" ADD CONSTRAINT "learning_resources_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "learning_resource_categories"("category_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_resources" ADD CONSTRAINT "learning_resources_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "learning_resource_categories"("category_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_resources" ADD CONSTRAINT "learning_resources_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_resources" ADD CONSTRAINT "learning_resources_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_resources" ADD CONSTRAINT "learning_resources_deleted_by_user_id_fkey" FOREIGN KEY ("deleted_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_resource_tag_map" ADD CONSTRAINT "learning_resource_tag_map_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "learning_resources"("resource_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_resource_tag_map" ADD CONSTRAINT "learning_resource_tag_map_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "learning_resource_tags"("tag_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_resource_attachments" ADD CONSTRAINT "learning_resource_attachments_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "learning_resources"("resource_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_resource_assignments" ADD CONSTRAINT "learning_resource_assignments_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "learning_resources"("resource_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_resource_assignments" ADD CONSTRAINT "learning_resource_assignments_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_resource_versions" ADD CONSTRAINT "learning_resource_versions_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "learning_resources"("resource_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_resource_versions" ADD CONSTRAINT "learning_resource_versions_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_resource_usage" ADD CONSTRAINT "learning_resource_usage_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "learning_resources"("resource_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_resource_usage" ADD CONSTRAINT "learning_resource_usage_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "learning_resource_assignments"("assignment_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_resource_usage" ADD CONSTRAINT "learning_resource_usage_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curricula" ADD CONSTRAINT "curricula_source_curriculum_id_fkey" FOREIGN KEY ("source_curriculum_id") REFERENCES "curricula"("curriculum_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_modules" ADD CONSTRAINT "curriculum_modules_prerequisite_module_id_fkey" FOREIGN KEY ("prerequisite_module_id") REFERENCES "curriculum_modules"("module_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_stages" ADD CONSTRAINT "curriculum_stages_prerequisite_stage_id_fkey" FOREIGN KEY ("prerequisite_stage_id") REFERENCES "curriculum_stages"("stage_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_stage_item_releases" ADD CONSTRAINT "curriculum_stage_item_releases_stage_item_id_fkey" FOREIGN KEY ("stage_item_id") REFERENCES "curriculum_stage_items"("item_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_stage_item_releases" ADD CONSTRAINT "curriculum_stage_item_releases_prerequisite_stage_item_id_fkey" FOREIGN KEY ("prerequisite_stage_item_id") REFERENCES "curriculum_stage_items"("item_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_curriculum_stage_item_releases" ADD CONSTRAINT "batch_curriculum_stage_item_releases_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_curriculum_stage_item_releases" ADD CONSTRAINT "batch_curriculum_stage_item_releases_stage_item_id_fkey" FOREIGN KEY ("stage_item_id") REFERENCES "curriculum_stage_items"("item_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_assessment_assignments" ADD CONSTRAINT "trainer_assessment_assignments_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("trainer_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_assessment_assignments" ADD CONSTRAINT "trainer_assessment_assignments_assessment_pool_id_fkey" FOREIGN KEY ("assessment_pool_id") REFERENCES "assessment_pools"("assessment_pool_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_assessment_assignments" ADD CONSTRAINT "trainer_assessment_assignments_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_bank_questions" ADD CONSTRAINT "question_bank_questions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("course_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_bank_questions" ADD CONSTRAINT "question_bank_questions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_curriculum_item_progress" ADD CONSTRAINT "learner_curriculum_item_progress_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("candidate_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_curriculum_item_progress" ADD CONSTRAINT "learner_curriculum_item_progress_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_curriculum_item_progress" ADD CONSTRAINT "learner_curriculum_item_progress_stage_item_id_fkey" FOREIGN KEY ("stage_item_id") REFERENCES "curriculum_stage_items"("item_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_session_assignments" ADD CONSTRAINT "trainer_session_assignments_schedule_event_id_fkey" FOREIGN KEY ("schedule_event_id") REFERENCES "batch_schedule_events"("event_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_session_assignments" ADD CONSTRAINT "trainer_session_assignments_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("trainer_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_session_assignments" ADD CONSTRAINT "trainer_session_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_session_assignments" ADD CONSTRAINT "trainer_session_assignments_removed_by_id_fkey" FOREIGN KEY ("removed_by_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_history" ADD CONSTRAINT "session_history_schedule_event_id_fkey" FOREIGN KEY ("schedule_event_id") REFERENCES "batch_schedule_events"("event_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_history" ADD CONSTRAINT "session_history_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "uq_batch_curriculum_stage_item_releases_batch_item" RENAME TO "batch_curriculum_stage_item_releases_batch_id_stage_item_id_key";

-- RenameIndex
ALTER INDEX "uq_curriculum_progress_learner_batch_stage_item" RENAME TO "learner_curriculum_item_progress_candidate_id_batch_id_stag_key";

-- RenameIndex
ALTER INDEX "uq_learning_resource_assignment_target" RENAME TO "learning_resource_assignments_resource_id_target_type_targe_key";

-- RenameIndex
ALTER INDEX "uq_learning_resource_version_number" RENAME TO "learning_resource_versions_resource_id_version_number_key";

-- RenameIndex
ALTER INDEX "uq_trainer_assessment_assignments_trainer_pool" RENAME TO "trainer_assessment_assignments_trainer_id_assessment_pool_i_key";

