ALTER TABLE "mri_role_tasks" ALTER COLUMN "submissables" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "mri_role_tasks" ALTER COLUMN "action" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "assigned_tasks" DROP COLUMN "submissables";--> statement-breakpoint
ALTER TABLE "assigned_tasks" DROP COLUMN "action";