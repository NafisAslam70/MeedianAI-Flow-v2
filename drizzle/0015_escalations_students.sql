-- Escalations: track students involved in a matter
CREATE TABLE IF NOT EXISTS "escalations_matter_students" (
  "id" serial PRIMARY KEY,
  "matter_id" integer NOT NULL REFERENCES "escalations_matters"("id") ON DELETE CASCADE,
  "student_id" integer NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT esc_matter_students_unique UNIQUE ("matter_id","student_id")
);
CREATE INDEX IF NOT EXISTS "esc_matter_students_student_idx" ON "escalations_matter_students" ("student_id");

