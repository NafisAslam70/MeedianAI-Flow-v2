CREATE TABLE IF NOT EXISTS "guardian_call_reports" (
  "id" serial PRIMARY KEY,
  "call_date" date NOT NULL,
  "class_id" integer NOT NULL REFERENCES "classes"("id") ON DELETE RESTRICT,
  "student_id" integer NOT NULL REFERENCES "students"("id") ON DELETE RESTRICT,
  "program_id" integer REFERENCES "mri_programs"("id") ON DELETE SET NULL,
  "guardian_name" text NOT NULL,
  "guardian_phone" varchar(32),
  "report" text NOT NULL,
  "follow_up_needed" boolean NOT NULL DEFAULT false,
  "follow_up_date" date,
  "called_by_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "guardian_call_reports_call_date_idx" ON "guardian_call_reports" ("call_date");
CREATE INDEX IF NOT EXISTS "guardian_call_reports_class_idx" ON "guardian_call_reports" ("class_id");
CREATE INDEX IF NOT EXISTS "guardian_call_reports_student_idx" ON "guardian_call_reports" ("student_id");
CREATE INDEX IF NOT EXISTS "guardian_call_reports_follow_up_idx" ON "guardian_call_reports" ("follow_up_needed", "follow_up_date");
