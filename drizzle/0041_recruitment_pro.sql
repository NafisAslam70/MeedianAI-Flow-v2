CREATE TYPE "public"."recruitment_candidate_status" AS ENUM ('Active','Inactive','Withdrawn');
CREATE TYPE "public"."recruitment_final_status" AS ENUM ('SELECTED','REJECTED','OFFER','ACCEPTED','JOINED','ON_HOLD');
CREATE TYPE "public"."recruitment_comm_method" AS ENUM ('Call','WhatsApp','Email','SMS','In-Person','Video Call');
CREATE TYPE "public"."recruitment_comm_outcome" AS ENUM ('Interested','Not Interested','Will Call Back','Pending','Callback Required');

CREATE TABLE IF NOT EXISTS "recruitment_meta_programs" (
  "id" serial PRIMARY KEY,
  "program_code" varchar(20) NOT NULL,
  "program_name" varchar(160) NOT NULL,
  "description" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "uniq_recruitment_program_code" UNIQUE ("program_code")
);
CREATE INDEX IF NOT EXISTS "idx_recruitment_program_active" ON "recruitment_meta_programs" ("is_active");

CREATE TABLE IF NOT EXISTS "recruitment_meta_stages" (
  "id" serial PRIMARY KEY,
  "stage_code" varchar(20) NOT NULL,
  "stage_name" varchar(160) NOT NULL,
  "description" text,
  "stage_order" integer NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "uniq_recruitment_stage_code" UNIQUE ("stage_code")
);
CREATE INDEX IF NOT EXISTS "idx_recruitment_stage_order" ON "recruitment_meta_stages" ("stage_order");
CREATE INDEX IF NOT EXISTS "idx_recruitment_stage_active" ON "recruitment_meta_stages" ("is_active");

CREATE TABLE IF NOT EXISTS "recruitment_meta_country_codes" (
  "id" serial PRIMARY KEY,
  "country_name" varchar(80) NOT NULL,
  "country_code" varchar(12) NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "uniq_recruitment_country_code" UNIQUE ("country_code")
);
CREATE INDEX IF NOT EXISTS "idx_recruitment_country_active" ON "recruitment_meta_country_codes" ("is_active");

CREATE TABLE IF NOT EXISTS "recruitment_meta_locations" (
  "id" serial PRIMARY KEY,
  "location_name" varchar(160) NOT NULL,
  "city" varchar(120) NOT NULL,
  "state" varchar(120),
  "country" varchar(120) NOT NULL DEFAULT 'India',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "uniq_recruitment_location_name" UNIQUE ("location_name")
);
CREATE INDEX IF NOT EXISTS "idx_recruitment_location_active" ON "recruitment_meta_locations" ("is_active");

CREATE TABLE IF NOT EXISTS "recruitment_candidates" (
  "id" serial PRIMARY KEY,
  "sr_no" integer,
  "first_name" varchar(120) NOT NULL,
  "last_name" varchar(120),
  "email" varchar(255) NOT NULL,
  "country_code_id" integer NOT NULL REFERENCES "recruitment_meta_country_codes"("id"),
  "phone_number" varchar(20) NOT NULL,
  "full_phone" varchar(32),
  "program_id" integer NOT NULL REFERENCES "recruitment_meta_programs"("id"),
  "location_id" integer NOT NULL REFERENCES "recruitment_meta_locations"("id"),
  "applied_year" integer,
  "resume_url" text,
  "candidate_status" recruitment_candidate_status NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "uniq_recruitment_candidate_sr_no" UNIQUE ("sr_no"),
  CONSTRAINT "uniq_recruitment_candidate_email" UNIQUE ("email")
);
CREATE INDEX IF NOT EXISTS "idx_recruitment_candidate_phone" ON "recruitment_candidates" ("phone_number");
CREATE INDEX IF NOT EXISTS "idx_recruitment_candidate_program" ON "recruitment_candidates" ("program_id");
CREATE INDEX IF NOT EXISTS "idx_recruitment_candidate_status" ON "recruitment_candidates" ("candidate_status");

CREATE TABLE IF NOT EXISTS "recruitment_pipeline_stages" (
  "id" serial PRIMARY KEY,
  "candidate_id" integer NOT NULL REFERENCES "recruitment_candidates"("id"),
  "stage_id" integer NOT NULL REFERENCES "recruitment_meta_stages"("id"),
  "stage_completed" boolean NOT NULL DEFAULT false,
  "completed_date" date,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "uniq_recruitment_candidate_stage" UNIQUE ("candidate_id","stage_id")
);
CREATE INDEX IF NOT EXISTS "idx_recruitment_pipeline_candidate" ON "recruitment_pipeline_stages" ("candidate_id");
CREATE INDEX IF NOT EXISTS "idx_recruitment_pipeline_stage" ON "recruitment_pipeline_stages" ("stage_id");

CREATE TABLE IF NOT EXISTS "recruitment_pipeline_final" (
  "id" serial PRIMARY KEY,
  "candidate_id" integer NOT NULL REFERENCES "recruitment_candidates"("id"),
  "final_status" recruitment_final_status NOT NULL,
  "final_date" date NOT NULL,
  "joining_date" date,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "uniq_recruitment_candidate_final" UNIQUE ("candidate_id")
);
CREATE INDEX IF NOT EXISTS "idx_recruitment_final_status" ON "recruitment_pipeline_final" ("final_status");

CREATE TABLE IF NOT EXISTS "recruitment_communication_log" (
  "id" serial PRIMARY KEY,
  "candidate_id" integer NOT NULL REFERENCES "recruitment_candidates"("id"),
  "communication_date" date NOT NULL,
  "communication_method" recruitment_comm_method NOT NULL,
  "subject" varchar(255) NOT NULL,
  "outcome" recruitment_comm_outcome NOT NULL,
  "follow_up_date" date,
  "notes" text,
  "created_by" integer REFERENCES "users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_recruitment_comm_candidate" ON "recruitment_communication_log" ("candidate_id");
CREATE INDEX IF NOT EXISTS "idx_recruitment_comm_date" ON "recruitment_communication_log" ("communication_date");
CREATE INDEX IF NOT EXISTS "idx_recruitment_comm_follow" ON "recruitment_communication_log" ("follow_up_date");

CREATE TABLE IF NOT EXISTS "recruitment_program_requirements" (
  "id" serial PRIMARY KEY,
  "program_id" integer NOT NULL REFERENCES "recruitment_meta_programs"("id"),
  "location_id" integer NOT NULL REFERENCES "recruitment_meta_locations"("id"),
  "required_count" integer NOT NULL,
  "filled_count" integer NOT NULL DEFAULT 0,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "uniq_recruitment_program_location" UNIQUE ("program_id","location_id")
);
