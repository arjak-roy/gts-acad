DO $$
BEGIN
  CREATE TYPE push_provider AS ENUM ('expo');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE push_device_platform AS ENUM ('android', 'ios', 'web', 'unknown');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE push_dispatch_target_type AS ENUM ('candidate', 'batch');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE candidate_notification_destination AS ENUM (
    'dashboard',
    'program_detail',
    'assessments',
    'support',
    'notification_center'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE push_delivery_status AS ENUM (
    'pending',
    'sent',
    'failed',
    'device_invalid',
    'skipped'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS user_push_devices (
  push_device_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider push_provider NOT NULL DEFAULT 'expo',
  platform push_device_platform NOT NULL DEFAULT 'unknown',
  device_identifier varchar(120),
  expo_push_token varchar(255) NOT NULL UNIQUE,
  device_name varchar(120),
  app_version varchar(50),
  project_id varchar(120),
  permissions_granted boolean NOT NULL DEFAULT false,
  last_registered_at timestamptz(6) NOT NULL DEFAULT now(),
  last_seen_at timestamptz(6),
  last_success_at timestamptz(6),
  invalidated_at timestamptz(6),
  revoked_at timestamptz(6),
  invalidation_reason varchar(255),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT fk_user_push_devices_user
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_push_devices_user_state
  ON user_push_devices (user_id, revoked_at, invalidated_at);

CREATE INDEX IF NOT EXISTS idx_push_devices_identifier
  ON user_push_devices (device_identifier);

CREATE INDEX IF NOT EXISTS idx_push_devices_last_registered
  ON user_push_devices (last_registered_at);

CREATE TABLE IF NOT EXISTS push_dispatches (
  push_dispatch_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id uuid,
  target_type push_dispatch_target_type NOT NULL,
  target_id varchar(120),
  title varchar(255) NOT NULL,
  body varchar(2000) NOT NULL,
  destination candidate_notification_destination NOT NULL,
  cta_label varchar(120),
  batch_id uuid,
  assessment_pool_id uuid,
  requested_recipient_count integer NOT NULL DEFAULT 0,
  sent_recipient_count integer NOT NULL DEFAULT 0,
  failed_recipient_count integer NOT NULL DEFAULT 0,
  skipped_recipient_count integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT fk_push_dispatches_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_push_dispatch_target_created
  ON push_dispatches (target_type, target_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_dispatch_created_by
  ON push_dispatches (created_by_user_id);

CREATE INDEX IF NOT EXISTS idx_push_dispatch_created
  ON push_dispatches (created_at DESC);

CREATE TABLE IF NOT EXISTS candidate_notifications (
  notification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  push_dispatch_id uuid,
  user_id uuid NOT NULL,
  title varchar(255) NOT NULL,
  body varchar(2000) NOT NULL,
  destination candidate_notification_destination NOT NULL,
  cta_label varchar(120),
  batch_id uuid,
  assessment_pool_id uuid,
  read_at timestamptz(6),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT fk_candidate_notifications_dispatch
    FOREIGN KEY (push_dispatch_id) REFERENCES push_dispatches(push_dispatch_id) ON DELETE SET NULL,
  CONSTRAINT fk_candidate_notifications_user
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_candidate_notifications_user_read
  ON candidate_notifications (user_id, read_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_candidate_notifications_dispatch
  ON candidate_notifications (push_dispatch_id);

CREATE INDEX IF NOT EXISTS idx_candidate_notifications_batch
  ON candidate_notifications (batch_id);

CREATE TABLE IF NOT EXISTS candidate_notification_deliveries (
  notification_delivery_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  push_dispatch_id uuid,
  notification_id uuid NOT NULL,
  push_device_id uuid NOT NULL,
  provider push_provider NOT NULL DEFAULT 'expo',
  status push_delivery_status NOT NULL DEFAULT 'pending',
  expo_ticket_id varchar(255),
  expo_receipt_id varchar(255),
  error_code varchar(120),
  error_message varchar(1000),
  response jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempted_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT fk_candidate_notification_deliveries_dispatch
    FOREIGN KEY (push_dispatch_id) REFERENCES push_dispatches(push_dispatch_id) ON DELETE SET NULL,
  CONSTRAINT fk_candidate_notification_deliveries_notification
    FOREIGN KEY (notification_id) REFERENCES candidate_notifications(notification_id) ON DELETE CASCADE,
  CONSTRAINT fk_candidate_notification_deliveries_device
    FOREIGN KEY (push_device_id) REFERENCES user_push_devices(push_device_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_dispatch
  ON candidate_notification_deliveries (push_dispatch_id);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_notification
  ON candidate_notification_deliveries (notification_id);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_device_attempted
  ON candidate_notification_deliveries (push_device_id, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_status_attempted
  ON candidate_notification_deliveries (status, attempted_at DESC);