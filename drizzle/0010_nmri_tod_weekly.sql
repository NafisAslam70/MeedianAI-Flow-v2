-- Enum for NMRI TOD roles
DO $$ BEGIN
  CREATE TYPE nmri_tod_role AS ENUM ('nmri_moderator','nmri_guide_english','nmri_guide_discipline');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Alter daily_slots to add crowd flag (optional)
ALTER TABLE "daily_slots" ADD COLUMN IF NOT EXISTS "is_high_gathering" boolean DEFAULT false NOT NULL;

-- Weekly role templates
CREATE TABLE IF NOT EXISTS "slot_weekly_roles" (
  "id" serial PRIMARY KEY,
  "slot_id" integer NOT NULL REFERENCES "daily_slots"("id"),
  "weekday" integer NOT NULL,
  "role" nmri_tod_role NOT NULL,
  "required_count" integer NOT NULL DEFAULT 1,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_slot_weekly_roles_slot_week" ON "slot_weekly_roles" ("slot_id","weekday");

-- Member assignments to weekly roles
CREATE TABLE IF NOT EXISTS "slot_role_assignments" (
  "id" serial PRIMARY KEY,
  "slot_weekly_role_id" integer NOT NULL REFERENCES "slot_weekly_roles"("id"),
  "user_id" integer NOT NULL REFERENCES "users"("id"),
  "start_date" date,
  "end_date" date,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_slot_role_assignments_role" ON "slot_role_assignments" ("slot_weekly_role_id");

