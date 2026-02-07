CREATE TABLE "mhcp_slot_duties" (
  "id" serial PRIMARY KEY,
  "program_id" integer NOT NULL REFERENCES "mri_programs"("id") ON DELETE CASCADE,
  "track" varchar(32) NOT NULL DEFAULT 'both',
  "day_name" varchar(16) NOT NULL,
  "slot_label" varchar(80) NOT NULL,
  "duty_title" varchar(160),
  "start_time" time,
  "end_time" time,
  "assigned_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "notes" text,
  "position" integer DEFAULT 0,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "mhcp_slot_duties_program_day_idx" ON "mhcp_slot_duties" ("program_id","day_name");
CREATE INDEX "mhcp_slot_duties_program_track_idx" ON "mhcp_slot_duties" ("program_id","track");
