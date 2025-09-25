-- Support ticketing system core objects
CREATE TYPE "public"."ticket_priority" AS ENUM ('low','normal','high','urgent');
CREATE TYPE "public"."ticket_status" AS ENUM ('open','triaged','in_progress','waiting_user','escalated','resolved','closed');
CREATE TYPE "public"."ticket_queue" AS ENUM ('facilities','it','finance','academics','hostel','operations','other');
CREATE TYPE "public"."ticket_activity_type" AS ENUM ('comment','status_change','assignment','priority_change','system','attachment');

CREATE TABLE "tickets" (
  "id" serial PRIMARY KEY,
  "ticket_number" varchar(32) NOT NULL UNIQUE,
  "created_by_id" integer NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE,
  "assigned_to_id" integer REFERENCES "public"."users"("id") ON DELETE SET NULL,
  "queue" "public"."ticket_queue" NOT NULL DEFAULT 'operations',
  "category" varchar(120) NOT NULL,
  "subcategory" varchar(120),
  "title" varchar(200) NOT NULL,
  "description" text,
  "priority" "public"."ticket_priority" NOT NULL DEFAULT 'normal',
  "status" "public"."ticket_status" NOT NULL DEFAULT 'open',
  "escalated" boolean NOT NULL DEFAULT false,
  "sla_first_response_at" timestamp,
  "sla_resolve_by" timestamp,
  "first_response_at" timestamp,
  "resolved_at" timestamp,
  "closed_at" timestamp,
  "reopened_at" timestamp,
  "last_activity_at" timestamp NOT NULL DEFAULT now(),
  "attachments" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "metadata" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX "tickets_creator_idx" ON "tickets" ("created_by_id");
CREATE INDEX "tickets_assignee_idx" ON "tickets" ("assigned_to_id");
CREATE INDEX "tickets_status_idx" ON "tickets" ("status");
CREATE INDEX "tickets_queue_idx" ON "tickets" ("queue");
CREATE INDEX "tickets_priority_idx" ON "tickets" ("priority");

CREATE TABLE "ticket_activities" (
  "id" serial PRIMARY KEY,
  "ticket_id" integer NOT NULL REFERENCES "public"."tickets"("id") ON DELETE CASCADE,
  "author_id" integer REFERENCES "public"."users"("id") ON DELETE SET NULL,
  "type" "public"."ticket_activity_type" NOT NULL DEFAULT 'comment',
  "message" text,
  "from_status" "public"."ticket_status",
  "to_status" "public"."ticket_status",
  "metadata" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX "ticket_activities_ticket_idx" ON "ticket_activities" ("ticket_id");
CREATE INDEX "ticket_activities_author_idx" ON "ticket_activities" ("author_id");
CREATE INDEX "ticket_activities_type_idx" ON "ticket_activities" ("type");

ALTER TABLE "escalations_matters"
  ADD COLUMN "ticket_id" integer REFERENCES "public"."tickets"("id") ON DELETE SET NULL;
CREATE INDEX "esc_matters_ticket_idx" ON "escalations_matters" ("ticket_id");
