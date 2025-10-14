CREATE TYPE "public"."ahr_transition_quality" AS ENUM ('SMOOTH','MINOR_ISSUES','MAJOR_ISSUES');
CREATE TYPE "public"."ahr_check_mode" AS ENUM ('MSP','MORNING_COACHING');
CREATE TYPE "public"."ahr_escalation_status" AS ENUM ('RESOLVED','FOLLOW_UP','ESCALATED_UP');
CREATE TYPE "public"."ahr_diary_type" AS ENUM ('CCD','CDD');

CREATE TABLE IF NOT EXISTS "academic_health_reports" (
  "id" serial PRIMARY KEY,
  "report_date" timestamp NOT NULL,
  "site_id" integer NOT NULL,
  "assigned_to_user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "status" varchar(24) NOT NULL DEFAULT 'DRAFT',
  "mop2_checkin_id" integer,
  "mop2_checkin_time" timestamp,
  "attendance_confirmed" boolean NOT NULL DEFAULT false,
  "maghrib_salah_led_by_id" integer NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "slot12_transition_quality" "ahr_transition_quality" NOT NULL,
  "slot12_nmri_moderated" boolean NOT NULL DEFAULT true,
  "slot12_ads" text,
  "mhcp2_present_count" integer NOT NULL DEFAULT 0,
  "mhcp2_all_teachers_present" boolean NOT NULL DEFAULT true,
  "mhcp2_absent_teacher_ids" jsonb DEFAULT '[]'::jsonb,
  "mhcp2_substitutions" jsonb DEFAULT '[]'::jsonb,
  "mhcp2_focus_today" varchar(200) NOT NULL,
  "mhcp2_discrepancies" text,
  "section1_comment" text,
  "check_mode" "ahr_check_mode" NOT NULL,
  "escalations_handled_ids" jsonb DEFAULT '[]'::jsonb,
  "self_day_close" boolean NOT NULL DEFAULT false,
  "final_remarks" text,
  "signature_name" varchar(120),
  "signature_blob_path" varchar(255),
  "created_by_user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "ahr_report_assignment_idx" ON "academic_health_reports" ("report_date", "assigned_to_user_id");
CREATE INDEX "ahr_site_date_idx" ON "academic_health_reports" ("site_id", "report_date");

CREATE TABLE IF NOT EXISTS "ahr_copy_checks" (
  "id" serial PRIMARY KEY,
  "ahr_id" integer NOT NULL REFERENCES "academic_health_reports"("id") ON DELETE CASCADE,
  "student_id" integer NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "copy_types" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "ad_flag" boolean NOT NULL DEFAULT false,
  "note" text
);

CREATE INDEX "ahr_copy_checks_ahr_student_idx" ON "ahr_copy_checks" ("ahr_id", "student_id");

CREATE TABLE IF NOT EXISTS "ahr_class_diary_checks" (
  "id" serial PRIMARY KEY,
  "ahr_id" integer NOT NULL REFERENCES "academic_health_reports"("id") ON DELETE CASCADE,
  "class_id" integer NOT NULL REFERENCES "classes"("id") ON DELETE CASCADE,
  "diary_type" "ahr_diary_type" NOT NULL,
  "ad_flag" boolean NOT NULL DEFAULT false,
  "note" text
);

CREATE INDEX "ahr_class_diary_checks_ahr_class_idx" ON "ahr_class_diary_checks" ("ahr_id", "class_id");

CREATE TABLE IF NOT EXISTS "ahr_morning_coaching" (
  "id" serial PRIMARY KEY,
  "ahr_id" integer NOT NULL REFERENCES "academic_health_reports"("id") ON DELETE CASCADE,
  "absentees" jsonb DEFAULT '[]'::jsonb,
  "state" text
);

CREATE INDEX "ahr_morning_coaching_ahr_idx" ON "ahr_morning_coaching" ("ahr_id");

CREATE TABLE IF NOT EXISTS "ahr_escalation_details" (
  "id" serial PRIMARY KEY,
  "ahr_id" integer NOT NULL REFERENCES "academic_health_reports"("id") ON DELETE CASCADE,
  "escalation_id" integer NOT NULL,
  "action_taken" text,
  "outcome" text,
  "status" "ahr_escalation_status" NOT NULL
);

CREATE INDEX "ahr_escalation_details_ahr_escalation_idx" ON "ahr_escalation_details" ("ahr_id", "escalation_id");

CREATE TABLE IF NOT EXISTS "ahr_defaulters" (
  "id" serial PRIMARY KEY,
  "ahr_id" integer NOT NULL REFERENCES "academic_health_reports"("id") ON DELETE CASCADE,
  "student_id" integer NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "defaulter_type" "defaulter_type" NOT NULL,
  "reason" text
);

CREATE INDEX "ahr_defaulters_ahr_student_idx" ON "ahr_defaulters" ("ahr_id", "student_id");
CREATE INDEX "ahr_defaulters_ahr_type_idx" ON "ahr_defaulters" ("ahr_id", "defaulter_type");

CREATE TABLE IF NOT EXISTS "ahr_actions_by_category" (
  "id" serial PRIMARY KEY,
  "ahr_id" integer NOT NULL REFERENCES "academic_health_reports"("id") ON DELETE CASCADE,
  "category" "defaulter_type" NOT NULL,
  "actions" jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX "ahr_actions_category_idx" ON "ahr_actions_by_category" ("ahr_id", "category");
