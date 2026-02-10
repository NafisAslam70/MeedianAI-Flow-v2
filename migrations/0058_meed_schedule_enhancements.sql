ALTER TABLE "meed_schedules"
  ADD COLUMN "schedule_number" varchar(40),
  ADD COLUMN "released_by" varchar(160),
  ADD COLUMN "moderator_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN "verified_by" varchar(160),
  ADD COLUMN "verified_at" timestamp,
  ADD COLUMN "wef_date" date,
  ADD COLUMN "goal" text,
  ADD COLUMN "print_options" jsonb DEFAULT '{}'::jsonb;

ALTER TABLE "meed_schedule_divisions"
  ADD COLUMN "duty_holders" text[] DEFAULT '{}'::text[];

CREATE INDEX "meed_schedules_moderator_idx" ON "meed_schedules" ("moderator_id");
