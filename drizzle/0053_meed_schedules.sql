CREATE TABLE "meed_schedules" (
  "id" serial PRIMARY KEY,
  "program_id" integer REFERENCES "mri_programs"("id") ON DELETE SET NULL,
  "title" varchar(160) NOT NULL,
  "description" text,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "meed_schedules_program_idx" ON "meed_schedules" ("program_id");

CREATE TABLE "meed_schedule_divisions" (
  "id" serial PRIMARY KEY,
  "schedule_id" integer NOT NULL REFERENCES "meed_schedules"("id") ON DELETE CASCADE,
  "label" varchar(160) NOT NULL,
  "start_time" time,
  "end_time" time,
  "is_free" boolean NOT NULL DEFAULT false,
  "position" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "meed_schedule_divisions_schedule_idx" ON "meed_schedule_divisions" ("schedule_id");
