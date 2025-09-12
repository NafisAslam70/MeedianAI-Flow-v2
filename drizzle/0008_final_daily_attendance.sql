-- Finalized attendance tables
CREATE TABLE IF NOT EXISTS "final_daily_attendance" (
  "id" serial PRIMARY KEY,
  "session_id" integer NOT NULL REFERENCES "public"."scanner_sessions"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE,
  "name" varchar(200),
  "at" timestamptz,
  "date" date NOT NULL,
  "program_key" varchar(16),
  "track" varchar(32),
  "role_key" varchar(64)
);
CREATE UNIQUE INDEX IF NOT EXISTS "final_attendance_session_user_unique" ON "final_daily_attendance" ("session_id","user_id");

CREATE TABLE IF NOT EXISTS "final_daily_absentees" (
  "id" serial PRIMARY KEY,
  "session_id" integer NOT NULL REFERENCES "public"."scanner_sessions"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE,
  "name" varchar(200),
  "date" date NOT NULL,
  "program_key" varchar(16),
  "track" varchar(32),
  "role_key" varchar(64)
);
CREATE UNIQUE INDEX IF NOT EXISTS "final_absentees_session_user_unique" ON "final_daily_absentees" ("session_id","user_id");

