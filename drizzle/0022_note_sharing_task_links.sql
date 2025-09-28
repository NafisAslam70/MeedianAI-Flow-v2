CREATE TABLE IF NOT EXISTS "user_note_shares" (
  "id" serial PRIMARY KEY,
  "note_id" integer NOT NULL REFERENCES "user_notes"("id") ON DELETE CASCADE,
  "shared_with_user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "shared_by_user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "can_edit" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_note_shares_unique"
  ON "user_note_shares" ("note_id", "shared_with_user_id");

CREATE INDEX IF NOT EXISTS "idx_user_note_shares_shared_with"
  ON "user_note_shares" ("shared_with_user_id");

CREATE TABLE IF NOT EXISTS "user_note_task_links" (
  "id" serial PRIMARY KEY,
  "note_id" integer NOT NULL REFERENCES "user_notes"("id") ON DELETE CASCADE,
  "task_id" integer NOT NULL REFERENCES "assigned_tasks"("id") ON DELETE CASCADE,
  "source_text" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_note_task_links_unique"
  ON "user_note_task_links" ("note_id", "task_id");

CREATE INDEX IF NOT EXISTS "idx_user_note_task_links_task"
  ON "user_note_task_links" ("task_id");
