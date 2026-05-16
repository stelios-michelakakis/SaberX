-- Migration 0003 renamed users.tutorial_completed_at -> users.tutorial_seen
-- but left the column as TIMESTAMP WITH TIME ZONE. The Drizzle schema
-- declares it as BOOLEAN, so any UPDATE with a boolean value fails with
-- "invalid input syntax for type timestamp with time zone".
-- Convert the column in-place: anything non-null becomes true.

ALTER TABLE "users"
  ALTER COLUMN "tutorial_seen" DROP DEFAULT,
  ALTER COLUMN "tutorial_seen" TYPE boolean USING ("tutorial_seen" IS NOT NULL),
  ALTER COLUMN "tutorial_seen" SET DEFAULT false,
  ALTER COLUMN "tutorial_seen" SET NOT NULL;
