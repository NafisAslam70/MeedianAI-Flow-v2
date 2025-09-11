CREATE TABLE "mri_program_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_name" varchar(255) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assigned_tasks" ADD COLUMN "submissables" jsonb;--> statement-breakpoint
ALTER TABLE "assigned_tasks" ADD COLUMN "action" text;