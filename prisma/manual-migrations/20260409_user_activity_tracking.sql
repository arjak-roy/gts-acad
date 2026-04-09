-- User Activity Tracking
-- Adds UserActivityLog model and new audit action types for
-- tracking candidate app activity (logins, logouts, deactivations).

-- Create the user_activity_type enum
CREATE TYPE "user_activity_type" AS ENUM (
  'login',
  'logout',
  'login_failed',
  'session_expired',
  'page_view',
  'forced_logout',
  'password_change',
  'account_activated',
  'account_deactivated'
);

-- Add new audit action types
ALTER TYPE "audit_action_type" ADD VALUE IF NOT EXISTS 'deactivated';
ALTER TYPE "audit_action_type" ADD VALUE IF NOT EXISTS 'activated';

-- Create the user_activity_logs table
CREATE TABLE "user_activity_logs" (
    "activity_log_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "activity_type" "user_activity_type" NOT NULL,
    "ip_address" VARCHAR(64),
    "user_agent" VARCHAR(255),
    "device" VARCHAR(120),
    "browser" VARCHAR(120),
    "session_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_activity_logs_pkey" PRIMARY KEY ("activity_log_id")
);

-- Indexes for efficient querying
CREATE INDEX "idx_user_activity_logs_user_created" ON "user_activity_logs"("user_id", "created_at");
CREATE INDEX "idx_user_activity_logs_type_created" ON "user_activity_logs"("activity_type", "created_at");
CREATE INDEX "idx_user_activity_logs_user_type" ON "user_activity_logs"("user_id", "activity_type");

-- Foreign key linking to users table with cascade delete
ALTER TABLE "user_activity_logs"
  ADD CONSTRAINT "user_activity_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
