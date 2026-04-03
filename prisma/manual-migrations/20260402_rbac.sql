BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE "roles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(100) NOT NULL UNIQUE,
  "description" TEXT,
  "is_system" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "permissions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(150) NOT NULL UNIQUE,
  "resource" VARCHAR(100) NOT NULL,
  "action" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "permissions_resource_action_key" UNIQUE ("resource", "action")
);

CREATE TABLE "role_permissions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "role_id" UUID NOT NULL,
  "permission_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "role_permissions_role_id_permission_id_key" UNIQUE ("role_id", "permission_id"),
  CONSTRAINT "role_permissions_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "roles" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT "role_permissions_permission_id_fkey"
    FOREIGN KEY ("permission_id") REFERENCES "permissions" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE TABLE "user_roles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "role_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_roles_user_id_role_id_key" UNIQUE ("user_id", "role_id"),
  CONSTRAINT "user_roles_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users" ("user_id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT "user_roles_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "roles" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE TABLE "user_permissions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "permission_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_permissions_user_id_permission_id_key" UNIQUE ("user_id", "permission_id"),
  CONSTRAINT "user_permissions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users" ("user_id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT "user_permissions_permission_id_fkey"
    FOREIGN KEY ("permission_id") REFERENCES "permissions" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE TABLE "user_sessions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "session_token" TEXT NOT NULL UNIQUE,
  "permissions" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "roles" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "revoked_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users" ("user_id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE INDEX "idx_permissions_resource_action" ON "permissions" ("resource", "action");
CREATE INDEX "idx_role_permissions_role_id" ON "role_permissions" ("role_id");
CREATE INDEX "idx_role_permissions_permission_id" ON "role_permissions" ("permission_id");
CREATE INDEX "idx_user_roles_user_id" ON "user_roles" ("user_id");
CREATE INDEX "idx_user_roles_role_id" ON "user_roles" ("role_id");
CREATE INDEX "idx_user_permissions_user_id" ON "user_permissions" ("user_id");
CREATE INDEX "idx_user_permissions_permission_id" ON "user_permissions" ("permission_id");
CREATE INDEX "idx_user_sessions_user_id" ON "user_sessions" ("user_id");
CREATE INDEX "idx_user_sessions_expires_at" ON "user_sessions" ("expires_at");
CREATE INDEX "idx_user_sessions_revoked_at" ON "user_sessions" ("revoked_at");

INSERT INTO "roles" ("name", "description", "is_system")
VALUES
  ('Super Admin', 'Full unrestricted access across all resources.', true),
  ('Admin', 'Administrative access with scoped system and candidate permissions.', true),
  ('Candidate', 'End-user access limited to self-service actions.', true);

INSERT INTO "permissions" ("name", "resource", "action", "description")
VALUES
  ('all:*', 'all', '*', 'Master permission granting unrestricted access to all resources and actions.'),
  ('candidate:read_own', 'candidate', 'read_own', 'Read the authenticated candidate profile and related records.'),
  ('candidate:update_own', 'candidate', 'update_own', 'Update the authenticated candidate profile.'),
  ('module:dashboard', 'module', 'dashboard', 'Access dashboard KPIs, alerts, and search.'),
  ('module:overview', 'module', 'overview', 'Access cross-module overview pages.'),
  ('module:learners', 'module', 'learners', 'Access learner management pages and APIs.'),
  ('module:courses', 'module', 'courses', 'Access courses module.'),
  ('module:programs', 'module', 'programs', 'Access programs module.'),
  ('module:batches', 'module', 'batches', 'Access batches module.'),
  ('module:trainers', 'module', 'trainers', 'Access trainers module.'),
  ('module:attendance', 'module', 'attendance', 'Access attendance module.'),
  ('module:assessments', 'module', 'assessments', 'Access assessments module.'),
  ('module:certifications', 'module', 'certifications', 'Access certifications module.'),
  ('module:readiness', 'module', 'readiness', 'Access readiness module.'),
  ('module:language_lab', 'module', 'language_lab', 'Access language lab module.'),
  ('module:payments', 'module', 'payments', 'Access payments module.'),
  ('module:support', 'module', 'support', 'Access support module.'),
  ('candidate:read', 'candidate', 'read', 'Read candidate records.'),
  ('candidate:update', 'candidate', 'update', 'Update candidate records.'),
  ('system:manage_users', 'system', 'manage_users', 'Create, update, deactivate, and assign roles to users.'),
  ('system:manage_roles', 'system', 'manage_roles', 'Create, update, and assign roles and permissions.');

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."name" = 'all:*'
WHERE r."name" = 'Super Admin';

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."name" IN (
  'candidate:read',
  'candidate:update',
  'system:manage_users',
  'system:manage_roles'
)
WHERE r."name" = 'Admin';

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."name" IN (
  'candidate:read_own',
  'candidate:update_own'
)
WHERE r."name" = 'Candidate';

INSERT INTO "user_roles" ("user_id", "role_id")
SELECT u."user_id", r."id"
FROM "users" u
JOIN "roles" r ON r."name" = 'Admin'
WHERE u."role"::text = 'admin'
ON CONFLICT ("user_id", "role_id") DO NOTHING;

INSERT INTO "user_roles" ("user_id", "role_id")
SELECT u."user_id", r."id"
FROM "users" u
JOIN "roles" r ON r."name" = 'Candidate'
WHERE u."role"::text = 'candidate'
ON CONFLICT ("user_id", "role_id") DO NOTHING;

COMMIT;