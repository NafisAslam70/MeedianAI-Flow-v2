CREATE TABLE IF NOT EXISTS "campus_gate_staff_logs" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "direction" varchar(8) NOT NULL,
  "purpose" text,
  "recorded_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "campus_gate_staff_logs_user_idx" ON "campus_gate_staff_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "campus_gate_staff_logs_recorded_idx" ON "campus_gate_staff_logs" ("recorded_at");

CREATE TABLE IF NOT EXISTS "guardian_gate_logs" (
  "id" serial PRIMARY KEY,
  "visit_date" date NOT NULL,
  "guardian_name" text NOT NULL,
  "student_name" text NOT NULL,
  "class_name" varchar(80),
  "purpose" text,
  "in_at" timestamp,
  "out_at" timestamp,
  "signature" varchar(160),
  "created_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "guardian_gate_logs_date_idx" ON "guardian_gate_logs" ("visit_date");
