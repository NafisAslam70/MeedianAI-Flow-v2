CREATE TYPE "public"."announcement_program" AS ENUM('MSP', 'MSP-E', 'MHCP', 'MNP', 'MGHP', 'MAP', 'M4E', 'Other');--> statement-breakpoint
CREATE TYPE "public"."announcement_target" AS ENUM('team_members', 'students', 'all');--> statement-breakpoint
CREATE TYPE "public"."defaulter_type" AS ENUM('punctuality', 'language', 'discipline');--> statement-breakpoint
CREATE TYPE "public"."direct_recipient_type" AS ENUM('existing', 'custom');--> statement-breakpoint
CREATE TYPE "public"."leave_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."me_right_now_type" AS ENUM('assigned', 'routine', 'amri', 'nmri', 'rmri', 'mri', 'omri', 'custom');--> statement-breakpoint
CREATE TYPE "public"."meed_repo_status" AS ENUM('draft', 'submitted', 'approved', 'rejected', 'archived');--> statement-breakpoint
CREATE TYPE "public"."member_scope" AS ENUM('o_member', 'i_member', 's_member');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('sent', 'read', 'failed');--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('direct', 'task_update');--> statement-breakpoint
CREATE TYPE "public"."mri_role" AS ENUM('nmri_moderator', 'msp_ele_moderator', 'msp_pre_moderator', 'mhcp1_moderator', 'mhcp2_moderator', 'events_moderator', 'assessment_moderator', 'sports_moderator', 'util_moderator', 'pt_moderator');--> statement-breakpoint
CREATE TYPE "public"."note_category" AS ENUM('MSP', 'MHCP', 'MHP', 'MOP', 'Other', 'Building Home');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('chat_message', 'task_update', 'task_ready_for_verification', 'task_verified', 'repo_submitted', 'community_post', 'community_comment', 'community_like');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'upi', 'bank');--> statement-breakpoint
CREATE TYPE "public"."resource_log_kind" AS ENUM('check_out', 'check_in', 'maintenance', 'issue', 'transfer', 'retire', 'assign', 'move');--> statement-breakpoint
CREATE TYPE "public"."resource_status" AS ENUM('available', 'in_use', 'maintenance', 'retired');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'team_manager', 'member');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('not_started', 'in_progress', 'pending_verification', 'verified', 'done', 'not_done');--> statement-breakpoint
CREATE TYPE "public"."student_status" AS ENUM('hosteller', 'dayscholar');--> statement-breakpoint
CREATE TYPE "public"."task_type" AS ENUM('assigned', 'routine');--> statement-breakpoint
CREATE TYPE "public"."team_manager_type" AS ENUM('head_incharge', 'coordinator', 'accountant', 'chief_counsellor', 'hostel_incharge', 'principal');--> statement-breakpoint
CREATE TYPE "public"."user_type" AS ENUM('residential', 'non_residential', 'semi_residential');--> statement-breakpoint
CREATE TYPE "public"."week_name" AS ENUM('General', 'Exam', 'Event', 'Holiday');--> statement-breakpoint
CREATE TABLE "classes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	CONSTRAINT "classes_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"admission_number" varchar(50),
	"admission_date" timestamp,
	"aadhar_number" varchar(20),
	"date_of_birth" timestamp,
	"gender" varchar(10),
	"class_id" integer NOT NULL,
	"section_type" varchar(20),
	"is_hosteller" boolean DEFAULT false,
	"transport_chosen" boolean DEFAULT false,
	"guardian_phone" varchar(20),
	"guardian_name" varchar(255),
	"guardian_whatsapp_number" varchar(20),
	"mother_name" varchar(255),
	"address" varchar(255),
	"blood_group" varchar(10),
	"fee_status" varchar(20) DEFAULT 'Pending',
	"status" varchar(20) DEFAULT 'active',
	"account_opened" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"notes" jsonb DEFAULT '[]',
	CONSTRAINT "students_admission_number_unique" UNIQUE("admission_number")
);
--> statement-breakpoint
CREATE TABLE "accounting_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"singleton" boolean DEFAULT true NOT NULL,
	"books_start_date" timestamp,
	"opening_cash" integer DEFAULT 0 NOT NULL,
	"opening_upi" integer DEFAULT 0 NOT NULL,
	"opening_bank" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_by" integer NOT NULL,
	"target" "announcement_target" NOT NULL,
	"program" "announcement_program" NOT NULL,
	"subject" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"attachments" text[] DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assigned_task_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"user_id" integer,
	"action" text NOT NULL,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sprint_id" integer
);
--> statement-breakpoint
CREATE TABLE "assigned_task_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"status" "status" DEFAULT 'not_started' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"comment" text,
	"assigned_date" timestamp DEFAULT now() NOT NULL,
	"verified_by" integer,
	"verified_at" timestamp,
	"pinned" boolean DEFAULT false NOT NULL,
	"saved_for_later" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assigned_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"task_type" "task_type" DEFAULT 'assigned' NOT NULL,
	"deadline" timestamp,
	"resources" text
);
--> statement-breakpoint
CREATE TABLE "class_parent_teachers" (
	"id" serial PRIMARY KEY NOT NULL,
	"class_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_slot_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"slot_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"day_of_week" varchar(10),
	"role" varchar(16),
	"class_name" varchar(100),
	"subject" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_slot_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"slot_id" integer NOT NULL,
	"date" timestamp NOT NULL,
	"student_id" integer NOT NULL,
	"status" text NOT NULL,
	"defaulter_type" "defaulter_type",
	"comment" text,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"has_sub_slots" boolean DEFAULT false NOT NULL,
	"assigned_member_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "day_close_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" timestamp NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"mri_cleared" boolean DEFAULT true NOT NULL,
	"mri_report" jsonb,
	"assigned_tasks_updates" jsonb,
	"routine_tasks_updates" jsonb,
	"routine_log" text,
	"general_log" text,
	"is_routine_log" text,
	"is_general_log" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"approved_by" integer,
	"approved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "direct_whatsapp_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" integer NOT NULL,
	"recipient_type" "direct_recipient_type" NOT NULL,
	"recipient_user_id" integer,
	"recipient_name" varchar(255),
	"recipient_whatsapp_number" varchar(15),
	"subject" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"note" text,
	"contact" varchar(255) NOT NULL,
	"status" "message_status" DEFAULT 'sent' NOT NULL,
	"twilio_sid" varchar(64),
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "general_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"action" text NOT NULL,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"joined_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"conversation_sid" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"reason" text NOT NULL,
	"proof" text,
	"transfer_to" integer,
	"leave_status" "leave_status" DEFAULT 'pending' NOT NULL,
	"submitted_to" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"approved_by" integer,
	"approved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "me_right_now_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" "me_right_now_type" NOT NULL,
	"item_id" text NOT NULL,
	"item_title" varchar(255) NOT NULL,
	"note" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meed_community_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"title" varchar(255),
	"url" text NOT NULL,
	"mime_type" varchar(160),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meed_community_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meed_community_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" varchar(255),
	"content" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meed_community_reactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"type" varchar(16) DEFAULT 'like' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meed_repo_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"title" varchar(255),
	"url" text NOT NULL,
	"mime_type" varchar(160),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meed_repo_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"task_id" integer,
	"title" varchar(255) NOT NULL,
	"content" text,
	"tags" jsonb DEFAULT '[]',
	"status" "meed_repo_status" DEFAULT 'submitted' NOT NULL,
	"verified_by" integer,
	"verified_at" timestamp,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"task_type" "task_type" NOT NULL,
	"task_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" "status" NOT NULL,
	"completed_at" timestamp NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" integer NOT NULL,
	"recipient_id" integer NOT NULL,
	"subject" varchar(255),
	"message" text,
	"note" text,
	"contact" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"status" "message_status" DEFAULT 'sent' NOT NULL,
	"message_type" "message_type" DEFAULT 'direct' NOT NULL,
	"content" text
);
--> statement-breakpoint
CREATE TABLE "mri_defaulter_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"defaulter_type" "defaulter_type" NOT NULL,
	"student_id" integer NOT NULL,
	"reported_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mri_families" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(32) NOT NULL,
	"name" varchar(120) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mri_families_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "mri_programs" (
	"id" serial PRIMARY KEY NOT NULL,
	"family_id" integer NOT NULL,
	"program_key" varchar(32) NOT NULL,
	"name" varchar(160) NOT NULL,
	"scope" varchar(32) DEFAULT 'both' NOT NULL,
	"aims" text,
	"sop" jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mri_programs_program_key_unique" UNIQUE("program_key")
);
--> statement-breakpoint
CREATE TABLE "mri_role_defs" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_key" varchar(64) NOT NULL,
	"name" varchar(160) NOT NULL,
	"category" varchar(16) DEFAULT 'rmri' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mri_role_defs_role_key_unique" UNIQUE("role_key")
);
--> statement-breakpoint
CREATE TABLE "mri_role_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_def_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"submissables" jsonb,
	"action" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "msp_code_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"msp_code_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"is_primary" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "msp_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(32) NOT NULL,
	"program" varchar(32) DEFAULT 'MSP' NOT NULL,
	"family_key" varchar(32) NOT NULL,
	"track" varchar(32) NOT NULL,
	"title" varchar(160) NOT NULL,
	"parent_slice" varchar(32),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "msp_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "non_meedian_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" integer NOT NULL,
	"custom_name" varchar(255) NOT NULL,
	"custom_whatsapp_number" varchar(15) NOT NULL,
	"subject" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"note" text,
	"contact" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"status" "message_status" DEFAULT 'sent' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "not_completed_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_type" "task_type" NOT NULL,
	"task_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"date" timestamp NOT NULL,
	"details" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(255),
	"body" text,
	"entity_kind" varchar(64),
	"entity_id" integer,
	"meta" jsonb DEFAULT '{}',
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "open_close_times" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_type" "user_type" NOT NULL,
	"day_open_time" time NOT NULL,
	"day_close_time" time NOT NULL,
	"closing_window_start" time NOT NULL,
	"closing_window_end" time NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_evaluation_rubrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"program_id" integer NOT NULL,
	"title" varchar(160) NOT NULL,
	"metrics" jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_evaluations" (
	"id" serial PRIMARY KEY NOT NULL,
	"program_id" integer NOT NULL,
	"rubric_id" integer,
	"evaluator_id" integer,
	"subject_type" varchar(16) DEFAULT 'user' NOT NULL,
	"subject_id" text NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"scores" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_evaluator_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"program_id" integer NOT NULL,
	"role_key" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"program_id" integer NOT NULL,
	"title" varchar(160) NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_periods" (
	"id" serial PRIMARY KEY NOT NULL,
	"program_id" integer NOT NULL,
	"track" varchar(32) DEFAULT 'both' NOT NULL,
	"period_key" varchar(16) NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_schedule_cells" (
	"id" serial PRIMARY KEY NOT NULL,
	"program_id" integer NOT NULL,
	"track" varchar(32) DEFAULT 'both' NOT NULL,
	"class_id" integer NOT NULL,
	"period_key" varchar(16) NOT NULL,
	"msp_code_id" integer,
	"subject" varchar(160),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_schedule_days" (
	"id" serial PRIMARY KEY NOT NULL,
	"program_id" integer NOT NULL,
	"track" varchar(32) DEFAULT 'both' NOT NULL,
	"class_id" integer NOT NULL,
	"day_name" varchar(16) NOT NULL,
	"period_key" varchar(16) NOT NULL,
	"msp_code_id" integer,
	"subject" varchar(160),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_tracker_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"program_id" integer NOT NULL,
	"tracker_id" integer NOT NULL,
	"user_id" integer,
	"date" timestamp DEFAULT now() NOT NULL,
	"data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_trackers" (
	"id" serial PRIMARY KEY NOT NULL,
	"program_id" integer NOT NULL,
	"tracker_key" varchar(64) NOT NULL,
	"name" varchar(160) NOT NULL,
	"fields" jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource_id" integer NOT NULL,
	"title" varchar(255),
	"url" text NOT NULL,
	"mime_type" varchar(120),
	"uploaded_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"parent_id" integer,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource_id" integer NOT NULL,
	"kind" "resource_log_kind" NOT NULL,
	"by_user_id" integer,
	"to_user_id" integer,
	"notes" text,
	"scheduled_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"asset_tag" varchar(64),
	"category_id" integer,
	"type" varchar(120),
	"serial_no" varchar(160),
	"vendor" varchar(160),
	"purchase_date" timestamp,
	"warranty_end" timestamp,
	"cost" integer,
	"building" varchar(120),
	"room" varchar(120),
	"status" "resource_status" DEFAULT 'available' NOT NULL,
	"assigned_to" integer,
	"notes" text,
	"tags" jsonb DEFAULT '[]',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "resources_asset_tag_unique" UNIQUE("asset_tag")
);
--> statement-breakpoint
CREATE TABLE "routine_task_daily_statuses" (
	"id" serial PRIMARY KEY NOT NULL,
	"routine_task_id" integer NOT NULL,
	"date" timestamp NOT NULL,
	"status" "status" DEFAULT 'not_started' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"comment" text,
	"is_locked" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routine_task_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"routine_task_id" integer,
	"user_id" integer NOT NULL,
	"action" text NOT NULL,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routine_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"member_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school_calendar" (
	"id" serial PRIMARY KEY NOT NULL,
	"major_term" varchar(50) NOT NULL,
	"minor_term" varchar(50) NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"name" "week_name" DEFAULT 'General' NOT NULL,
	"week_number" integer,
	"is_major_term_boundary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sprints" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_status_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" "status" DEFAULT 'not_started' NOT NULL,
	"verified_by" integer,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_mri_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"role" "mri_role" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"content" text NOT NULL,
	"category" "note_category" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_open_close_times" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"day_opened_at" time NOT NULL,
	"day_closed_at" time,
	"use_custom_times" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"whatsapp_number" varchar(15),
	"whatsapp_enabled" boolean DEFAULT true NOT NULL,
	"role" "role" DEFAULT 'member' NOT NULL,
	"team_manager_type" "team_manager_type",
	"type" "user_type" DEFAULT 'residential' NOT NULL,
	"member_scope" "member_scope" DEFAULT 'i_member' NOT NULL,
	"image" text,
	"deep_calendar_token" text,
	"immediate_supervisor" integer,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_deep_calendar_token_unique" UNIQUE("deep_calendar_token")
);
--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assigned_task_logs" ADD CONSTRAINT "assigned_task_logs_task_id_assigned_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."assigned_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assigned_task_logs" ADD CONSTRAINT "assigned_task_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assigned_task_logs" ADD CONSTRAINT "assigned_task_logs_sprint_id_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assigned_task_status" ADD CONSTRAINT "assigned_task_status_task_id_assigned_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."assigned_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assigned_task_status" ADD CONSTRAINT "assigned_task_status_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assigned_task_status" ADD CONSTRAINT "assigned_task_status_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assigned_tasks" ADD CONSTRAINT "assigned_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_parent_teachers" ADD CONSTRAINT "class_parent_teachers_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_parent_teachers" ADD CONSTRAINT "class_parent_teachers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_slot_assignments" ADD CONSTRAINT "daily_slot_assignments_slot_id_daily_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."daily_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_slot_assignments" ADD CONSTRAINT "daily_slot_assignments_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_slot_logs" ADD CONSTRAINT "daily_slot_logs_slot_id_daily_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."daily_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_slot_logs" ADD CONSTRAINT "daily_slot_logs_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_slot_logs" ADD CONSTRAINT "daily_slot_logs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_slots" ADD CONSTRAINT "daily_slots_assigned_member_id_users_id_fk" FOREIGN KEY ("assigned_member_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_close_requests" ADD CONSTRAINT "day_close_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_close_requests" ADD CONSTRAINT "day_close_requests_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_whatsapp_messages" ADD CONSTRAINT "direct_whatsapp_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_whatsapp_messages" ADD CONSTRAINT "direct_whatsapp_messages_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "general_logs" ADD CONSTRAINT "general_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_transfer_to_users_id_fk" FOREIGN KEY ("transfer_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_submitted_to_users_id_fk" FOREIGN KEY ("submitted_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "me_right_now_sessions" ADD CONSTRAINT "me_right_now_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meed_community_attachments" ADD CONSTRAINT "meed_community_attachments_post_id_meed_community_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."meed_community_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meed_community_comments" ADD CONSTRAINT "meed_community_comments_post_id_meed_community_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."meed_community_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meed_community_comments" ADD CONSTRAINT "meed_community_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meed_community_posts" ADD CONSTRAINT "meed_community_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meed_community_reactions" ADD CONSTRAINT "meed_community_reactions_post_id_meed_community_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."meed_community_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meed_community_reactions" ADD CONSTRAINT "meed_community_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meed_repo_attachments" ADD CONSTRAINT "meed_repo_attachments_post_id_meed_repo_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."meed_repo_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meed_repo_posts" ADD CONSTRAINT "meed_repo_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meed_repo_posts" ADD CONSTRAINT "meed_repo_posts_task_id_assigned_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."assigned_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meed_repo_posts" ADD CONSTRAINT "meed_repo_posts_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_history" ADD CONSTRAINT "member_history_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mri_defaulter_logs" ADD CONSTRAINT "mri_defaulter_logs_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mri_defaulter_logs" ADD CONSTRAINT "mri_defaulter_logs_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mri_programs" ADD CONSTRAINT "mri_programs_family_id_mri_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."mri_families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mri_role_tasks" ADD CONSTRAINT "mri_role_tasks_role_def_id_mri_role_defs_id_fk" FOREIGN KEY ("role_def_id") REFERENCES "public"."mri_role_defs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "msp_code_assignments" ADD CONSTRAINT "msp_code_assignments_msp_code_id_msp_codes_id_fk" FOREIGN KEY ("msp_code_id") REFERENCES "public"."msp_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "msp_code_assignments" ADD CONSTRAINT "msp_code_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "non_meedian_messages" ADD CONSTRAINT "non_meedian_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "not_completed_tasks" ADD CONSTRAINT "not_completed_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_evaluation_rubrics" ADD CONSTRAINT "program_evaluation_rubrics_program_id_mri_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."mri_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_evaluations" ADD CONSTRAINT "program_evaluations_program_id_mri_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."mri_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_evaluations" ADD CONSTRAINT "program_evaluations_rubric_id_program_evaluation_rubrics_id_fk" FOREIGN KEY ("rubric_id") REFERENCES "public"."program_evaluation_rubrics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_evaluations" ADD CONSTRAINT "program_evaluations_evaluator_id_users_id_fk" FOREIGN KEY ("evaluator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_evaluator_roles" ADD CONSTRAINT "program_evaluator_roles_program_id_mri_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."mri_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_goals" ADD CONSTRAINT "program_goals_program_id_mri_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."mri_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_periods" ADD CONSTRAINT "program_periods_program_id_mri_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."mri_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_schedule_cells" ADD CONSTRAINT "program_schedule_cells_program_id_mri_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."mri_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_schedule_cells" ADD CONSTRAINT "program_schedule_cells_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_schedule_cells" ADD CONSTRAINT "program_schedule_cells_msp_code_id_msp_codes_id_fk" FOREIGN KEY ("msp_code_id") REFERENCES "public"."msp_codes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_schedule_days" ADD CONSTRAINT "program_schedule_days_program_id_mri_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."mri_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_schedule_days" ADD CONSTRAINT "program_schedule_days_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_schedule_days" ADD CONSTRAINT "program_schedule_days_msp_code_id_msp_codes_id_fk" FOREIGN KEY ("msp_code_id") REFERENCES "public"."msp_codes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_tracker_entries" ADD CONSTRAINT "program_tracker_entries_program_id_mri_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."mri_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_tracker_entries" ADD CONSTRAINT "program_tracker_entries_tracker_id_program_trackers_id_fk" FOREIGN KEY ("tracker_id") REFERENCES "public"."program_trackers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_tracker_entries" ADD CONSTRAINT "program_tracker_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_trackers" ADD CONSTRAINT "program_trackers_program_id_mri_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."mri_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_attachments" ADD CONSTRAINT "resource_attachments_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_attachments" ADD CONSTRAINT "resource_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_categories" ADD CONSTRAINT "resource_categories_parent_id_resource_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."resource_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_logs" ADD CONSTRAINT "resource_logs_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_logs" ADD CONSTRAINT "resource_logs_by_user_id_users_id_fk" FOREIGN KEY ("by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_logs" ADD CONSTRAINT "resource_logs_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_category_id_resource_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."resource_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_task_daily_statuses" ADD CONSTRAINT "routine_task_daily_statuses_routine_task_id_routine_tasks_id_fk" FOREIGN KEY ("routine_task_id") REFERENCES "public"."routine_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_task_logs" ADD CONSTRAINT "routine_task_logs_routine_task_id_routine_tasks_id_fk" FOREIGN KEY ("routine_task_id") REFERENCES "public"."routine_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_task_logs" ADD CONSTRAINT "routine_task_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_tasks" ADD CONSTRAINT "routine_tasks_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_task_status_id_assigned_task_status_id_fk" FOREIGN KEY ("task_status_id") REFERENCES "public"."assigned_task_status"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_mri_roles" ADD CONSTRAINT "user_mri_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notes" ADD CONSTRAINT "user_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_open_close_times" ADD CONSTRAINT "user_open_close_times_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_immediate_supervisor_users_id_fk" FOREIGN KEY ("immediate_supervisor") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "students_class_idx" ON "students" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "students_admno_idx" ON "students" USING btree ("admission_number");--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_settings_singleton_idx" ON "accounting_settings" USING btree ("singleton");--> statement-breakpoint
CREATE INDEX "idx_assigned_task_logs_task_id" ON "assigned_task_logs" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_assigned_task_status_task_member" ON "assigned_task_status" USING btree ("task_id","member_id");--> statement-breakpoint
CREATE INDEX "idx_assigned_tasks_created_by" ON "assigned_tasks" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "cpt_class_idx" ON "class_parent_teachers" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "cpt_user_idx" ON "class_parent_teachers" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cpt_unique_span" ON "class_parent_teachers" USING btree ("class_id","user_id","start_date");--> statement-breakpoint
CREATE INDEX "idx_daily_slot_logs_slot_date" ON "daily_slot_logs" USING btree ("slot_id","date");--> statement-breakpoint
CREATE INDEX "idx_day_close_requests_user_date" ON "day_close_requests" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "idx_dwm_sender_created" ON "direct_whatsapp_messages" USING btree ("sender_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_dwm_recipient_user" ON "direct_whatsapp_messages" USING btree ("recipient_user_id");--> statement-breakpoint
CREATE INDEX "idx_dwm_recipient_type" ON "direct_whatsapp_messages" USING btree ("recipient_type");--> statement-breakpoint
CREATE INDEX "idx_leave_requests_user_date" ON "leave_requests" USING btree ("user_id","start_date");--> statement-breakpoint
CREATE INDEX "mrr_active_idx" ON "me_right_now_sessions" USING btree ("active");--> statement-breakpoint
CREATE INDEX "mrr_user_active_idx" ON "me_right_now_sessions" USING btree ("user_id","active");--> statement-breakpoint
CREATE INDEX "meed_community_attachments_post_idx" ON "meed_community_attachments" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "meed_community_comments_post_idx" ON "meed_community_comments" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "meed_community_posts_user_idx" ON "meed_community_posts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "meed_community_posts_created_idx" ON "meed_community_posts" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "meed_community_react_unique" ON "meed_community_reactions" USING btree ("post_id","user_id","type");--> statement-breakpoint
CREATE INDEX "meed_community_react_post_idx" ON "meed_community_reactions" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "meed_repo_attachments_post_idx" ON "meed_repo_attachments" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "meed_repo_posts_user_idx" ON "meed_repo_posts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "meed_repo_posts_status_idx" ON "meed_repo_posts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_messages_sender_recipient" ON "messages" USING btree ("sender_id","recipient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mri_defaulter_logs_date_type_student_idx" ON "mri_defaulter_logs" USING btree ("date","defaulter_type","student_id");--> statement-breakpoint
CREATE INDEX "mri_defaulter_logs_date_idx" ON "mri_defaulter_logs" USING btree ("date");--> statement-breakpoint
CREATE INDEX "mri_role_tasks_role_idx" ON "mri_role_tasks" USING btree ("role_def_id");--> statement-breakpoint
CREATE INDEX "msp_code_assignments_role_idx" ON "msp_code_assignments" USING btree ("msp_code_id");--> statement-breakpoint
CREATE INDEX "msp_code_assignments_user_idx" ON "msp_code_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "msp_codes_family_idx" ON "msp_codes" USING btree ("family_key");--> statement-breakpoint
CREATE INDEX "msp_codes_track_idx" ON "msp_codes" USING btree ("track");--> statement-breakpoint
CREATE INDEX "idx_non_meedian_messages_sender" ON "non_meedian_messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","read");--> statement-breakpoint
CREATE INDEX "program_eval_rubrics_program_idx" ON "program_evaluation_rubrics" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "program_evals_program_idx" ON "program_evaluations" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "program_evals_evaluator_idx" ON "program_evaluations" USING btree ("evaluator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "program_evaluator_roles_unique" ON "program_evaluator_roles" USING btree ("program_id","role_key");--> statement-breakpoint
CREATE INDEX "program_evaluator_roles_program_idx" ON "program_evaluator_roles" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "program_goals_program_idx" ON "program_goals" USING btree ("program_id");--> statement-breakpoint
CREATE UNIQUE INDEX "program_periods_unique" ON "program_periods" USING btree ("program_id","track","period_key");--> statement-breakpoint
CREATE INDEX "program_periods_program_idx" ON "program_periods" USING btree ("program_id");--> statement-breakpoint
CREATE UNIQUE INDEX "program_schedule_cell_unique" ON "program_schedule_cells" USING btree ("program_id","track","class_id","period_key");--> statement-breakpoint
CREATE INDEX "program_schedule_program_idx" ON "program_schedule_cells" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "program_schedule_class_idx" ON "program_schedule_cells" USING btree ("class_id");--> statement-breakpoint
CREATE UNIQUE INDEX "program_schedule_day_unique" ON "program_schedule_days" USING btree ("program_id","track","class_id","day_name","period_key");--> statement-breakpoint
CREATE INDEX "program_schedule_day_program_idx" ON "program_schedule_days" USING btree ("program_id","day_name");--> statement-breakpoint
CREATE INDEX "program_schedule_day_class_idx" ON "program_schedule_days" USING btree ("class_id","day_name");--> statement-breakpoint
CREATE INDEX "program_tracker_entries_program_idx" ON "program_tracker_entries" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "program_tracker_entries_tracker_idx" ON "program_tracker_entries" USING btree ("tracker_id");--> statement-breakpoint
CREATE INDEX "program_tracker_entries_user_idx" ON "program_tracker_entries" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "program_trackers_key_unique" ON "program_trackers" USING btree ("program_id","tracker_key");--> statement-breakpoint
CREATE INDEX "program_trackers_program_idx" ON "program_trackers" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "resource_attachments_res_idx" ON "resource_attachments" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "resource_categories_name_idx" ON "resource_categories" USING btree ("name");--> statement-breakpoint
CREATE INDEX "resource_categories_parent_idx" ON "resource_categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "resource_logs_res_kind_idx" ON "resource_logs" USING btree ("resource_id","kind");--> statement-breakpoint
CREATE INDEX "resources_status_idx" ON "resources" USING btree ("status");--> statement-breakpoint
CREATE INDEX "resources_category_idx" ON "resources" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "resources_location_idx" ON "resources" USING btree ("building","room");--> statement-breakpoint
CREATE INDEX "resources_assigned_idx" ON "resources" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_routine_task_daily_statuses_task_date" ON "routine_task_daily_statuses" USING btree ("routine_task_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "user_mri_roles_user_role_unique" ON "user_mri_roles" USING btree ("user_id","role");--> statement-breakpoint
CREATE INDEX "idx_user_mri_roles_user" ON "user_mri_roles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_notes_user_id" ON "user_notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_users_whatsapp_number" ON "users" USING btree ("whatsapp_number");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");