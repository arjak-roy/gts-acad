UPDATE "batch_schedule_events"
SET "event_type" = 'test'
WHERE "event_type" IN ('quiz', 'contest');

ALTER TABLE "batch_schedule_events"
ALTER COLUMN "event_type" TYPE TEXT
USING "event_type"::text;

DROP TYPE IF EXISTS "schedule_event_type";

CREATE TYPE "schedule_event_type" AS ENUM ('class', 'test');

ALTER TABLE "batch_schedule_events"
ALTER COLUMN "event_type" TYPE "schedule_event_type"
USING "event_type"::"schedule_event_type";