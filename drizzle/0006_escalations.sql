-- Escalations core tables
CREATE TYPE "public"."escalation_status" AS ENUM('OPEN','ESCALATED','CLOSED');
CREATE TYPE "public"."escalation_action" AS ENUM('CREATED','ESCALATE','CLOSE');

CREATE TABLE "escalations_matters" (
  "id" serial PRIMARY KEY,
  "title" varchar(200) NOT NULL,
  "description" text,
  "created_by_id" integer NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE,
  "current_assignee_id" integer REFERENCES "public"."users"("id") ON DELETE SET NULL,
  "suggested_level2_id" integer REFERENCES "public"."users"("id") ON DELETE SET NULL,
  "status" "public"."escalation_status" NOT NULL DEFAULT 'OPEN',
  "level" integer NOT NULL DEFAULT 1,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "esc_matters_assignee_idx" ON "escalations_matters" ("current_assignee_id");
CREATE INDEX "esc_matters_creator_idx" ON "escalations_matters" ("created_by_id");
CREATE INDEX "esc_matters_status_idx" ON "escalations_matters" ("status");

CREATE TABLE "escalations_matter_members" (
  "id" serial PRIMARY KEY,
  "matter_id" integer NOT NULL REFERENCES "public"."escalations_matters"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now()
);
CREATE UNIQUE INDEX "esc_matter_members_unique" ON "escalations_matter_members" ("matter_id","user_id");
CREATE INDEX "esc_matter_members_user_idx" ON "escalations_matter_members" ("user_id");

CREATE TABLE "escalations_steps" (
  "id" serial PRIMARY KEY,
  "matter_id" integer NOT NULL REFERENCES "public"."escalations_matters"("id") ON DELETE CASCADE,
  "level" integer NOT NULL,
  "action" "public"."escalation_action" NOT NULL,
  "from_user_id" integer REFERENCES "public"."users"("id") ON DELETE SET NULL,
  "to_user_id" integer REFERENCES "public"."users"("id") ON DELETE SET NULL,
  "note" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "esc_steps_matter_idx" ON "escalations_steps" ("matter_id");

CREATE TABLE "day_close_overrides" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE,
  "matter_id" integer REFERENCES "public"."escalations_matters"("id") ON DELETE SET NULL,
  "reason" text,
  "active" boolean NOT NULL DEFAULT true,
  "created_by" integer NOT NULL REFERENCES "public"."users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "ended_at" timestamp
);
CREATE INDEX "day_close_overrides_user_idx" ON "day_close_overrides" ("user_id");

